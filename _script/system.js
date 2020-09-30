/*
    System: load libraries
*/
var System = function(){
    var me = {};
    var libraries = {};

    me.loadLibrary = function(libraryName,callback){
        return new Promise(function(resolve,reject){
            var next = callback || resolve;
            var plugin = libraries[libraryName];
            if (plugin && plugin.loaded){
                console.log("Library " + libraryName + " already loaded");
                next();
            }else{
                console.log("Loading library " + libraryName);
                plugin = {};
                var pluginPath = "plugins/" + libraryName + "/";
                if (libraryName.indexOf(".js")>0){
                    // load single file
                    pluginPath = "plugins/" + libraryName.substr(0,libraryName.length-3) + "/" + libraryName;
                    loadScript(pluginPath,function(){
                        console.log(libraryName + " loaded");
                        next();
                    });
                }else{
                    FetchService.json(pluginPath + "config.json").then(function(config){
                        if (config){
                            plugin.config=config;

                            function loadPluginScripts(){
                                loadScripts(pluginPath,config.scripts,function(){
                                    // scripts are loaded but not necessarily parsed;
                                    setTimeout(function(){
                                        plugin.loaded = true;
                                        libraries[libraryName] = plugin;
                                        next();
                                    },10);
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
                            next();
                        }
                    });
                }
            }
        });
    };

    loadScripts = function(pluginPath,list,next){
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

    // create a "file" structrure and detects type
    me.inspectFile = async function(arrayBuffer, name){
        await me.loadLibrary("filetypes");
        return new Promise(function(resolve){
            var file = new BinaryStream(arrayBuffer,true); // set to True if coming from Amiga
            file.name = name;
            var filetype = FileType.detect(file);
            resolve({
                type: "file",
                file:file,
                filetype:filetype
            });
        });
    };

    // first try to detect filetype by inspecting content
    // then fallback on extention
     me.detectFileType = async function(file){
         await me.loadLibrary("filetypes");
         return new Promise(function(resolve){
             resolve(FileType.detect(file));
         });
    };

    return me;
}();

