/*!
 * archive-wasm - LibArchive compiled to WASM with a idiomatic JS API
 * Copyright (C) 2023 Spacedrive Technology Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file Idiomatic JavaScript API for extracting most archive files with LibArchive
 * @module archive-wasm
 */

import path from './path.mjs'
import {
  closeArchive,
  getEntryAtime,
  getEntryBirthtime,
  getEntryCtime,
  getEntryHardlink,
  getEntryMode,
  getEntryMtime,
  getEntryPathName,
  getEntrySize,
  getEntrySymlink,
  getFileData,
  getNextEntry,
  openArchive,
  WARNING,
} from './wasm/bridge.mjs'
import { EntryTypeName, FILETYPE_FLAG } from './wasm/enums.mjs'
import {
  ARCHIVE_ERRNO_FILE_FORMAT,
  ArchiveError,
  ENULL,
  ExceedRecursionLimitError,
  ExceedSizeLimitError,
  FileReadError,
  NullError,
} from './wasm/errors.mjs'
import { Pointer } from './wasm/pointer.mjs'

const MAX_RECURSIONS_DEPTH = 16

/**
 * Object type guard
 * @param {unknown} input
 * @returns {input is Record<string, unknown>}
 */
const isObject = input => {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

/**
 * Regex[] type guard
 * @param {unknown} input
 * @returns {input is RegExp[]}
 */
const isRegexArray = input => {
  return Array.isArray(input) && input.every(re => re instanceof RegExp)
}

/**
 * Reopen an archive back to a specific entry
 * @param {Pointer} buffer Archive's data
 * @param {number} offset Number of entries to skip before returning the entry
 * @param {string} [passphrase] Passphrase to decrypt protect zip archives
 * @returns {Pointer} Pointer to the entry's data
 */
function reopenArchive(buffer, offset, passphrase) {
  let skips = offset + 1
  const archive = openArchive(buffer, passphrase)
  try {
    while (--skips >= 0) {
      try {
        getNextEntry(archive)
      } catch (error) {
        throw error instanceof NullError
          ? new FileReadError(ENULL, `Couldn't find entry ${offset} inside archive`)
          : error
      }
    }

    return archive
  } catch (error) {
    closeArchive(archive)
    throw error
  }
}

/**
 * Options for {@link extract}
 * @typedef {object} ExtractOpts
 * @property {string} [baseDir] Specifies a base directory to prepend to each extracted entry's path.
 * @property {string} [encoding] The encoding used to parse entry metadata. Defaults to 'utf8'.
 * @property {string} [passphrase] Passphrase for decrypting password-protected ZIP archives.
 * @property {number} [stripComponents] The number of leading path components to skip when extracting entries. Has no effect on absolute paths. The default is 0.
 * @property {boolean} [normalize] Indicates whether to normalize extracted paths. Defaults to true.
 * @property {boolean} [recursive] Indicates whether to recursively extract archives within archives. Defaults to false.
 * @property {boolean} [ignoreDotDir] Indicates whether to ignore entries for '.' directories. Defaults to true.
 * @property {RegExp[]} [include] A list of RegExp patterns to filter entries that should be extracted. An empty list means all entries are NOT included.
 * @property {RegExp[]} [exclude] A list of RegExp patterns to filter entries that should be ignored.
 */

/**
 * Process extract options
 * @param {unknown} opts Extract options for the {@link extract} function.
 * @returns {Required<
 *  Pick<ExtractOpts, 'normalize' | 'recursive' | 'ignoreDotDir' | 'stripComponents'>> &
 *  Pick<ExtractOpts, 'baseDir' | 'encoding' | 'passphrase'
 * > & {
 *  include: false | NonNullable<ExtractOpts['include']>;
 *  exclude: false | NonNullable<ExtractOpts['exclude']>;
 *  recursionDepth: number
 * }}
 */
function processOptions(opts) {
  /** @type { false | RegExp[]} */
  let include = false
  /** @type { false | RegExp[]} */
  let exclude = false
  let baseDir
  let encoding
  let normalize = true
  let recursive = false
  let passphrase
  let ignoreDotDir = true
  let recursionDepth = 0
  let stripComponents = 0
  if (opts) {
    if (typeof opts === 'string') passphrase = opts
    else if (isObject(opts)) {
      baseDir = opts.baseDir
      if (typeof baseDir !== 'string' && baseDir !== undefined)
        throw new TypeError('Invalid baseDir option, expected a string')
      encoding = opts.encoding
      if (typeof encoding !== 'string' && encoding !== undefined)
        throw new TypeError('Invalid encoding option, expected a string')
      passphrase = opts.passphrase
      if (typeof passphrase !== 'string' && passphrase !== undefined)
        throw new TypeError('Invalid passphrase option, expected a string')

      if (opts.include != null) {
        if (!isRegexArray(opts.include))
          throw new TypeError('Invalid include option, expected an array of RegExp')
        include = opts.include
      }
      if (opts.exclude != null) {
        if (!isRegexArray(opts.exclude))
          throw new TypeError('Invalid exclude option, expected an array of RegExp')
        exclude = opts.exclude
      }
      if (opts.normalize != null) {
        if (typeof opts.normalize !== 'boolean')
          throw new TypeError('Invalid normalize option, expected a boolean')
        normalize = opts.normalize
      }
      if (opts.ignoreDotDir != null) {
        if (typeof opts.ignoreDotDir !== 'boolean')
          throw new TypeError('Invalid ignoreDotDir option, expected a boolean')
        ignoreDotDir = opts.ignoreDotDir
      }
      if (opts.stripComponents != null) {
        if (typeof opts.stripComponents !== 'number')
          throw new TypeError('Invalid stripComponents option, expected a number')
        stripComponents = opts.stripComponents
      }

      if (typeof opts.recursive === 'boolean') {
        recursive = opts.recursive
      } else if (
        typeof opts.recursive === 'object' &&
        opts.recursive != null &&
        typeof opts.recursive.valueOf() === 'boolean' &&
        'depth' in opts.recursive &&
        typeof opts.recursive.depth === 'number'
      ) {
        // Decode the recursion depth from a Boolean object placed as the value of the recursive option
        recursive = /** @type {boolean} */ (opts.recursive.valueOf())
        recursionDepth = opts.recursive.depth
      }
    } else {
      throw new TypeError('Invalid options type, expected string or object')
    }
  }

  if (recursionDepth >= MAX_RECURSIONS_DEPTH) throw new ExceedRecursionLimitError()

  return {
    include,
    exclude,
    baseDir,
    encoding,
    normalize,
    recursive,
    recursionDepth,
    stripComponents,
    passphrase,
    ignoreDotDir,
  }
}
/**
 * A compressed data entry within an archive.
 * @typedef {object} Entry
 * @property {bigint} size The size of the entry in bytes.
 * @property {number} perm A bit field describing the file type and mode.
 * @property {string?} path The path of the entry within the archive.
 * @property {import('./wasm/enums.mjs').EntryTypeName?} type Indicates if the entry is a file, directory, or another type.
 * @property {string?} link The path to the actual resource if this is a symlink or hardlink.
 * @property {bigint} atime The timestamp indicating the last time this file was accessed, expressed in nanoseconds since the POSIX Epoch.
 * @property {bigint} ctime The timestamp indicating the last time the file status was changed, expressed in nanoseconds since the POSIX Epoch.
 * @property {bigint} mtime The timestamp indicating the last time this file was modified, expressed in nanoseconds since the POSIX Epoch.
 * @property {bigint} birthtime The timestamp indicating this file’s creation time, expressed in nanoseconds since the POSIX Epoch.
 * @property {ArrayBuffer} data An ArrayBuffer containing the entry’s data.
 */

/**
 * Extract an archive and iterate through all its entries.
 *
 * > Using the {@link ExtractOpts.baseDir} or {@link ExtractOpts.stripComponents} option results
 *   in the entry’s path being normalized.
 *
 * > The {@link ExtractOpts.stripComponents}, {@link ExtractOpts.include}, and {@link ExtractOpts.exclude}
 *   options are always processed with a normalized version of the entry’s path, so there is no need
 *   to worry about edge cases. Also, they are applied before the {@link ExtractOpts.baseDir} option,
 *   so the base directory will not be affected by them.
 *
 * > Using {@link ExtractOpts.recursive} can severely impact performance on large archives. It allows
 *   extracting nested archives (common in GitHub Action releases) but is limited to 16 levels of
 *   recursion. Formats such as `ar`, `empty`, `mtree`, and `cab` are disabled for inner extraction
 *   since they can treat nearly any file as an archive.
 * @param {ArrayBufferView | ArrayBufferLike} data The archive’s data.
 * @param {string | ExtractOpts} [opts] Extract options; a string value is interpreted as a password.
 * @yields {Entry}
 * @returns {Generator.<Entry, void, void>} A generator that iterates through all the archive’s entries.
 */
export function* extract(data, opts) {
  let offset = -1
  const {
    include,
    exclude,
    baseDir,
    encoding,
    normalize,
    recursive,
    recursionDepth,
    stripComponents,
    passphrase,
    ignoreDotDir,
  } = processOptions(opts)

  const buffer = data instanceof Pointer ? data : new Pointer().fill(data, true)

  let archive = openArchive(buffer, passphrase, recursionDepth > 0)
  try {
    while (true) {
      offset++
      let pointer

      try {
        pointer = getNextEntry(archive)
      } catch (error) {
        // Null here means archive EOF
        if (error instanceof NullError) return

        throw error
      }

      const mode = getEntryMode(pointer)
      const type = EntryTypeName[FILETYPE_FLAG & mode] ?? null

      let rawPath = getEntryPathName(pointer, encoding)
      if (rawPath) {
        const normalizedPath = path.normalize(path.relative('/', path.resolve(rawPath)))
        if (
          (include && !include.some(re => re.test(normalizedPath))) ||
          (exclude && exclude.some(re => re.test(normalizedPath))) ||
          (ignoreDotDir && type === 'DIR' && normalizedPath === '.')
        )
          continue

        // Skip leading path components
        if (stripComponents > 0 && !path.isAbsolute(rawPath)) {
          const parts = normalizedPath.split('/').slice(stripComponents)
          if (parts.length === 0) continue
          rawPath = parts.join('/')
        } else if (normalize) {
          rawPath = normalizedPath
        }
      }

      /** @type {Pointer?} */
      let fileData = null

      /** @type {Entry} */
      const entry = {
        perm: ~FILETYPE_FLAG & mode,
        size: getEntrySize(pointer),
        type,
        path:
          rawPath && !path.isAbsolute(rawPath) && baseDir
            ? path.relative('/', path.resolve(baseDir)) +
              '/' +
              path.relative(baseDir, path.resolve(baseDir, rawPath))
            : rawPath,
        link: getEntrySymlink(pointer, encoding) ?? getEntryHardlink(pointer, encoding),
        atime: getEntryAtime(pointer),
        ctime: getEntryCtime(pointer),
        mtime: getEntryMtime(pointer),
        birthtime: getEntryBirthtime(pointer),

        get data() {
          if (fileData == null) fileData = getFileData(archive, entry.size)
          const data = fileData.isNull() ? new ArrayBuffer(0) : fileData.read()
          // Replace the getter with the actual value now that we got it
          Object.defineProperty(entry, 'data', { value: data })
          return data
        },
      }

      // Extract inner archives if recursive is enabled
      if (recursive && entry.type === 'FILE' && entry.path && !entry.link) {
        const innerData = entry.data
        if (innerData != null && innerData.byteLength > 0) {
          if (offset === 10 && WARNING)
            console.warn(
              'Using the recursive feature for large archives has a considerable performance impact'
            )

          // Need to close the current archive to open a new one
          closeArchive(archive)
          archive = Pointer.NIL

          // Create a recursion object containing the current depth to pass on the next iteration
          const recursion = new Boolean(recursive) // eslint-disable-line no-new-wrappers
          Object.defineProperty(recursion, 'depth', { value: recursionDepth + 1 })

          let entryIsArchive = false
          try {
            // Extract inner archive and yield it's entries
            yield* extract(innerData, {
              baseDir: path.dirname(entry.path),
              encoding,
              // @ts-expect-error Major hack, dont do this at home kids XD
              recursive: recursion,
              passphrase,
              ignoreDotDir,
            })
            entryIsArchive = true
          } catch (error) {
            // File format errors means that this file is not an archive, so just keep going
            if (!(error instanceof ArchiveError && error.code === ARCHIVE_ERRNO_FILE_FORMAT)) {
              throw error
            }
          }

          // Reopen the current archive to continue extracting
          archive = reopenArchive(buffer, offset, passphrase)
          if (entryIsArchive) continue
        }
      }

      yield entry

      // If getter still exists that means the entry's data was not accessed.
      const entryDataGetter = Object.getOwnPropertyDescriptor(entry, 'data')?.get
      if (typeof entryDataGetter === 'function') {
        const entryOffset = offset
        // Replace the getter with one that opens a new archive to work-around the streaming nature of LibArchive
        Object.defineProperty(entry, 'data', {
          get: () => {
            if (WARNING)
              console.warn(
                "Accessing entry's data after the extract loop results in worse performance"
              )

            archive = reopenArchive(buffer, entryOffset, passphrase)
            try {
              return entryDataGetter()
            } finally {
              closeArchive(archive)
              archive = Pointer.NIL
            }
          },
        })
      }
    }
  } finally {
    closeArchive(archive)
    archive = Pointer.NIL
  }
}

/**
 * Exclusive options for {@link extractAll}
 * @typedef {object} ExtractAllExclusiveOpts
 * @property {bigint?} [sizeLimit] Limits the total byte size of data to avoid memory exhaustion. Null means no limit (default: 128MB).
 */

/**
 * Options for {@link extractAll}
 * @typedef {ExtractOpts & ExtractAllExclusiveOpts} ExtractAllOpts
 */

/**
 * Extracts all entries from an archive.
 *
 * > This function is recommended over {@link extract} if you need to retrieve and process the data
 *   from all entries within the archive and memory usage is not a concern. It improves performance
 *   by skipping certain workarounds required for random access to an entry’s data in LibArchive’s
 *   streaming model. If your use case involves accessing all entries and their content, choose
 *   {@link extractAll} for optimal performance.
 * @param {ArrayBufferView | ArrayBufferLike} data The archive’s data.
 * @param {string | ExtractAllOpts} [opts] Extraction options, or a string interpreted as a password.
 * @returns {Entry[]} A list of entries from the archive.
 */
export function extractAll(data, opts) {
  let sizeLimit = /** @type {bigint?} */ (128n * 1024n * 1024n) // 128 MB
  if (opts && typeof opts === 'object') {
    if (opts.sizeLimit != null) {
      if (typeof opts.sizeLimit !== 'bigint')
        throw new TypeError('Invalid sizeLimit option, expected a bigint')
      sizeLimit = opts.sizeLimit
    }
  }

  return Array.from(extract(data, opts), e => {
    if (sizeLimit != null && (sizeLimit -= e.size) < 0) throw new ExceedSizeLimitError()
    void e.data // Force data to load into memory
    return e
  })
}

export { disableWarning } from './wasm/bridge.mjs'

export { EntryTypeName } from './wasm/enums.mjs'

export {
  ArchiveError,
  NullError,
  RetryError,
  FatalError,
  FailedError,
  FileReadError,
  PassphraseError,
  ExceedSizeLimitError,
  ExceedRecursionLimitError,
} from './wasm/errors.mjs'
