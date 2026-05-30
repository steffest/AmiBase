/**
 * @license
 * Copyright 2010 The Emscripten Authors
 * SPDX-License-Identifier: MIT
 */

// @ts-nocheck
var wasmFactory = (() => {
  var _scriptName = import.meta.url

  return async function (moduleArg = {}) {
    var moduleRtn

    // include: shell.js
    // The Module object: Our interface to the outside world. We import
    // and export values on it. There are various ways Module can be used:
    // 1. Not defined. We create it here
    // 2. A function parameter, function(moduleArg) => Promise<Module>
    // 3. pre-run appended it, var Module = {}; ..generated code..
    // 4. External script tag defines var Module.
    // We need to check if Module already exists (e.g. case 3 above).
    // Substitution will be replaced with actual code on later stage of the build,
    // this way Closure Compiler will not mangle it (e.g. case 4. above).
    // Note that if you want to run closure, and also to use Module
    // after the generated code, you will need to define   var Module = {};
    // before the code. Then that object will be used in the code, and you
    // can continue to use Module afterwards as well.
    var Module = moduleArg

    // Set up the promise that indicates the Module is initialized
    var readyPromiseResolve, readyPromiseReject

    var readyPromise = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve
      readyPromiseReject = reject
    })

    // Determine the runtime environment we are in. You can customize this by
    // setting the ENVIRONMENT setting at compile time (see settings.js).
    // Attempt to auto-detect the environment
    var ENVIRONMENT_IS_WEB = typeof window == 'object'

    var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != 'undefined'

    // N.b. Electron.js environment is simultaneously a NODE-environment, but
    // also a web environment.
    var ENVIRONMENT_IS_NODE =
      typeof process == 'object' &&
      typeof process.versions == 'object' &&
      typeof process.versions.node == 'string' &&
      process.type != 'renderer'

    var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER

    if (ENVIRONMENT_IS_NODE) {
      // When building an ES module `require` is not normally available.
      // We need to use `createRequire()` to construct the require()` function.
      const { createRequire } = await import('module')
      /** @suppress{duplicate} */ var require = createRequire(import.meta.url)
    }

    // --pre-jses are emitted after the Module integration code, so that they can
    // refer to Module (if they choose; they can also define Module)
    // Sometimes an existing Module object exists with properties
    // meant to overwrite the default module functionality. Here
    // we collect those properties and reapply _after_ we configure
    // the current environment's defaults to avoid having to be so
    // defensive during initialization.
    var moduleOverrides = {
      ...Module,
    }

    var arguments_ = []

    var thisProgram = './this.program'

    var quit_ = (status, toThrow) => {
      throw toThrow
    }

    // `/` should be present at the end if `scriptDirectory` is not empty
    var scriptDirectory = ''

    function locateFile(path) {
      return scriptDirectory + path
    }

    // Hooks that are implemented differently in different runtime environments.
    var readAsync, readBinary

    if (ENVIRONMENT_IS_NODE) {
      if (typeof process == 'undefined' || !process.release || process.release.name !== 'node')
        throw new Error(
          'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
        )
      var nodeVersion = process.versions.node
      var numericVersion = nodeVersion.split('.').slice(0, 3)
      numericVersion =
        numericVersion[0] * 1e4 + numericVersion[1] * 100 + numericVersion[2].split('-')[0] * 1
      if (numericVersion < 18e4) {
        throw new Error(
          'This emscripten-generated code requires node v18.0.0 (detected v' + nodeVersion + ')'
        )
      }
      // These modules will usually be used on Node.js. Load them eagerly to avoid
      // the complexity of lazy-loading.
      var fs = require('fs')
      var nodePath = require('path')
      // EXPORT_ES6 + ENVIRONMENT_IS_NODE always requires use of import.meta.url,
      // since there's no way getting the current absolute path of the module when
      // support for that is not available.
      if (!import.meta.url.startsWith('data:')) {
        scriptDirectory = nodePath.dirname(require('url').fileURLToPath(import.meta.url)) + '/'
      }
      // include: node_shell_read.js
      readBinary = filename => {
        // We need to re-wrap `file://` strings to URLs.
        filename = isFileURI(filename) ? new URL(filename) : filename
        var ret = fs.readFileSync(filename)
        assert(Buffer.isBuffer(ret))
        return ret
      }
      readAsync = async (filename, binary = true) => {
        // See the comment in the `readBinary` function.
        filename = isFileURI(filename) ? new URL(filename) : filename
        var ret = fs.readFileSync(filename, binary ? undefined : 'utf8')
        assert(binary ? Buffer.isBuffer(ret) : typeof ret == 'string')
        return ret
      }
      // end include: node_shell_read.js
      if (!Module['thisProgram'] && process.argv.length > 1) {
        thisProgram = process.argv[1].replace(/\\/g, '/')
      }
      arguments_ = process.argv.slice(2)
      // MODULARIZE will export the module in the proper place outside, we don't need to export here
      quit_ = (status, toThrow) => {
        process.exitCode = status
        throw toThrow
      }
    } else if (ENVIRONMENT_IS_SHELL) {
      if (
        (typeof process == 'object' && typeof require === 'function') ||
        typeof window == 'object' ||
        typeof WorkerGlobalScope != 'undefined'
      )
        throw new Error(
          'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
        )
    } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      // Note that this includes Node.js workers when relevant (pthreads is enabled).
      // Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
      // ENVIRONMENT_IS_NODE.
      if (ENVIRONMENT_IS_WORKER) {
        // Check worker, not web, since window could be polyfilled
        scriptDirectory = self.location.href
      } else if (typeof document != 'undefined' && document.currentScript) {
        // web
        scriptDirectory = document.currentScript.src
      }
      // When MODULARIZE, this JS may be executed later, after document.currentScript
      // is gone, so we saved it, and we use it here instead of any other info.
      if (_scriptName) {
        scriptDirectory = _scriptName
      }
      // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
      // otherwise, slice off the final part of the url to find the script directory.
      // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
      // and scriptDirectory will correctly be replaced with an empty string.
      // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
      // they are removed because they could contain a slash.
      if (scriptDirectory.startsWith('blob:')) {
        scriptDirectory = ''
      } else {
        scriptDirectory = scriptDirectory.slice(
          0,
          scriptDirectory.replace(/[?#].*/, '').lastIndexOf('/') + 1
        )
      }
      if (!(typeof window == 'object' || typeof WorkerGlobalScope != 'undefined'))
        throw new Error(
          'not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)'
        )
      {
        // include: web_or_worker_shell_read.js
        if (ENVIRONMENT_IS_WORKER) {
          readBinary = url => {
            var xhr = new XMLHttpRequest()
            xhr.open('GET', url, false)
            xhr.responseType = 'arraybuffer'
            xhr.send(null)
            return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response))
          }
        }
        readAsync = async url => {
          // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
          // See https://github.com/github/fetch/pull/92#issuecomment-140665932
          // Cordova or Electron apps are typically loaded from a file:// url.
          // So use XHR on webview if URL is a file URL.
          if (isFileURI(url)) {
            return new Promise((resolve, reject) => {
              var xhr = new XMLHttpRequest()
              xhr.open('GET', url, true)
              xhr.responseType = 'arraybuffer'
              xhr.onload = () => {
                if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
                  // file URLs can return 0
                  resolve(xhr.response)
                  return
                }
                reject(xhr.status)
              }
              xhr.onerror = reject
              xhr.send(null)
            })
          }
          var response = await fetch(url, {
            credentials: 'same-origin',
          })
          if (response.ok) {
            return response.arrayBuffer()
          }
          throw new Error(response.status + ' : ' + response.url)
        }
      }
    } else {
      throw new Error('environment detection error')
    }

    var out = console.log.bind(console)

    var err = console.error.bind(console)

    // Merge back in the overrides
    Object.assign(Module, moduleOverrides)

    // Free the object hierarchy contained in the overrides, this lets the GC
    // reclaim data used.
    moduleOverrides = null

    checkIncomingModuleAPI()

    // Emit code to handle expected values on the Module object. This applies Module.x
    // to the proper local x. This has two benefits: first, we only emit it if it is
    // expected to arrive, and second, by using a local everywhere else that can be
    // minified.
    legacyModuleProp('arguments', 'arguments_')

    legacyModuleProp('thisProgram', 'thisProgram')

    // perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
    // Assertions on removed incoming Module JS APIs.
    assert(
      typeof Module['memoryInitializerPrefixURL'] == 'undefined',
      'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead'
    )

    assert(
      typeof Module['pthreadMainPrefixURL'] == 'undefined',
      'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead'
    )

    assert(
      typeof Module['cdInitializerPrefixURL'] == 'undefined',
      'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead'
    )

    assert(
      typeof Module['filePackagePrefixURL'] == 'undefined',
      'Module.filePackagePrefixURL option was removed, use Module.locateFile instead'
    )

    assert(typeof Module['read'] == 'undefined', 'Module.read option was removed')

    assert(
      typeof Module['readAsync'] == 'undefined',
      'Module.readAsync option was removed (modify readAsync in JS)'
    )

    assert(
      typeof Module['readBinary'] == 'undefined',
      'Module.readBinary option was removed (modify readBinary in JS)'
    )

    assert(
      typeof Module['setWindowTitle'] == 'undefined',
      'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)'
    )

    assert(
      typeof Module['TOTAL_MEMORY'] == 'undefined',
      'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY'
    )

    legacyModuleProp('asm', 'wasmExports')

    legacyModuleProp('readAsync', 'readAsync')

    legacyModuleProp('readBinary', 'readBinary')

    legacyModuleProp('setWindowTitle', 'setWindowTitle')

    assert(
      !ENVIRONMENT_IS_SHELL,
      'shell environment detected but not enabled at build time.  Add `shell` to `-sENVIRONMENT` to enable.'
    )

    var wasmBinary

    legacyModuleProp('wasmBinary', 'wasmBinary')

    if (typeof WebAssembly != 'object') {
      err('no native wasm support detected')
    }

    // Wasm globals
    var wasmMemory

    //========================================
    // Runtime essentials
    //========================================
    // whether we are quitting the application. no code should run after this.
    // set in exit() and abort()
    var ABORT = false

    // set by exit() and abort().  Passed to 'onExit' handler.
    // NOTE: This is also used as the process return code code in shell environments
    // but only when noExitRuntime is false.
    var EXITSTATUS

    // In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
    // don't define it at all in release modes.  This matches the behaviour of
    // MINIMAL_RUNTIME.
    // TODO(sbc): Make this the default even without STRICT enabled.
    /** @type {function(*, string=)} */ function assert(condition, text) {
      if (!condition) {
        abort('Assertion failed' + (text ? ': ' + text : ''))
      }
    }

    // We used to include malloc/free by default in the past. Show a helpful error in
    // builds with assertions.
    // Memory management
    var /** @type {!Int8Array} */ HEAP8,
      /** @type {!Uint8Array} */ HEAPU8,
      /** @type {!Int16Array} */ HEAP16,
      /** @type {!Uint16Array} */ HEAPU16,
      /** @type {!Int32Array} */ HEAP32,
      /** @type {!Uint32Array} */ HEAPU32,
      /** @type {!Float32Array} */ HEAPF32,
      /* BigInt64Array type is not correctly defined in closure
/** not-@type {!BigInt64Array} */ HEAP64,
      /* BigUint64Array type is not correctly defined in closure
/** not-t@type {!BigUint64Array} */ HEAPU64,
      /** @type {!Float64Array} */ HEAPF64

    var HEAP_DATA_VIEW

    var runtimeInitialized = false

    /**
     * Indicates whether filename is delivered via file protocol (as opposed to http/https)
     * @noinline
     */ var isFileURI = filename => filename.startsWith('file://')

    // include: runtime_shared.js
    // include: runtime_stack_check.js
    // Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
    function writeStackCookie() {
      var max = _emscripten_stack_get_end()
      assert((max & 3) == 0)
      // If the stack ends at address zero we write our cookies 4 bytes into the
      // stack.  This prevents interference with SAFE_HEAP and ASAN which also
      // monitor writes to address zero.
      if (max == 0) {
        max += 4
      }
      // The stack grow downwards towards _emscripten_stack_get_end.
      // We write cookies to the final two words in the stack and detect if they are
      // ever overwritten.
      LE_HEAP_STORE_U32((max >> 2) * 4, 34821223)
      LE_HEAP_STORE_U32(((max + 4) >> 2) * 4, 2310721022)
      // Also test the global address 0 for integrity.
      LE_HEAP_STORE_U32((0 >> 2) * 4, 1668509029)
    }

    function checkStackCookie() {
      if (ABORT) return
      var max = _emscripten_stack_get_end()
      // See writeStackCookie().
      if (max == 0) {
        max += 4
      }
      var cookie1 = LE_HEAP_LOAD_U32((max >> 2) * 4)
      var cookie2 = LE_HEAP_LOAD_U32(((max + 4) >> 2) * 4)
      if (cookie1 != 34821223 || cookie2 != 2310721022) {
        abort(
          `Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`
        )
      }
      // Also test the global address 0 for integrity.
      if (LE_HEAP_LOAD_U32((0 >> 2) * 4) != 1668509029) {
        abort('Runtime error: The application has corrupted its heap memory area (address zero)!')
      }
    }

    // end include: runtime_stack_check.js
    // include: runtime_exceptions.js
    // end include: runtime_exceptions.js
    // include: runtime_debug.js
    // Endianness check
    if (Module['ENVIRONMENT']) {
      throw new Error(
        'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)'
      )
    }

    function legacyModuleProp(prop, newName, incoming = true) {
      if (!Object.getOwnPropertyDescriptor(Module, prop)) {
        Object.defineProperty(Module, prop, {
          configurable: true,
          get() {
            let extra = incoming
              ? ' (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)'
              : ''
            abort(`\`Module.${prop}\` has been replaced by \`${newName}\`` + extra)
          },
        })
      }
    }

    function ignoredModuleProp(prop) {
      if (Object.getOwnPropertyDescriptor(Module, prop)) {
        abort(
          `\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`
        )
      }
    }

    // forcing the filesystem exports a few things by default
    function isExportedByForceFilesystem(name) {
      return (
        name === 'FS_createPath' ||
        name === 'FS_createDataFile' ||
        name === 'FS_createPreloadedFile' ||
        name === 'FS_unlink' ||
        name === 'addRunDependency' || // The old FS has some functionality that WasmFS lacks.
        name === 'FS_createLazyFile' ||
        name === 'FS_createDevice' ||
        name === 'removeRunDependency'
      )
    }

    /**
     * Intercept access to a global symbol.  This enables us to give informative
     * warnings/errors when folks attempt to use symbols they did not include in
     * their build, or no symbols that no longer exist.
     */ function hookGlobalSymbolAccess(sym, func) {
      if (typeof globalThis != 'undefined' && !Object.getOwnPropertyDescriptor(globalThis, sym)) {
        Object.defineProperty(globalThis, sym, {
          configurable: true,
          get() {
            func()
            return undefined
          },
        })
      }
    }

    function missingGlobal(sym, msg) {
      hookGlobalSymbolAccess(sym, () => {
        warnOnce(`\`${sym}\` is not longer defined by emscripten. ${msg}`)
      })
    }

    missingGlobal('buffer', 'Please use HEAP8.buffer or wasmMemory.buffer')

    missingGlobal('asm', 'Please use wasmExports instead')

    function missingLibrarySymbol(sym) {
      hookGlobalSymbolAccess(sym, () => {
        // Can't `abort()` here because it would break code that does runtime
        // checks.  e.g. `if (typeof SDL === 'undefined')`.
        var msg = `\`${sym}\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line`
        // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
        // library.js, which means $name for a JS name with no prefix, or name
        // for a JS name like _name.
        var librarySymbol = sym
        if (!librarySymbol.startsWith('_')) {
          librarySymbol = '$' + sym
        }
        msg += ` (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='${librarySymbol}')`
        if (isExportedByForceFilesystem(sym)) {
          msg +=
            '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you'
        }
        warnOnce(msg)
      })
      // Any symbol that is not included from the JS library is also (by definition)
      // not exported on the Module object.
      unexportedRuntimeSymbol(sym)
    }

    function unexportedRuntimeSymbol(sym) {
      if (!Object.getOwnPropertyDescriptor(Module, sym)) {
        Object.defineProperty(Module, sym, {
          configurable: true,
          get() {
            var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`
            if (isExportedByForceFilesystem(sym)) {
              msg +=
                '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you'
            }
            abort(msg)
          },
        })
      }
    }

    var runtimeDebug = true

    // end include: runtime_debug.js
    // include: memoryprofiler.js
    // end include: memoryprofiler.js
    function updateMemoryViews() {
      var b = wasmMemory.buffer
      Module['HEAP8'] = HEAP8 = new Int8Array(b)
      HEAP16 = new Int16Array(b)
      HEAPU8 = new Uint8Array(b)
      HEAPU16 = new Uint16Array(b)
      HEAP32 = new Int32Array(b)
      HEAPU32 = new Uint32Array(b)
      HEAPF32 = new Float32Array(b)
      HEAPF64 = new Float64Array(b)
      HEAP64 = new BigInt64Array(b)
      HEAPU64 = new BigUint64Array(b)
      Module['HEAP_DATA_VIEW'] = HEAP_DATA_VIEW = new DataView(b)
      LE_HEAP_UPDATE()
    }

    // end include: runtime_shared.js
    assert(
      !Module['STACK_SIZE'],
      'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time'
    )

    assert(
      typeof Int32Array != 'undefined' &&
        typeof Float64Array !== 'undefined' &&
        Int32Array.prototype.subarray != undefined &&
        Int32Array.prototype.set != undefined,
      'JS engine does not provide full typed array support'
    )

    // In non-standalone/normal mode, we create the memory here.
    // include: runtime_init_memory.js
    // Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)
    // check for full engine support (use string 'subarray' to avoid closure compiler confusion)
    {
      var INITIAL_MEMORY = 16777216
      legacyModuleProp('INITIAL_MEMORY', 'INITIAL_MEMORY')
      assert(
        INITIAL_MEMORY >= 65536,
        'INITIAL_MEMORY should be larger than STACK_SIZE, was ' +
          INITIAL_MEMORY +
          '! (STACK_SIZE=' +
          65536 +
          ')'
      )
      /** @suppress {checkTypes} */ wasmMemory = new WebAssembly.Memory({
        initial: INITIAL_MEMORY / 65536,
        // In theory we should not need to emit the maximum if we want "unlimited"
        // or 4GB of memory, but VMs error on that atm, see
        // https://github.com/emscripten-core/emscripten/issues/14130
        // And in the pthreads case we definitely need to emit a maximum. So
        // always emit one.
        maximum: 32768,
      })
    }

    updateMemoryViews()

    // end include: runtime_init_memory.js
    var __RELOC_FUNCS__ = []

    function preRun() {}

    function initRuntime() {
      assert(!runtimeInitialized)
      runtimeInitialized = true
      checkStackCookie()
      setStackLimits()
      callRuntimeCallbacks(__RELOC_FUNCS__)
    }

    function preMain() {
      checkStackCookie()
    }

    function postRun() {
      checkStackCookie()
    }

    // A counter of dependencies for calling run(). If we need to
    // do asynchronous work before running, increment this and
    // decrement it. Incrementing must happen in a place like
    // Module.preRun (used by emcc to add file preloading).
    // Note that you can add dependencies in preRun, even though
    // it happens right before run - run will be postponed until
    // the dependencies are met.
    var runDependencies = 0

    var dependenciesFulfilled = null

    // overridden to take different actions when all run dependencies are fulfilled
    var runDependencyTracking = {}

    var runDependencyWatcher = null

    function addRunDependency(id) {
      runDependencies++
      if (id) {
        assert(!runDependencyTracking[id])
        runDependencyTracking[id] = 1
        if (runDependencyWatcher === null && typeof setInterval != 'undefined') {
          // Check for missing dependencies every few seconds
          runDependencyWatcher = setInterval(() => {
            if (ABORT) {
              clearInterval(runDependencyWatcher)
              runDependencyWatcher = null
              return
            }
            var shown = false
            for (var dep in runDependencyTracking) {
              if (!shown) {
                shown = true
                err('still waiting on run dependencies:')
              }
              err(`dependency: ${dep}`)
            }
            if (shown) {
              err('(end of list)')
            }
          }, 1e4)
        }
      } else {
        err('warning: run dependency added without ID')
      }
    }

    function removeRunDependency(id) {
      runDependencies--
      if (id) {
        assert(runDependencyTracking[id])
        delete runDependencyTracking[id]
      } else {
        err('warning: run dependency removed without ID')
      }
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher)
          runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled
          dependenciesFulfilled = null
          callback()
        }
      }
    }

    /** @param {string|number=} what */ function abort(what) {
      what = 'Aborted(' + what + ')'
      // TODO(sbc): Should we remove printing and leave it up to whoever
      // catches the exception?
      err(what)
      ABORT = true
      // Use a wasm runtime error, because a JS error might be seen as a foreign
      // exception, which means we'd run destructors on it. We need the error to
      // simply make the program stop.
      // FIXME This approach does not work in Wasm EH because it currently does not assume
      // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
      // a trap or not based on a hidden field within the object. So at the moment
      // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
      // allows this in the wasm spec.
      // Suppress closure compiler warning here. Closure compiler's builtin extern
      // definition for WebAssembly.RuntimeError claims it takes no arguments even
      // though it can.
      // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
      // See above, in the meantime, we resort to wasm code for trapping.
      // In case abort() is called before the module is initialized, wasmExports
      // and its exported '__trap' function is not available, in which case we throw
      // a RuntimeError.
      // We trap instead of throwing RuntimeError to prevent infinite-looping in
      // Wasm EH code (because RuntimeError is considered as a foreign exception and
      // caught by 'catch_all'), but in case throwing RuntimeError is fine because
      // the module has not even been instantiated, even less running.
      if (runtimeInitialized) {
        ___trap()
      }
      /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what)
      readyPromiseReject(e)
      // Throw the error whether or not MODULARIZE is set because abort is used
      // in code paths apart from instantiation where an exception is expected
      // to be thrown when abort is called.
      throw e
    }

    // show errors on likely calls to FS when it was not included
    var FS = {
      error() {
        abort(
          'Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM'
        )
      },
      init() {
        FS.error()
      },
      createDataFile() {
        FS.error()
      },
      createPreloadedFile() {
        FS.error()
      },
      createLazyFile() {
        FS.error()
      },
      open() {
        FS.error()
      },
      mkdev() {
        FS.error()
      },
      registerDevice() {
        FS.error()
      },
      analyzePath() {
        FS.error()
      },
      ErrnoError() {
        FS.error()
      },
    }

    Module['FS_createDataFile'] = FS.createDataFile

    Module['FS_createPreloadedFile'] = FS.createPreloadedFile

    function createExportWrapper(name, nargs) {
      return (...args) => {
        assert(
          runtimeInitialized,
          `native function \`${name}\` called before runtime initialization`
        )
        var f = wasmExports[name]
        assert(f, `exported native function \`${name}\` not found`)
        // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
        assert(
          args.length <= nargs,
          `native function \`${name}\` called with ${args.length} args but expects ${nargs}`
        )
        return f(...args)
      }
    }

    var wasmBinaryFile

    function findWasmBinary() {
      if (Module['locateFile']) {
        return locateFile('libarchive.wasm')
      }
      // Use bundler-friendly `new URL(..., import.meta.url)` pattern; works in browsers too.
      return new URL('libarchive.wasm', import.meta.url).href
    }

    function getBinarySync(file) {
      if (file == wasmBinaryFile && wasmBinary) {
        return new Uint8Array(wasmBinary)
      }
      if (readBinary) {
        return readBinary(file)
      }
      throw 'both async and sync fetching of the wasm failed'
    }

    async function getWasmBinary(binaryFile) {
      // If we don't have the binary yet, load it asynchronously using readAsync.
      if (!wasmBinary) {
        // Fetch the binary using readAsync
        try {
          var response = await readAsync(binaryFile)
          return new Uint8Array(response)
        } catch {}
      }
      // Otherwise, getBinarySync should be able to get it synchronously
      return getBinarySync(binaryFile)
    }

    async function instantiateArrayBuffer(binaryFile, imports) {
      try {
        var binary = await getWasmBinary(binaryFile)
        var instance = await WebAssembly.instantiate(binary, imports)
        return instance
      } catch (reason) {
        err(`failed to asynchronously prepare wasm: ${reason}`)
        // Warn on some common problems.
        if (isFileURI(wasmBinaryFile)) {
          err(
            `warning: Loading from a file URI (${wasmBinaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`
          )
        }
        abort(reason)
      }
    }

    async function instantiateAsync(binary, binaryFile, imports) {
      if (
        !binary &&
        typeof WebAssembly.instantiateStreaming == 'function' &&
        !isFileURI(binaryFile) &&
        !ENVIRONMENT_IS_NODE
      ) {
        try {
          var response = fetch(binaryFile, {
            credentials: 'same-origin',
          })
          var instantiationResult = await WebAssembly.instantiateStreaming(response, imports)
          return instantiationResult
        } catch (reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          err(`wasm streaming compile failed: ${reason}`)
          err('falling back to ArrayBuffer instantiation')
        }
      }
      return instantiateArrayBuffer(binaryFile, imports)
    }

    function getWasmImports() {
      // prepare imports
      return {
        'env': wasmImports,
        'wasi_snapshot_preview1': wasmImports,
        'GOT.mem': new Proxy(wasmImports, GOTHandler),
        'GOT.func': new Proxy(wasmImports, GOTHandler),
      }
    }

    // Create the wasm instance.
    // Receives the wasm imports, returns the exports.
    async function createWasm() {
      // Load the wasm module and create an instance of using native support in the JS engine.
      // handle a generated wasm instance, receiving its exports and
      // performing other necessary setup
      /** @param {WebAssembly.Module=} module*/ function receiveInstance(instance, module) {
        wasmExports = instance.exports
        wasmExports = relocateExports(wasmExports, 1024)
        reportUndefinedSymbols()
        __RELOC_FUNCS__.push(wasmExports['__wasm_apply_data_relocs'])
        removeRunDependency('wasm-instantiate')
        return wasmExports
      }
      // wait for the pthread pool (if any)
      addRunDependency('wasm-instantiate')
      // Prefer streaming instantiation if available.
      // Async compilation can be confusing when an error on the page overwrites Module
      // (for example, if the order of elements is wrong, and the one defining Module is
      // later), so we save Module and check it later.
      var trueModule = Module
      function receiveInstantiationResult(result) {
        // 'result' is a ResultObject object which has both the module and instance.
        // receiveInstance() will swap in the exports (to Module.asm) so they can be called
        assert(
          Module === trueModule,
          'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?'
        )
        trueModule = null
        return receiveInstance(result['instance'], result['module'])
      }
      var info = getWasmImports()
      wasmBinaryFile ??= findWasmBinary()
      try {
        var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info)
        var exports = receiveInstantiationResult(result)
        return exports
      } catch (e) {
        // If instantiation fails, reject the module ready promise.
        readyPromiseReject(e)
        return Promise.reject(e)
      }
    }

    // end include: preamble.js
    // Begin JS library code
    class ExitStatus {
      name = 'ExitStatus'
      constructor(status) {
        this.message = `Program terminated with exit(${status})`
        this.status = status
      }
    }

    var GOT = {}

    var currentModuleWeakSymbols = new Set([])

    var GOTHandler = {
      get(obj, symName) {
        var rtn = GOT[symName]
        if (!rtn) {
          rtn = GOT[symName] = new WebAssembly.Global({
            value: 'i32',
            mutable: true,
          })
        }
        if (!currentModuleWeakSymbols.has(symName)) {
          // Any non-weak reference to a symbol marks it as `required`, which
          // enabled `reportUndefinedSymbols` to report undefined symbol errors
          // correctly.
          rtn.required = true
        }
        return rtn
      },
    }

    var LE_ATOMICS_NATIVE_BYTE_ORDER = []

    var LE_HEAP_LOAD_F32 = byteOffset => HEAP_DATA_VIEW.getFloat32(byteOffset, true)

    var LE_HEAP_LOAD_F64 = byteOffset => HEAP_DATA_VIEW.getFloat64(byteOffset, true)

    var LE_HEAP_LOAD_I16 = byteOffset => HEAP_DATA_VIEW.getInt16(byteOffset, true)

    var LE_HEAP_LOAD_I32 = byteOffset => HEAP_DATA_VIEW.getInt32(byteOffset, true)

    var LE_HEAP_LOAD_U32 = byteOffset => HEAP_DATA_VIEW.getUint32(byteOffset, true)

    var LE_HEAP_STORE_F32 = (byteOffset, value) =>
      HEAP_DATA_VIEW.setFloat32(byteOffset, value, true)

    var LE_HEAP_STORE_F64 = (byteOffset, value) =>
      HEAP_DATA_VIEW.setFloat64(byteOffset, value, true)

    var LE_HEAP_STORE_I16 = (byteOffset, value) => HEAP_DATA_VIEW.setInt16(byteOffset, value, true)

    var LE_HEAP_STORE_I32 = (byteOffset, value) => HEAP_DATA_VIEW.setInt32(byteOffset, value, true)

    var LE_HEAP_STORE_U32 = (byteOffset, value) => HEAP_DATA_VIEW.setUint32(byteOffset, value, true)

    var callRuntimeCallbacks = callbacks => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module)
      }
    }

    var ptrToString = ptr => {
      assert(typeof ptr === 'number')
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      ptr >>>= 0
      return '0x' + ptr.toString(16).padStart(8, '0')
    }

    var isInternalSym = symName =>
      [
        '__cpp_exception',
        '__c_longjmp',
        '__wasm_apply_data_relocs',
        '__dso_handle',
        '__tls_size',
        '__tls_align',
        '__set_stack_limits',
        '_emscripten_tls_init',
        '__wasm_init_tls',
        '__wasm_call_ctors',
        '__start_em_asm',
        '__stop_em_asm',
        '__start_em_js',
        '__stop_em_js',
      ].includes(symName) || symName.startsWith('__em_js__')

    var uleb128Encode = (n, target) => {
      assert(n < 16384)
      if (n < 128) {
        target.push(n)
      } else {
        target.push(n % 128 | 128, n >> 7)
      }
    }

    var sigToWasmTypes = sig => {
      var typeNames = {
        i: 'i32',
        j: 'i64',
        f: 'f32',
        d: 'f64',
        e: 'externref',
        p: 'i32',
      }
      var type = {
        parameters: [],
        results: sig[0] == 'v' ? [] : [typeNames[sig[0]]],
      }
      for (var i = 1; i < sig.length; ++i) {
        assert(sig[i] in typeNames, 'invalid signature char: ' + sig[i])
        type.parameters.push(typeNames[sig[i]])
      }
      return type
    }

    var generateFuncType = (sig, target) => {
      var sigRet = sig.slice(0, 1)
      var sigParam = sig.slice(1)
      var typeCodes = {
        i: 127,
        // i32
        p: 127,
        // i32
        j: 126,
        // i64
        f: 125,
        // f32
        d: 124,
        // f64
        e: 111,
      }
      // Parameters, length + signatures
      target.push(96)
      uleb128Encode(sigParam.length, target)
      for (var paramType of sigParam) {
        assert(paramType in typeCodes, `invalid signature char: ${paramType}`)
        target.push(typeCodes[paramType])
      }
      // Return values, length + signatures
      // With no multi-return in MVP, either 0 (void) or 1 (anything else)
      if (sigRet == 'v') {
        target.push(0)
      } else {
        target.push(1, typeCodes[sigRet])
      }
    }

    var convertJsFunctionToWasm = (func, sig) => {
      // If the type reflection proposal is available, use the new
      // "WebAssembly.Function" constructor.
      // Otherwise, construct a minimal wasm module importing the JS function and
      // re-exporting it.
      if (typeof WebAssembly.Function == 'function') {
        return new WebAssembly.Function(sigToWasmTypes(sig), func)
      }
      // The module is static, with the exception of the type section, which is
      // generated based on the signature passed in.
      var typeSectionBody = [1]
      generateFuncType(sig, typeSectionBody)
      // Rest of the module is static
      var bytes = [
        0,
        97,
        115,
        109, // magic ("\0asm")
        1,
        0,
        0,
        0, // version: 1
        1,
      ]
      // Write the overall length of the type section followed by the body
      uleb128Encode(typeSectionBody.length, bytes)
      bytes.push(...typeSectionBody)
      // The rest of the module is static
      bytes.push(
        2,
        7, // import section
        // (import "e" "f" (func 0 (type 0)))
        1,
        1,
        101,
        1,
        102,
        0,
        0,
        7,
        5, // export section
        // (export "f" (func 0 (type 0)))
        1,
        1,
        102,
        0,
        0
      )
      // We can compile this wasm module synchronously because it is very small.
      // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
      var module = new WebAssembly.Module(new Uint8Array(bytes))
      var instance = new WebAssembly.Instance(module, {
        e: {
          f: func,
        },
      })
      var wrappedFunc = instance.exports['f']
      return wrappedFunc
    }

    /** @type {WebAssembly.Table} */ var wasmTable = new WebAssembly.Table({
      initial: 263,
      element: 'anyfunc',
    })

    /** @suppress{checkTypes} */ var getWasmTableEntry = funcPtr => wasmTable.get(funcPtr)

    var updateTableMap = (offset, count) => {
      if (functionsInTableMap) {
        for (var i = offset; i < offset + count; i++) {
          var item = getWasmTableEntry(i)
          // Ignore null values.
          if (item) {
            functionsInTableMap.set(item, i)
          }
        }
      }
    }

    var functionsInTableMap

    var getFunctionAddress = func => {
      // First, create the map if this is the first use.
      if (!functionsInTableMap) {
        functionsInTableMap = new WeakMap()
        updateTableMap(0, wasmTable.length)
      }
      return functionsInTableMap.get(func) || 0
    }

    var freeTableIndexes = []

    var getEmptyTableSlot = () => {
      // Reuse a free index if there is one, otherwise grow.
      if (freeTableIndexes.length) {
        return freeTableIndexes.pop()
      }
      // Grow the table
      try {
        /** @suppress {checkTypes} */ wasmTable.grow(1)
      } catch (err) {
        if (!(err instanceof RangeError)) {
          throw err
        }
        throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.'
      }
      return wasmTable.length - 1
    }

    /** @suppress{checkTypes} */ var setWasmTableEntry = (idx, func) => wasmTable.set(idx, func)

    /** @param {string=} sig */ var addFunction = (func, sig) => {
      assert(typeof func != 'undefined')
      // Check if the function is already in the table, to ensure each function
      // gets a unique index.
      var rtn = getFunctionAddress(func)
      if (rtn) {
        return rtn
      }
      // It's not in the table, add it now.
      var ret = getEmptyTableSlot()
      // Set the new value.
      try {
        // Attempting to call this with JS function will cause of table.set() to fail
        setWasmTableEntry(ret, func)
      } catch (err) {
        if (!(err instanceof TypeError)) {
          throw err
        }
        assert(typeof sig != 'undefined', 'Missing signature argument to addFunction: ' + func)
        var wrapped = convertJsFunctionToWasm(func, sig)
        setWasmTableEntry(ret, wrapped)
      }
      functionsInTableMap.set(func, ret)
      return ret
    }

    var updateGOT = (exports, replace) => {
      for (var symName in exports) {
        if (isInternalSym(symName)) {
          continue
        }
        var value = exports[symName]
        GOT[symName] ||= new WebAssembly.Global({
          value: 'i32',
          mutable: true,
        })
        if (replace || GOT[symName].value == 0) {
          if (typeof value == 'function') {
            GOT[symName].value = addFunction(value)
          } else if (typeof value == 'number') {
            GOT[symName].value = value
          } else {
            err(`unhandled export type for '${symName}': ${typeof value}`)
          }
        }
      }
    }

    /** @param {boolean=} replace */ var relocateExports = (exports, memoryBase, replace) => {
      var relocated = {}
      for (var e in exports) {
        var value = exports[e]
        if (typeof value == 'object') {
          // a breaking change in the wasm spec, globals are now objects
          // https://github.com/WebAssembly/mutable-global/issues/1
          value = value.value
        }
        if (typeof value == 'number') {
          value += memoryBase
        }
        relocated[e] = value
      }
      updateGOT(relocated, replace)
      return relocated
    }

    var isSymbolDefined = symName => {
      // Ignore 'stub' symbols that are auto-generated as part of the original
      // `wasmImports` used to instantiate the main module.
      var existing = wasmImports[symName]
      if (!existing || existing.stub) {
        return false
      }
      return true
    }

    var resolveGlobalSymbol = (symName, direct = false) => {
      var sym
      if (isSymbolDefined(symName)) {
        sym = wasmImports[symName]
      }
      return {
        sym,
        name: symName,
      }
    }

    var reportUndefinedSymbols = () => {
      for (var [symName, entry] of Object.entries(GOT)) {
        if (entry.value == 0) {
          var value = resolveGlobalSymbol(symName, true).sym
          if (!value && !entry.required) {
            // Ignore undefined symbols that are imported as weak.
            continue
          }
          assert(
            value,
            `undefined symbol '${symName}'. perhaps a side module was not linked in? if this global was expected to arrive from a system library, try to build the MAIN_MODULE with EMCC_FORCE_STDLIBS=1 in the environment`
          )
          if (typeof value == 'function') {
            /** @suppress {checkTypes} */ entry.value = addFunction(value, value.sig)
          } else if (typeof value == 'number') {
            entry.value = value
          } else {
            throw new Error(`bad export type for '${symName}': ${typeof value}`)
          }
        }
      }
    }

    var setStackLimits = () => {
      var stackLow = _emscripten_stack_get_base()
      var stackHigh = _emscripten_stack_get_end()
      ___set_stack_limits(stackLow, stackHigh)
    }

    var warnOnce = text => {
      warnOnce.shown ||= {}
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1
        if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text
        err(text)
      }
    }

    var ___heap_base = 152880

    var ___memory_base = new WebAssembly.Global(
      {
        value: 'i32',
        mutable: false,
      },
      1024
    )

    var ___stack_high = 152880

    var ___stack_low = 87344

    var ___stack_pointer = new WebAssembly.Global(
      {
        value: 'i32',
        mutable: true,
      },
      152880
    )

    var ___table_base = new WebAssembly.Global(
      {
        value: 'i32',
        mutable: false,
      },
      1
    )

    var _emscripten_notify_memory_growth = memoryIndex => {
      assert(memoryIndex == 0)
      updateMemoryViews()
    }

    _emscripten_notify_memory_growth.sig = 'vp'

    var ENV = {}

    var getExecutableName = () => thisProgram || './this.program'

    var getEnvStrings = () => {
      if (!getEnvStrings.strings) {
        // Default values.
        // Browser language detection #8751
        var lang =
          (
            (typeof navigator == 'object' && navigator.languages && navigator.languages[0]) ||
            'C'
          ).replace('-', '_') + '.UTF-8'
        var env = {
          USER: 'web_user',
          LOGNAME: 'web_user',
          PATH: '/',
          PWD: '/',
          HOME: '/home/web_user',
          LANG: lang,
          _: getExecutableName(),
        }
        // Apply the user-provided values, if any.
        for (var x in ENV) {
          // x is a key in ENV; if ENV[x] is undefined, that means it was
          // explicitly set to be so. We allow user code to do that to
          // force variables with default values to remain unset.
          if (ENV[x] === undefined) delete env[x]
          else env[x] = ENV[x]
        }
        var strings = []
        for (var x in env) {
          strings.push(`${x}=${env[x]}`)
        }
        getEnvStrings.strings = strings
      }
      return getEnvStrings.strings
    }

    var stringToAscii = (str, buffer) => {
      for (var i = 0; i < str.length; ++i) {
        assert(str.charCodeAt(i) === (str.charCodeAt(i) & 255))
        HEAP8[buffer++] = str.charCodeAt(i)
      }
      // Null-terminate the string
      HEAP8[buffer] = 0
    }

    var _environ_get = (__environ, environ_buf) => {
      var bufSize = 0
      getEnvStrings().forEach((string, i) => {
        var ptr = environ_buf + bufSize
        LE_HEAP_STORE_U32(((__environ + i * 4) >> 2) * 4, ptr)
        stringToAscii(string, ptr)
        bufSize += string.length + 1
      })
      return 0
    }

    _environ_get.sig = 'ipp'

    var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
      var strings = getEnvStrings()
      LE_HEAP_STORE_U32((penviron_count >> 2) * 4, strings.length)
      var bufSize = 0
      strings.forEach(string => (bufSize += string.length + 1))
      LE_HEAP_STORE_U32((penviron_buf_size >> 2) * 4, bufSize)
      return 0
    }

    _environ_sizes_get.sig = 'ipp'

    var UTF8Decoder = new TextDecoder()

    /**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */ var UTF8ToString = (ptr, maxBytesToRead) => {
      assert(typeof ptr == 'number', `UTF8ToString expects a number (got ${typeof ptr})`)
      if (!ptr) return ''
      var maxPtr = ptr + maxBytesToRead
      for (var end = ptr; !(end >= maxPtr) && HEAPU8[end]; ) ++end
      return UTF8Decoder.decode(HEAPU8.subarray(ptr, end))
    }

    var _fd_close = fd => {
      abort('fd_close called without SYSCALLS_REQUIRE_FILESYSTEM')
    }

    _fd_close.sig = 'ii'

    var _fd_read = (fd, iov, iovcnt, pnum) => {
      abort('fd_read called without SYSCALLS_REQUIRE_FILESYSTEM')
    }

    _fd_read.sig = 'iippp'

    var INT53_MAX = 9007199254740992

    var INT53_MIN = -9007199254740992

    var bigintToI53Checked = num => (num < INT53_MIN || num > INT53_MAX ? NaN : Number(num))

    function _fd_seek(fd, offset, whence, newOffset) {
      offset = bigintToI53Checked(offset)
      return 70
    }

    _fd_seek.sig = 'iijip'

    var printCharBuffers = [null, [], []]

    /**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number=} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead = NaN) => {
      var endIdx = idx + maxBytesToRead
      var endPtr = idx
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.  Also, use the length info to avoid running tiny
      // strings through TextDecoder, since .subarray() allocates garbage.
      // (As a tiny code save trick, compare endPtr against endIdx using a negation,
      // so that undefined/NaN means Infinity)
      while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr
      return UTF8Decoder.decode(
        heapOrArray.buffer
          ? heapOrArray.subarray(idx, endPtr)
          : new Uint8Array(heapOrArray.slice(idx, endPtr))
      )
    }

    var printChar = (stream, curr) => {
      var buffer = printCharBuffers[stream]
      assert(buffer)
      if (curr === 0 || curr === 10) {
        ;(stream === 1 ? out : err)(UTF8ArrayToString(buffer))
        buffer.length = 0
      } else {
        buffer.push(curr)
      }
    }

    var flush_NO_FILESYSTEM = () => {
      // flush anything remaining in the buffers during shutdown
      if (printCharBuffers[1].length) printChar(1, 10)
      if (printCharBuffers[2].length) printChar(2, 10)
    }

    var _fd_write = (fd, iov, iovcnt, pnum) => {
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var num = 0
      for (var i = 0; i < iovcnt; i++) {
        var ptr = LE_HEAP_LOAD_U32((iov >> 2) * 4)
        var len = LE_HEAP_LOAD_U32(((iov + 4) >> 2) * 4)
        iov += 8
        for (var j = 0; j < len; j++) {
          printChar(fd, HEAPU8[ptr + j])
        }
        num += len
      }
      LE_HEAP_STORE_U32((pnum >> 2) * 4, num)
      return 0
    }

    _fd_write.sig = 'iippp'

    var keepRuntimeAlive = () => true

    var _proc_exit = code => {
      EXITSTATUS = code
      if (!keepRuntimeAlive()) {
        ABORT = true
      }
      quit_(code, new ExitStatus(code))
    }

    _proc_exit.sig = 'vi'

    var runtimeKeepaliveCounter = 0

    /** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
      EXITSTATUS = status
      checkUnflushedContent()
      // if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
      if (keepRuntimeAlive() && !implicit) {
        var msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`
        readyPromiseReject(msg)
        err(msg)
      }
      _proc_exit(status)
    }

    var handleException = e => {
      // Certain exception types we do not treat as errors since they are used for
      // internal control flow.
      // 1. ExitStatus, which is thrown by exit()
      // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
      //    that wish to return to JS event loop.
      if (e instanceof ExitStatus || e == 'unwind') {
        return EXITSTATUS
      }
      checkStackCookie()
      if (e instanceof WebAssembly.RuntimeError) {
        if (_emscripten_stack_get_current() <= 0) {
          err(
            'Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 65536)'
          )
        }
      }
      quit_(1, e)
    }

    var getCFunc = ident => {
      var func = Module['_' + ident]
      // closure exported function
      assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported')
      return func
    }

    var writeArrayToMemory = (array, buffer) => {
      assert(
        array.length >= 0,
        'writeArrayToMemory array must have a length (should be an array or typed array)'
      )
      HEAP8.set(array, buffer)
    }

    var lengthBytesUTF8 = str => {
      var len = 0
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var c = str.charCodeAt(i)
        // possibly a lead surrogate
        if (c <= 127) {
          len++
        } else if (c <= 2047) {
          len += 2
        } else if (c >= 55296 && c <= 57343) {
          len += 4
          ++i
        } else {
          len += 3
        }
      }
      return len
    }

    var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      assert(typeof str === 'string', `stringToUTF8Array expects a string (got ${typeof str})`)
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0)) return 0
      var startIdx = outIdx
      var endIdx = outIdx + maxBytesToWrite - 1
      // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.charCodeAt(i)
        // possibly a lead surrogate
        if (u >= 55296 && u <= 57343) {
          var u1 = str.charCodeAt(++i)
          u = (65536 + ((u & 1023) << 10)) | (u1 & 1023)
        }
        if (u <= 127) {
          if (outIdx >= endIdx) break
          heap[outIdx++] = u
        } else if (u <= 2047) {
          if (outIdx + 1 >= endIdx) break
          heap[outIdx++] = 192 | (u >> 6)
          heap[outIdx++] = 128 | (u & 63)
        } else if (u <= 65535) {
          if (outIdx + 2 >= endIdx) break
          heap[outIdx++] = 224 | (u >> 12)
          heap[outIdx++] = 128 | ((u >> 6) & 63)
          heap[outIdx++] = 128 | (u & 63)
        } else {
          if (outIdx + 3 >= endIdx) break
          if (u > 1114111)
            warnOnce(
              'Invalid Unicode code point ' +
                ptrToString(u) +
                ' encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).'
            )
          heap[outIdx++] = 240 | (u >> 18)
          heap[outIdx++] = 128 | ((u >> 12) & 63)
          heap[outIdx++] = 128 | ((u >> 6) & 63)
          heap[outIdx++] = 128 | (u & 63)
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0
      return outIdx - startIdx
    }

    var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(
        typeof maxBytesToWrite == 'number',
        'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!'
      )
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
    }

    var stackAlloc = sz => __emscripten_stack_alloc(sz)

    var stringToUTF8OnStack = str => {
      var size = lengthBytesUTF8(str) + 1
      var ret = stackAlloc(size)
      stringToUTF8(str, ret, size)
      return ret
    }

    var stackSave = () => _emscripten_stack_get_current()

    var stackRestore = val => __emscripten_stack_restore(val)

    /**
     * @param {string|null=} returnType
     * @param {Array=} argTypes
     * @param {Arguments|Array=} args
     * @param {Object=} opts
     */ var ccall = (ident, returnType, argTypes, args, opts) => {
      // For fast lookup of conversion functions
      var toC = {
        string: str => {
          var ret = 0
          if (str !== null && str !== undefined && str !== 0) {
            // null string
            ret = stringToUTF8OnStack(str)
          }
          return ret
        },
        array: arr => {
          var ret = stackAlloc(arr.length)
          writeArrayToMemory(arr, ret)
          return ret
        },
      }
      function convertReturnValue(ret) {
        if (returnType === 'string') {
          return UTF8ToString(ret)
        }
        if (returnType === 'boolean') return Boolean(ret)
        return ret
      }
      var func = getCFunc(ident)
      var cArgs = []
      var stack = 0
      assert(returnType !== 'array', 'Return type should not be "array".')
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]]
          if (converter) {
            if (stack === 0) stack = stackSave()
            cArgs[i] = converter(args[i])
          } else {
            cArgs[i] = args[i]
          }
        }
      }
      var ret = func(...cArgs)
      function onDone(ret) {
        if (stack !== 0) stackRestore(stack)
        return convertReturnValue(ret)
      }
      ret = onDone(ret)
      return ret
    }

    /**
     * @param {string=} returnType
     * @param {Array=} argTypes
     * @param {Object=} opts
     */ var cwrap =
      (ident, returnType, argTypes, opts) =>
      (...args) =>
        ccall(ident, returnType, argTypes, args, opts)

    LE_ATOMICS_NATIVE_BYTE_ORDER =
      new Int8Array(new Int16Array([1]).buffer)[0] === 1
        ? [/* little endian */ x => x, x => x, undefined, x => x]
        : [
            /* big endian */ x => x,
            x => (((x & 65280) << 8) | ((x & 255) << 24)) >> 16,
            undefined,
            x => ((x >> 24) & 255) | ((x >> 8) & 65280) | ((x & 65280) << 8) | ((x & 255) << 24),
          ]

    function LE_HEAP_UPDATE() {
      HEAPU16.unsigned = x => x & 65535
      HEAPU32.unsigned = x => x >>> 0
    }

    // End JS library code
    function checkIncomingModuleAPI() {
      ignoredModuleProp('ENVIRONMENT')
      ignoredModuleProp('GL_MAX_TEXTURE_IMAGE_UNITS')
      ignoredModuleProp('SDL_canPlayWithWebAudio')
      ignoredModuleProp('SDL_numSimultaneouslyQueuedBuffers')
      ignoredModuleProp('INITIAL_MEMORY')
      ignoredModuleProp('wasmMemory')
      ignoredModuleProp('arguments')
      ignoredModuleProp('buffer')
      ignoredModuleProp('canvas')
      ignoredModuleProp('doNotCaptureKeyboard')
      ignoredModuleProp('dynamicLibraries')
      ignoredModuleProp('elementPointerLock')
      ignoredModuleProp('extraStackTrace')
      ignoredModuleProp('forcedAspectRatio')
      ignoredModuleProp('instantiateWasm')
      ignoredModuleProp('keyboardListeningElement')
      ignoredModuleProp('freePreloadedMediaOnUse')
      ignoredModuleProp('loadSplitModule')
      ignoredModuleProp('locateFile')
      ignoredModuleProp('logReadFiles')
      ignoredModuleProp('mainScriptUrlOrBlob')
      ignoredModuleProp('mem')
      ignoredModuleProp('monitorRunDependencies')
      ignoredModuleProp('noExitRuntime')
      ignoredModuleProp('noInitialRun')
      ignoredModuleProp('onAbort')
      ignoredModuleProp('onCustomMessage')
      ignoredModuleProp('onExit')
      ignoredModuleProp('onFree')
      ignoredModuleProp('onFullScreen')
      ignoredModuleProp('onMalloc')
      ignoredModuleProp('onRealloc')
      ignoredModuleProp('onRuntimeInitialized')
      ignoredModuleProp('postMainLoop')
      ignoredModuleProp('postRun')
      ignoredModuleProp('preInit')
      ignoredModuleProp('preMainLoop')
      ignoredModuleProp('preRun')
      ignoredModuleProp('preinitializedWebGLContext')
      ignoredModuleProp('preloadPlugins')
      ignoredModuleProp('print')
      ignoredModuleProp('printErr')
      ignoredModuleProp('setStatus')
      ignoredModuleProp('statusMessage')
      ignoredModuleProp('stderr')
      ignoredModuleProp('stdin')
      ignoredModuleProp('stdout')
      ignoredModuleProp('thisProgram')
      ignoredModuleProp('wasm')
      ignoredModuleProp('wasmBinary')
      ignoredModuleProp('websocket')
      ignoredModuleProp('fetchSettings')
    }

    var wasmImports = {
      /** @export */ __heap_base: ___heap_base,
      /** @export */ __indirect_function_table: wasmTable,
      /** @export */ __memory_base: ___memory_base,
      /** @export */ __stack_high: ___stack_high,
      /** @export */ __stack_low: ___stack_low,
      /** @export */ __stack_pointer: ___stack_pointer,
      /** @export */ __table_base: ___table_base,
      /** @export */ emscripten_notify_memory_growth: _emscripten_notify_memory_growth,
      /** @export */ environ_get: _environ_get,
      /** @export */ environ_sizes_get: _environ_sizes_get,
      /** @export */ fd_close: _fd_close,
      /** @export */ fd_read: _fd_read,
      /** @export */ fd_seek: _fd_seek,
      /** @export */ fd_write: _fd_write,
      /** @export */ memory: wasmMemory,
      /** @export */ proc_exit: _proc_exit,
    }

    var wasmExports = await createWasm()

    var _archive_clear_error = (Module['_archive_clear_error'] = createExportWrapper(
      'archive_clear_error',
      1
    ))

    var _open_archive = (Module['_open_archive'] = createExportWrapper('open_archive', 4))

    var _archive_error_string = (Module['_archive_error_string'] = createExportWrapper(
      'archive_error_string',
      1
    ))

    var _get_next_entry = (Module['_get_next_entry'] = createExportWrapper('get_next_entry', 1))

    var _get_filedata = (Module['_get_filedata'] = createExportWrapper('get_filedata', 2))

    var _malloc = (Module['_malloc'] = createExportWrapper('malloc', 1))

    var _free = (Module['_free'] = createExportWrapper('free', 1))

    var _archive_entry_atime = (Module['_archive_entry_atime'] = createExportWrapper(
      'archive_entry_atime',
      1
    ))

    var _archive_entry_birthtime = (Module['_archive_entry_birthtime'] = createExportWrapper(
      'archive_entry_birthtime',
      1
    ))

    var _archive_entry_ctime = (Module['_archive_entry_ctime'] = createExportWrapper(
      'archive_entry_ctime',
      1
    ))

    var _archive_entry_hardlink = (Module['_archive_entry_hardlink'] = createExportWrapper(
      'archive_entry_hardlink',
      1
    ))

    var _archive_entry_hardlink_utf8 = (Module['_archive_entry_hardlink_utf8'] =
      createExportWrapper('archive_entry_hardlink_utf8', 1))

    var _archive_entry_mode = (Module['_archive_entry_mode'] = createExportWrapper(
      'archive_entry_mode',
      1
    ))

    var _archive_entry_mtime = (Module['_archive_entry_mtime'] = createExportWrapper(
      'archive_entry_mtime',
      1
    ))

    var _archive_entry_pathname = (Module['_archive_entry_pathname'] = createExportWrapper(
      'archive_entry_pathname',
      1
    ))

    var _archive_entry_pathname_utf8 = (Module['_archive_entry_pathname_utf8'] =
      createExportWrapper('archive_entry_pathname_utf8', 1))

    var _archive_entry_size = (Module['_archive_entry_size'] = createExportWrapper(
      'archive_entry_size',
      1
    ))

    var _archive_entry_symlink = (Module['_archive_entry_symlink'] = createExportWrapper(
      'archive_entry_symlink',
      1
    ))

    var _archive_entry_symlink_utf8 = (Module['_archive_entry_symlink_utf8'] = createExportWrapper(
      'archive_entry_symlink_utf8',
      1
    ))

    var _archive_errno = (Module['_archive_errno'] = createExportWrapper('archive_errno', 1))

    var _archive_read_free = (Module['_archive_read_free'] = createExportWrapper(
      'archive_read_free',
      1
    ))

    var __initialize = (Module['__initialize'] = createExportWrapper('_initialize', 0))

    var ___trap = wasmExports['__trap']

    var _emscripten_stack_set_limits = wasmExports['emscripten_stack_set_limits']

    var _emscripten_stack_get_free = wasmExports['emscripten_stack_get_free']

    var _emscripten_stack_get_base = wasmExports['emscripten_stack_get_base']

    var _emscripten_stack_get_end = wasmExports['emscripten_stack_get_end']

    var __emscripten_stack_restore = wasmExports['_emscripten_stack_restore']

    var __emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc']

    var _emscripten_stack_get_current = wasmExports['emscripten_stack_get_current']

    var ___wasm_apply_data_relocs = createExportWrapper('__wasm_apply_data_relocs', 0)

    var ___set_stack_limits = (Module['___set_stack_limits'] = createExportWrapper(
      '__set_stack_limits',
      2
    ))

    // include: postamble.js
    // === Auto-generated postamble setup entry stuff ===
    Module['ccall'] = ccall

    Module['cwrap'] = cwrap

    var missingLibrarySymbols = [
      'writeI53ToI64',
      'writeI53ToI64Clamped',
      'writeI53ToI64Signaling',
      'writeI53ToU64Clamped',
      'writeI53ToU64Signaling',
      'readI53FromI64',
      'readI53FromU64',
      'convertI32PairToI53',
      'convertI32PairToI53Checked',
      'convertU32PairToI53',
      'getTempRet0',
      'setTempRet0',
      'zeroMemory',
      'getHeapMax',
      'growMemory',
      'strError',
      'inetPton4',
      'inetNtop4',
      'inetPton6',
      'inetNtop6',
      'readSockaddr',
      'writeSockaddr',
      'emscriptenLog',
      'readEmAsmArgs',
      'jstoi_q',
      'listenOnce',
      'autoResumeAudioContext',
      'getDynCaller',
      'dynCall',
      'runtimeKeepalivePush',
      'runtimeKeepalivePop',
      'callUserCallback',
      'maybeExit',
      'asmjsMangle',
      'asyncLoad',
      'alignMemory',
      'mmapAlloc',
      'HandleAllocator',
      'getNativeTypeSize',
      'addOnPreRun',
      'addOnInit',
      'addOnPostCtor',
      'addOnPreMain',
      'addOnExit',
      'addOnPostRun',
      'STACK_SIZE',
      'STACK_ALIGN',
      'POINTER_SIZE',
      'ASSERTIONS',
      'removeFunction',
      'reallyNegative',
      'unSign',
      'strLen',
      'reSign',
      'formatString',
      'intArrayFromString',
      'intArrayToString',
      'AsciiToString',
      'UTF16ToString',
      'stringToUTF16',
      'lengthBytesUTF16',
      'UTF32ToString',
      'stringToUTF32',
      'lengthBytesUTF32',
      'stringToNewUTF8',
      'registerKeyEventCallback',
      'maybeCStringToJsString',
      'findEventTarget',
      'getBoundingClientRect',
      'fillMouseEventData',
      'registerMouseEventCallback',
      'registerWheelEventCallback',
      'registerUiEventCallback',
      'registerFocusEventCallback',
      'fillDeviceOrientationEventData',
      'registerDeviceOrientationEventCallback',
      'fillDeviceMotionEventData',
      'registerDeviceMotionEventCallback',
      'screenOrientation',
      'fillOrientationChangeEventData',
      'registerOrientationChangeEventCallback',
      'fillFullscreenChangeEventData',
      'registerFullscreenChangeEventCallback',
      'JSEvents_requestFullscreen',
      'JSEvents_resizeCanvasForFullscreen',
      'registerRestoreOldStyle',
      'hideEverythingExceptGivenElement',
      'restoreHiddenElements',
      'setLetterbox',
      'softFullscreenResizeWebGLRenderTarget',
      'doRequestFullscreen',
      'fillPointerlockChangeEventData',
      'registerPointerlockChangeEventCallback',
      'registerPointerlockErrorEventCallback',
      'requestPointerLock',
      'fillVisibilityChangeEventData',
      'registerVisibilityChangeEventCallback',
      'registerTouchEventCallback',
      'fillGamepadEventData',
      'registerGamepadEventCallback',
      'registerBeforeUnloadEventCallback',
      'fillBatteryEventData',
      'battery',
      'registerBatteryEventCallback',
      'setCanvasElementSize',
      'getCanvasElementSize',
      'jsStackTrace',
      'getCallstack',
      'convertPCtoSourceLocation',
      'checkWasiClock',
      'wasiRightsToMuslOFlags',
      'wasiOFlagsToMuslOFlags',
      'initRandomFill',
      'randomFill',
      'safeSetTimeout',
      'setImmediateWrapped',
      'safeRequestAnimationFrame',
      'clearImmediateWrapped',
      'registerPostMainLoop',
      'registerPreMainLoop',
      'getPromise',
      'makePromise',
      'idsToPromises',
      'makePromiseCallback',
      'Browser_asyncPrepareDataCounter',
      'getSocketFromFD',
      'getSocketAddress',
      'getMemory',
      'mergeLibSymbols',
      'loadWebAssemblyModule',
      'setDylinkStackLimits',
      'newDSO',
      'loadDynamicLibrary',
      'dlopenInternal',
    ]

    missingLibrarySymbols.forEach(missingLibrarySymbol)

    var unexportedSymbols = [
      'run',
      'addRunDependency',
      'removeRunDependency',
      'out',
      'err',
      'callMain',
      'abort',
      'wasmMemory',
      'wasmExports',
      'HEAPF32',
      'HEAPF64',
      'HEAPU8',
      'HEAP16',
      'HEAPU16',
      'HEAP32',
      'HEAPU32',
      'HEAP64',
      'HEAPU64',
      'writeStackCookie',
      'checkStackCookie',
      'INT53_MAX',
      'INT53_MIN',
      'bigintToI53Checked',
      'stackSave',
      'stackRestore',
      'stackAlloc',
      'ptrToString',
      'exitJS',
      'ENV',
      'setStackLimits',
      'ERRNO_CODES',
      'DNS',
      'Protocols',
      'Sockets',
      'timers',
      'warnOnce',
      'readEmAsmArgsArray',
      'jstoi_s',
      'getExecutableName',
      'setWasmTableEntry',
      'getWasmTableEntry',
      'handleException',
      'keepRuntimeAlive',
      'wasmTable',
      'noExitRuntime',
      'getCFunc',
      'uleb128Encode',
      'sigToWasmTypes',
      'generateFuncType',
      'convertJsFunctionToWasm',
      'freeTableIndexes',
      'functionsInTableMap',
      'getEmptyTableSlot',
      'updateTableMap',
      'getFunctionAddress',
      'addFunction',
      'setValue',
      'getValue',
      'PATH',
      'PATH_FS',
      'UTF8Decoder',
      'UTF8ArrayToString',
      'UTF8ToString',
      'stringToUTF8Array',
      'stringToUTF8',
      'lengthBytesUTF8',
      'stringToAscii',
      'UTF16Decoder',
      'stringToUTF8OnStack',
      'writeArrayToMemory',
      'JSEvents',
      'specialHTMLTargets',
      'findCanvasEventTarget',
      'currentFullscreenStrategy',
      'restoreOldWindowedStyle',
      'UNWIND_CACHE',
      'ExitStatus',
      'getEnvStrings',
      'flush_NO_FILESYSTEM',
      'emSetImmediate',
      'emClearImmediate_deps',
      'emClearImmediate',
      'promiseMap',
      'Browser',
      'getPreloadedImageData__data',
      'wget',
      'SYSCALLS',
      'isSymbolDefined',
      'GOT',
      'currentModuleWeakSymbols',
      'LDSO',
      'LE_HEAP_STORE_U16',
      'LE_HEAP_STORE_I16',
      'LE_HEAP_STORE_U32',
      'LE_HEAP_STORE_I32',
      'LE_HEAP_STORE_F32',
      'LE_HEAP_STORE_F64',
      'LE_HEAP_LOAD_U16',
      'LE_HEAP_LOAD_I16',
      'LE_HEAP_LOAD_U32',
      'LE_HEAP_LOAD_I32',
      'LE_HEAP_LOAD_F32',
      'LE_HEAP_LOAD_F64',
      'LE_ATOMICS_NATIVE_BYTE_ORDER',
      'LE_ATOMICS_ADD',
      'LE_ATOMICS_AND',
      'LE_ATOMICS_COMPAREEXCHANGE',
      'LE_ATOMICS_EXCHANGE',
      'LE_ATOMICS_ISLOCKFREE',
      'LE_ATOMICS_LOAD',
      'LE_ATOMICS_NOTIFY',
      'LE_ATOMICS_OR',
      'LE_ATOMICS_STORE',
      'LE_ATOMICS_SUB',
      'LE_ATOMICS_WAIT',
      'LE_ATOMICS_WAITASYNC',
      'LE_ATOMICS_XOR',
    ]

    unexportedSymbols.forEach(unexportedRuntimeSymbol)

    var calledRun

    var mainArgs = undefined

    function callMain(args = []) {
      assert(
        runDependencies == 0,
        'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])'
      )
      assert(
        typeof onPreRuns === 'undefined' || onPreRuns.length == 0,
        'cannot call main when preRun functions remain to be called'
      )
      var entryFunction = __initialize
      mainArgs = [thisProgram].concat(args)
      try {
        entryFunction()
        // _start (in crt1.c) will call exit() if main return non-zero.  So we know
        // that if we get here main returned zero.
        var ret = 0
        // if we're not running an evented main loop, it's time to exit
        exitJS(ret, /* implicit = */ true)
        return ret
      } catch (e) {
        return handleException(e)
      }
    }

    function stackCheckInit() {
      // This is normally called automatically during __wasm_call_ctors but need to
      // get these values before even running any of the ctors so we call it redundantly
      // here.
      _emscripten_stack_set_limits(152880, 87344)
      // TODO(sbc): Move writeStackCookie to native to to avoid this.
      writeStackCookie()
    }

    function run(args = arguments_) {
      if (runDependencies > 0) {
        dependenciesFulfilled = run
        return
      }
      stackCheckInit()
      preRun()
      // a preRun added a dependency, run will be called later
      if (runDependencies > 0) {
        dependenciesFulfilled = run
        return
      }
      function doRun() {
        // run may have just been called through dependencies being fulfilled just in this very frame,
        // or while the async setStatus time below was happening
        assert(!calledRun)
        calledRun = true
        Module['calledRun'] = true
        if (ABORT) return
        initRuntime()
        preMain()
        readyPromiseResolve(Module)
        var noInitialRun = true
        legacyModuleProp('noInitialRun', 'noInitialRun')
        if (!noInitialRun) callMain(args)
        postRun()
      }
      {
        doRun()
      }
      checkStackCookie()
    }

    function checkUnflushedContent() {
      // Compiler settings do not allow exiting the runtime, so flushing
      // the streams is not possible. but in ASSERTIONS mode we check
      // if there was something to flush, and if so tell the user they
      // should request that the runtime be exitable.
      // Normally we would not even include flush() at all, but in ASSERTIONS
      // builds we do so just for this check, and here we see if there is any
      // content to flush, that is, we check if there would have been
      // something a non-ASSERTIONS build would have not seen.
      // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
      // mode (which has its own special function for this; otherwise, all
      // the code is inside libc)
      var oldOut = out
      var oldErr = err
      var has = false
      out = err = x => {
        has = true
      }
      try {
        // it doesn't matter if it fails
        flush_NO_FILESYSTEM()
      } catch (e) {}
      out = oldOut
      err = oldErr
      if (has) {
        warnOnce(
          'stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.'
        )
        warnOnce(
          '(this may also be due to not including full filesystem support - try building with -sFORCE_FILESYSTEM)'
        )
      }
    }

    run()

    // end include: postamble.js
    // include: postamble_modularize.js
    // In MODULARIZE mode we wrap the generated code in a factory function
    // and return either the Module itself, or a promise of the module.
    // We assign to the `moduleRtn` global here and configure closure to see
    // this as and extern so it won't get minified.
    moduleRtn = readyPromise

    // Assertion for attempting to access module properties on the incoming
    // moduleArg.  In the past we used this object as the prototype of the module
    // and assigned properties to it, but now we return a distinct object.  This
    // keeps the instance private until it is ready (i.e the promise has been
    // resolved).
    for (const prop of Object.keys(Module)) {
      if (!(prop in moduleArg)) {
        Object.defineProperty(moduleArg, prop, {
          configurable: true,
          get() {
            abort(
              `Access to module property ('${prop}') is no longer possible via the module constructor argument; Instead, use the result of the module constructor.`
            )
          },
        })
      }
    }

    return moduleRtn
  }
})()
;(() => {
  // Create a small, never-async wrapper around wasmFactory which
  // checks for callers incorrectly using it with `new`.
  var real_wasmFactory = wasmFactory
  wasmFactory = function (arg) {
    if (new.target) throw new Error('wasmFactory() should not be called with `new wasmFactory()`')
    return real_wasmFactory(arg)
  }
})()

export const wasm = await wasmFactory()
