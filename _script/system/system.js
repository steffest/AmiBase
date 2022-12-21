/*
    System: load libraries
*/

import settings from "../settings.js";
import {loadScript, loadCss} from "../util/dom.js";
import fetchService from "../util/fetchService.js";
import desktop from "../ui/desktop.js";
import applications from "../applications.js";

let System = function(){
    var me = {};
    var libraries = {};

    me.loadEnvironment = function(){
        return new Promise(function(next){
            var env = document.location.search;

            if (window.location.href.indexOf("choice.be")>0) env=".choice";

            if (env){
                env = env.substring(1);
                if (env.indexOf("=")) env=env.split("=")[0];
                settings.tenant = env;

                function setEnv(){
                    console.log("Setting environment to " + env);
                    if (ENV && ENV.settings){
                        for (var key in ENV.settings){
                            settings[key] = ENV.settings[key];
                        }
                    }
                    next();
                }

               loadScript("config/" + env + ".js",setEnv, next);
            }else{
                next();
            }
        });
    };

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
                            plugin.config=config;

                            function loadPluginScripts(){
                                import("../../" + pluginPath + "/" + config.module).then(module=>{
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

    let loadScripts = function(pluginPath,list,next){
        console.error("DEPRECATED");
        if (list && list.length){
            var loadCount = 0;
            var loadTarget = list.length;

            if (typeof list[0] === "string"){
                // load all scripts in parallel
                list.forEach(function(src){
                    loadScript(pluginPath + src,function(){
                        loadCount++;
                        if (loadCount>=loadTarget){
                            if (next) next();
                        }
                    });
                })
            }else{
                // load scripts in sequential groups;
                function loadNextGroup(){
                    var group = list.shift();
                    var loadCount = 0;
                    var loadTarget = group.length;
                    group.forEach(function(src){
                        loadScript(pluginPath + src,function(){
                            loadCount++;
                            if (loadCount>=loadTarget){
                                if (list.length){
                                    loadNextGroup();
                                }else{
                                    if (next) next();
                                }
                            }
                        });
                    })
                }
                loadNextGroup();
            }

        }else{
            if (next) next();
        }

    };
    me.loadScripts = loadScripts;

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
         console.error(file,tryHard);
         let fileTypeLib = await me.loadLibrary("filetypes");
         return fileTypeLib.detect(file,tryHard);
     };
     
     // execute an action on a file
     me.openFile = async function(file,plugin,action){
         
         console.error("openFile",file,plugin,action);

         if (plugin){
             desktop.launchProgram({
                 url: "plugin:" + plugin,
                 onload: function(window){
                     applications.sendMessage(window,"openfile",file);
                 }
             });
             return;
         }

         // default action
         if(file.handler){
             if (typeof file.handler === "string"){
                 desktop.launchProgram({
                     url: (file.handler.indexOf(":")<0?"plugin:":"") + file.handler,
                     onload: function(window){
                         console.log("app loaded",window);
                         applications.sendMessage(window,"openfile",file);
                     }
                 });
             }else{
                 file.handler(me);
             }
         }else{
             if (!file.filetype || !file.filetype.id) file.filetype = await me.detectFileType(file,true);
            console.error(file.filetype);
             var filetype = file.filetype;
             if (filetype && filetype.handler){
                 var thisAction;
                 if (action && filetype.actions){
                     thisAction = filetype.actions.find(a=>a.label === action);
                 }
                 if (!thisAction) thisAction = filetype.handler.handle(file.file);
                 if (!thisAction && filetype.actions) thisAction=filetype.actions[0];
                 if (thisAction){
                     if (thisAction.plugin){
                         desktop.launchProgram({
                             url: "plugin:" + thisAction.plugin,
                             onload: function(window){
                                 console.log("app loaded");
                                 console.log(file);
                                 applications.sendMessage(window,"openfile",file);
                             }
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


    me.requestFile = async function(){
        let fileRequester = await me.loadLibrary("filerequester");
        fileRequester.open();
    }

    return me;
};

export default System();

