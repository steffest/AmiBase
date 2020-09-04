var Applications = function(){
    var me = {};
    var plugins={};
    var mainContext = window;

    window.addEventListener("message", receiveMessage, false);

    function receiveMessage(event) {
        var message = event.data;
        handleMessage(message,event);
    }

    me.sendMessage = function(pluginName,message,data,window){
        // first check if application has registered the message directly
        var plugin = getPlugin(pluginName);
        var action;
        if (plugin && plugin.actions && plugin.actions[message]){
            action = plugin.actions[message] || plugin.actions["sendMessage"];
        }else{
            // sending message to window
           if(window) window.sendMessage(message,data);
        }
        if (action) action(data);
    };

    
    me.load = function(pluginName,appWindow){
        console.log("loading " + pluginName + " into " + appWindow.getCaption());
        appWindow.setContent("loading");

        if (pluginName.indexOf(":")>0){
            var pluginType = pluginName.split(":")[0];
            pluginName = pluginName.split(":")[1];
        }else{
            pluginType = "plugin"
        }

        switch (pluginType) {
            case "plugin":
                // this is a trusted plugin, we can just load all files in the root space
                var plugin = plugins[pluginName];
                if (plugin){
                    console.log("plugin already loaded");
                    var config = plugin.config;
                    if (config.width && config.height) appWindow.setSize(config.width,config.height);
                    if (config.index){
                        if (config.index.indexOf("://")){
                            loadFrame(config.index,appWindow);
                        }else{
                            appWindow.setContent(plugin.html);
                        }
                        if (plugin.onInit) mainContext[plugin.onInit](appWindow);
                    }else{
                        if (plugin.onInit) mainContext[plugin.onInit](appWindow);
                    }
                }else{
                    plugin={};
                    var pluginPath = "plugins/" + pluginName + "/";
                    FetchService.json(pluginPath + "config.json",function(config){
                        if (config){
                            plugin.config=config;
                            if (config.width && config.height) appWindow.setSize(config.width,config.height);

                            function initScripts(){
                                if (config.scripts){
                                    var initDone = false;
                                    System.loadScripts(pluginPath,config.scripts,function(){
                                        if (!initDone && mainContext[pluginName + '_plugin_init']){
                                            plugin.onInit = pluginName + '_plugin_init';
                                            plugins[pluginName] = plugin;
                                            mainContext[plugin.onInit](appWindow);
                                            initDone=true;
                                        }
                                    });
                                }else{
                                    plugins[pluginName] = plugin;
                                }
                            }

                            if (config.index){
                                if (config.index.indexOf("://")>0){
                                    loadFrame(config.index,appWindow);
                                }else{
                                    FetchService.html(pluginPath + config.index,function(html){
                                        plugin.html = html;
                                        appWindow.setContent(html);
                                        initScripts();
                                    });
                                }
                            }else{
                                initScripts();
                            }

                            if (config.styles){
                                config.styles.forEach(function(src){
                                    loadCss(pluginPath + src);
                                })
                            }
                        }else{
                            console.error("Error: Plugin " + pluginName + " not found");
                        }
                    });
                }
                break;
            case "frame":
                pluginPath = "plugins/" + pluginName + "/";
                FetchService.json(pluginPath + "config.json",function(config){
                    if (config){
                        if (config.width && config.height){
                            appWindow.setSize(config.width,config.height);
                        }
                        if (config.index){
                            var frameUrl = config.index;
                            if (config.index.indexOf("://")<0) frameUrl = pluginPath + frameUrl;
                            loadFrame(frameUrl,appWindow);
                        }
                    }else{
                        console.error("Error: Plugin " + pluginName + " not found");
                    }
                });
                break;
            default:
                console.error("Error: Unknown plugin type: " + pluginType);
        }
    };

    function loadFrame(url,window){
        var frame = document.createElement("iframe");
        window.setContent(frame);
        window.isApplication = true;

        frame.addEventListener("mouseleave",function(){
           window.deActivateContent(true);
        });
        Security.registerUrl(url,window);
        frame.src = url;
    }
    me.loadFrame = loadFrame;

    me.registerApplicationActions = function(pluginName,actions){
        var plugin = getPlugin(pluginName);
        if (plugin){
            plugin.actions = actions;
        }else{
            console.warn("plugin " + pluginName + " not found");
        }
    };

    me.getPlugins = function(){
        return plugins;
    };

    function getPlugin(pluginName){
        if (pluginName.indexOf(":")>0){
            pluginName = pluginName.split(":")[1];
        }

        return plugins[pluginName];
    }

    function handleMessage(message,event){
        console.log("Got Message",message);
        if (typeof message === "string"){

        }else{
            var command = message.command;
            var windowId = message.windowId;


            if (command !== "register"){
                var appWindow = Security.getWindow(windowId);
                if (!appWindow){
                    console.error("Application window not found, app is not registered");
                    return;
                }
            }

            if (command){
                switch (command) {
                    case "register":
                       var isRegistered = Security.registerWindow(message.url);
                       if (isRegistered){
                           var window = isRegistered.window;
                           window.messageTarget = event.source;
                           window.messageOrigin = event.origin;
                           event.source.postMessage({
                               registered: true,
                               id:isRegistered.id
                           }, event.origin);
                           if (isRegistered.onload) isRegistered.onload(window);
                       }else{
                           console.error("Can't register app, url " + message.url + " was not launched from here.");
                           event.source.postMessage({
                               registered: false,
                           }, event.origin);
                       }
                        break;
                    case "ready":
                        // app is completely loaded and ready for input
                        if (appWindow.onload) appWindow.onload(appWindow);
                        break;
                    case "focus":
                        appWindow.activate();
                        break;
                    case "setMenu":
                        appWindow.setMenu(message.data);
                        MainMenu.setMenu(message.data,appWindow);
                        break;
                }
            }
        }
    }

    return me;
}();