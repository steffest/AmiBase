/*
    System: load libraries
*/

import settings from "../settings.js";
import {loadCss} from "../util/dom.js";
import fetchService from "../util/fetchService.js";
import desktop from "../ui/desktop.js";
import applications from "../applications.js";
import filesystem from "./filesystem.js";
import storage from "../storage.js";
import user from "../user.js";
import input from "../input.js";
import ui from "../ui/ui.js";
import network from "./network.js";
import mainMenu from "../ui/mainmenu.js";
import {binaryToBase64} from "./network/shared.js";

const PLUGIN_API_VERSION = 1;
// A plugin may still opt into full bridge access by declaring "*" in its
// capabilities; the default (no/empty capabilities) is now no access.
const WILDCARD_CAPABILITY = "*";

const KNOWN_PLUGIN_CAPABILITIES = [
    "net.fetch",
    "fs.read",
    "fs.write",
    "fs.dialog",
    "system.inspect",
    "system.loadScript",
    "system.user",
    "system.settings",
    "ui.desktop",
    "crypto.sha256",
];

let System = function(){
    var me = {};
    // Reported by the shell's VERSION command; sourced from settings (name +
    // release), the single source of truth for the AmiBase build.
    me.version = settings.name + " " + settings.version;
    var libraries = {};
    let plugins = {};
    let saveAs;
    let knownApplications = [];
    let knownApplicationsLoaded = false;

    function normalizePluginConfig(pluginName, rawConfig){
        let config = rawConfig || {};
        let normalized = {
            ...config,
            pluginName,
            apiVersion: Number.isInteger(config.apiVersion) ? config.apiVersion : PLUGIN_API_VERSION,
        };

        if (!Array.isArray(config.capabilities)){
            // Default-deny: a plugin that declares no capabilities array gets no
            // bridge access. (Declare "*" to explicitly opt into full access.)
            normalized.capabilities = [];
        }else{
            normalized.capabilities = [...new Set(config.capabilities.filter(item=>typeof item === "string" && !!item.trim()))];
        }

        if (normalized.apiVersion > PLUGIN_API_VERSION){
            console.warn(`Plugin ${pluginName} uses unsupported apiVersion ${normalized.apiVersion}; expected <= ${PLUGIN_API_VERSION}`);
        }

        return normalized;
    }

    function hasPluginCapability(pluginConfig, capability){
        if (!capability) return true;
        // Default-deny: unknown plugin / no declared capabilities => no access.
        let capabilities = (pluginConfig && pluginConfig.capabilities) || [];
        return capabilities.includes(WILDCARD_CAPABILITY) || capabilities.includes(capability);
    }

    async function loadKnownApplications(){
        if (knownApplicationsLoaded) return knownApplications;
        knownApplicationsLoaded = true;

        let config = await fetchService.json("content/system/knownApplications.json");
        if (!Array.isArray(config)){
            console.warn("Could not load known applications list from content/system/knownApplications.json");
            knownApplications = [];
            return knownApplications;
        }

        knownApplications = config.filter(item=>item && typeof item.name === "string");
        return knownApplications;
    }

    me.loadEnvironment = function(_env){
        return new Promise(function(next){
            loadKnownApplications().then(()=>{
                let env = _env || document.location.search;
                if (!env && document.location.hostname.includes("localhost")){
                    env = "-demo";
                }
                console.error(env);

                if (env){
                    env = env.substring(1).split(/[=&]/)[0];
                    settings.tenant = env;

                    function setEnv(tenantSettings){
                        console.log("Setting environment to " + env);
                        if (tenantSettings){
                            for (var key in tenantSettings){
                                settings[key] = tenantSettings[key];
                            }
                        }
                        next(true);
                    }

                    import("../../config/" + env + ".js").then(module=>{
                        if (module.default && module.default.initialContent){
                            setEnv(module.default);
                        }else{
                            console.log("Invalid config file for " + env);
                            next(false);
                        }
                    }).catch(e=>{
                        console.log("No config file found for " + env);
                        next(false);
                    });

                }else{
                    next(false);
                }
            });
        });
    };

    me.reset = async (full)=>{
        desktop.reset();
        await filesystem.reset();
        let storageDone = await storage.clear();
        console.log("Storage Cleared",storageDone);
    }

    me.connectEnv = async (token,env)=>{
        let hasEnvironment = await me.loadEnvironment(env || token);
        if (hasEnvironment){
            await me.reset();
            await desktop.loadTheme(await user.getTheme());
            await user.init();
            mainMenu.rebuildMenu();
            desktop.loadContent(settings.initialContent,settings.mounts,"desktop:");
            desktop.cleanUp();
        }
        return hasEnvironment;
    }

    me.loadLibrary = function(libraryName,callback){
        return new Promise(function(resolve,reject){
            var next = callback || resolve;
            var plugin = libraries[libraryName];
            if (plugin && plugin.loaded){
                console.log("Library " + libraryName + " already loaded");
                next(plugin);
            }else{
                console.log("Loading library " + libraryName);
                plugin = {};
                var pluginPath = "plugins/" + libraryName + "/";
                if (libraryName.indexOf(".js")>0){
                    // load single file
                    pluginPath = "../../plugins/" + libraryName.substr(0,libraryName.length-3) + "/" + libraryName;
                    import(pluginPath).then(module=>{
                        console.log(libraryName + " loaded");
                        plugin = module.default;
                        plugin.loaded = true;
                        libraries[libraryName] = plugin;
                        next(plugin);
                    });
                }else{
                    fetchService.json(pluginPath + "config.json").then(function(config){
                        if (config){
                            plugin.config = normalizePluginConfig(libraryName,config);

                            function loadPluginScripts(){
                                import("../../" + pluginPath + config.module).then(module=>{
                                    console.log(libraryName + " loaded");
                                    plugin = module.default;
                                    plugin.loaded = true;
                                    libraries[libraryName] = plugin;
                                    next(plugin);
                                });
                            }

                            if (config.dependencies && config.dependencies.length){
                                var dependeciesLoaded = 0;
                                var dependeciesTarget = config.dependencies.length;

                                config.dependencies.forEach(function(dependency){
                                    me.loadLibrary(dependency,function(){
                                        dependeciesLoaded++;
                                        if (dependeciesLoaded>=dependeciesTarget){
                                            loadPluginScripts();
                                        }
                                    });
                                });
                            }else{
                                loadPluginScripts();
                            }

                            if (config.styles){
                                config.styles.forEach(function(src){
                                    loadCss(pluginPath + src);
                                })
                            }
                        }else{
                            console.error("Error: Plugin " + pluginName + " not found");
                            next({});
                        }
                    });
                }
            }
        });
    };

    me.loadPlugin = pluginName=>new Promise(async function(next){
        console.log("Loading plugin " + pluginName);
        let plugin = plugins[pluginName];

        if (plugin){
            console.log("Plugin " + pluginName + " already loaded");
            next(plugin);
            return;
        }

        let pluginPath = "plugins/" + pluginName + "/";
        plugin={};
        let config = await fetchService.json(pluginPath + "config.json");
        if (config){
            plugin.name = pluginName;
            plugin.config = normalizePluginConfig(pluginName,config);
            config = plugin.config;

            // preload code
            if (config.module){
                let p = await import("../../" + pluginPath + config.module);
                plugin.handler = p.default;
            }

            // preload html
            if (config.index && config.index.indexOf("://")<0){
                plugin.html = await fetchService.html(pluginPath + config.index);
            }

            // preload css
            if (config.styles){
                config.styles.forEach(function(src){
                    loadCss(pluginPath + src);
                });
            }

            plugins[pluginName] = plugin;
            next(plugin);
        }else{
            console.error("Error: Plugin " + pluginName + " not found");
            next();
        }
    });

    me.getRegisteredApplications = function(){
        return knownApplications;
    }

    me.getPluginConfig = function(pluginName){
        let plugin = plugins[pluginName];
        return plugin && plugin.config ? plugin.config : null;
    }

    me.getPluginApiVersion = function(){
        return PLUGIN_API_VERSION;
    }

    me.getKnownPluginCapabilities = function(){
        return KNOWN_PLUGIN_CAPABILITIES.slice();
    }

    me.pluginHasCapability = function(pluginName, capability){
        return hasPluginCapability(me.getPluginConfig(pluginName), capability);
    }


    // detects type from binary structure
    me.inspectBinary = async function(arrayBuffer, name){
        console.error("DEPRECATED - inspectBinary");
        await me.loadLibrary("filetypes");
        var file = new BinaryStream(arrayBuffer,true); // set to True if coming from Amiga
        file.name = name;
        var filetype = await FileType.detect(file);
        return {
            type: "file",
            file:file,
            filetype:filetype
        };
    };

    // first try to detect filetype by inspecting content
    // then fallback on extension
     me.detectFileType = async function(file,tryHard){
         let fileTypeLib = await me.loadLibrary("filetypes");
         return fileTypeLib.detect(file,tryHard);
     };

     me.getFileTypeFromName = async function(name){
         let fileTypeLib = await me.loadLibrary("filetypes");
         return fileTypeLib.detectFromFileExtension(name);
     }

     me.getPreview = async function(file){
        if (file.filetype && file.filetype.classType === "image"){
            if (file.url){
                let img = new Image();
                img.src = file.url;
                return img;
            }
        }

        return false;
     }

     me.getIcon = async function(file){
         let fileType = file.filetype;
         if (fileType && fileType.handler && fileType.handler.getIcon){
             let content = await filesystem.readFile(file,true);
             if (!content || !content.buffer || content.buffer.byteLength === 0) return null;
             return fileType.handler.getIcon(content);
         }
     }
     
     // Amiga disk files (.adf/.hdf) normally open in the "uae" plugin's
     // in-browser WASM emulator. When running inside the Electron kiosk
     // shell (docs/bootable-kiosk-plan.md Phase 4), prefer booting them in
     // a real native emulator (FS-UAE) instead - a genuine floating window
     // managed by Openbox, not an iframe. Mirrors desktop.openWebsite's
     // window.electronBridge feature-detect. Returns true if handled here
     // (caller should stop), false to fall through to the normal plugin
     // load (plain browser, or electronBridge missing).
     async function tryLaunchNativeAmiga(file,pluginName){
         if (pluginName !== "uae") return false;
         if (!window.electronBridge) return false;

         let ext = (file.name||file.url||file.path||"").split(".").pop().toLowerCase();
         if (ext !== "adf" && ext !== "hdf") return false;

         // filesystem.readFile(file,true) returns a plain ArrayBuffer for
         // some mounts (e.g. amibaseServer's serverFs.js) and a
         // BinaryStream-like {buffer:ArrayBuffer} for others (e.g. an
         // already-loaded file.binary) - binaryToBase64 already handles
         // both shapes, so only reject on genuinely empty/missing content.
         let binary = file.binary;
         if (!binary) binary = await filesystem.readFile(file,true);
         let byteLength = binary instanceof ArrayBuffer ? binary.byteLength : (binary && binary.buffer && binary.buffer.byteLength);
         if (!byteLength){
             desktop.showError("Couldn't read " + (file.name||"disk file") + " for the Amiga emulator.");
             return true;
         }

         let written = await window.electronBridge.writeTempFile(
             ext === "hdf" ? "disk.hdf" : "disk.adf",
             binaryToBase64(binary)
         );
         if (!written.ok){
             desktop.showError("Couldn't prepare Amiga disk file: " + written.reason);
             return true;
         }

         let model = ext === "hdf" ? "A1200" : "A500";
         let rom = ext === "hdf" ? "kick31.rom" : "kick13.rom";
         let driveFlag = ext === "hdf" ? "--hard-drive-0=" : "--floppy-drive-0=";
         let result = await window.electronBridge.launchApp(
             "fs-uae --amiga-model=" + model +
             " --kickstart-file=/opt/amibase/plugins/uae/data/" + rom +
             " " + driveFlag + written.path
         );
         if (!result.ok) desktop.showError("Couldn't start Amiga emulator: " + result.reason);
         return true;
     }

     // execute an action on a file
     me.openFile = async function(file,plugin,action){
         console.log("openFile",file,plugin,action);
         if (plugin){
             if (plugin === "iframe"){
                 desktop.launchUrl(file);
                 return;
             }
             if (await tryLaunchNativeAmiga(file,plugin)) return;
             me.launchProgram({
                 url: "plugin:" + plugin
             }).then(window=>{
                 console.log("app loaded",window);
                 window.sendMessage("openFile",file);
             })
             return;
         }

         // default action
         if(file.handler){
             if (typeof file.handler === "string"){
                 me.launchProgram({
                     url: (file.handler.indexOf(":")<0?"plugin:":"") + file.handler
                 }).then(window=>{
                     console.log("app loaded",window);
                     window.sendMessage("openFile",file);
                 });
             }else{
                 file.handler(me);
             }
         }else{
             if (!file.filetype || !file.filetype.id) file.filetype = await me.detectFileType(file,true);
             console.error(file.filetype);
             let filetype = file.filetype;
             if (filetype){
                 let fileAction;
                 if (action && filetype.actions) fileAction = filetype.actions.find(a=>a.label === action);
                 if (!fileAction && filetype.handler) fileAction = filetype.handler.handle(file.file);
                 if (!fileAction && filetype.actions) fileAction=filetype.actions[0];

                 if (fileAction){
                     if (fileAction.plugin){
                         if (fileAction.plugin === "iframe"){
                             desktop.launchUrl(file);
                             return;
                         }
                         if (await tryLaunchNativeAmiga(file,fileAction.plugin)) return;
                         me.launchProgram({
                             url: "plugin:" + fileAction.plugin,
                         }).then(window=>{
                             console.log("app loaded");
                             window.sendMessage("openFile",file);
                         });
                     }
                 }else{
                     console.warn("can't open file , no filetype default action",file);
                     // fall back to hex editor?
                 }
             }else{
                 // file is not loaded yet?
                 console.warn("can't open file , no filetype handler",file);
             }
         }
     };

     me.downloadFile = async function(file){
         if (file.url){
                let link = document.createElement("a");
                link.href = file.url;
                link.setAttribute("download", file.name);
                link.target = "_blank";
                document.body.appendChild(link);
                link.click();
                link.parentNode.removeChild(link);
                console.error(file.name)
         }else{
             let content = await filesystem.readFile(file,true);
             console.error("content",content);
             let blob = new Blob([content.buffer], {type: "application/octet-stream"});

             let fileName = file.name;

             if (window.showSaveFilePicker){
                 try {
                     let handle = await window.showSaveFilePicker({
                         suggestedName: fileName
                     });
                     let writable = await handle.createWritable();
                     await writable.write(blob);
                     await writable.close();
                     return;
                 }catch (e){
                     console.error(e);
                     save();
                 }
             }else{
                 save();
             }

             async function save(){
                 if (!saveAs){
                     let module = await import("../lib/filesaver.js");
                     saveAs = module.default;
                 }
                 saveAs(blob,fileName);
             }
         }
     }

    me.launchProgram = function(config){
        if (typeof config === "string"){
            config = {
                url: config
            }
        }
        //var window = windows.find(function(w){return w.id === config.id});
        let plugin = config.url.split(":")[1];
        var label = config.label || plugin;

        let application = knownApplications.find(a=>a.plugin === plugin);

        var windowConfig = {
            caption: label,
            width: config.width,
            height: config.height,
            hasCustomUI: application && application.hasCustomUI,
        };

        return new Promise(function(next){
            let window = desktop.createWindow(windowConfig);

            applications.load(config.url,window).then(()=>{
                console.log("application loaded");
                next(window);
            });
        });
    };

    me.loadScript = function(url){
        console.warn("DEPRECATED - loadScript - please move to ES6 modules if possible");
        return new Promise(function(next){
            let script = document.createElement("script");
            script.onload = function(){
                next();
            };
            script.src = url;
            document.body.appendChild(script);
        });
    }

    me.requestFileOpen = async function(path,filter){
        let fileRequester = await me.loadLibrary("filerequester");
        return fileRequester.open({type:"open",path:path,filter:filter});
    }
    me.requestFileSave = async function(path){
        let fileRequester = await me.loadLibrary("filerequester");
        return fileRequester.open({type:"save",path:path});
    }

    me.inspectFile = async function(file,icon){
        let inspector = await me.loadLibrary("inspector.js");
        inspector.inspect(file,icon);
    }

    me.getObjectInfo = async function(object){
        let inspector = await me.loadLibrary("inspector.js");
        return await inspector.getInfo(object);
    }

    me.exploreFolder = async function(folder){
        let window = await me.launchProgram("filemanager");
        window.sendMessage("openFolder",folder);
    }

    return me;
};

export default System();

