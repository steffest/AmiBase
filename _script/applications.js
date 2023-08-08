import security from "./security.js";
import fetchService from "./util/fetchService.js";
import system from "./system/system.js";
import mainMenu from "./ui/mainmenu.js";
import fileSystem from "./system/filesystem.js";
import {loadCss} from "./util/dom.js";

/*
Provides a bridge for external applications and plugins
There are 2 types of plugins:
 - trusted ones that run directly in the same context as AmiBase,
 they can access all the methods (end DOM) of amiBase
 - external ones that run in their own iframe and can only communicate with amibase through a messageBus
 */

let Applications = function(){
    var me = {};
    var plugins={};
    var mainContext = window;

    window.addEventListener("message", receiveMessage, false);

    function receiveMessage(event) {
        var message = event.data;
        if (message === "process-tick") return; // message form audioclock
        handleMessage(message,event);
    }

    me.sendMessage = function(window,message,data){
        // first check if application has registered the message directly
        var plugin = getPlugin(window.plugin);
        var action;
        if (plugin && plugin.actions && plugin.actions[message]){
            action = plugin.actions[message] || plugin.actions["sendMessage"];
            // Do we need to send the icon or the data?
            if (action) action(data);
        }else{
            // sending message to window
           if(window) window.sendMessage(message,data);
        }
    };

    
    me.load = function(pluginName,appWindow){
        console.log("loading " + pluginName + " into " + appWindow.getCaption());
        return new Promise(function(next){
            appWindow.setContent("loading");
            appWindow.plugin = pluginName;

            if (pluginName.indexOf(":")>0){
                var pluginType = pluginName.split(":")[0];
                pluginName = pluginName.split(":")[1];
            }else{
                pluginType = "plugin"
            }
            let pluginPath = "plugins/" + pluginName + "/";

            switch (pluginType) {
                case "plugin":
                    // this is a trusted plugin, we can just load all files
                    var plugin = plugins[pluginName];

                    if (plugin){
                        console.log("plugin already loaded");
                        appWindow.isApplication = true;
                        var config = plugin.config;
                        if (config.width && config.height) appWindow.setSize(config.width,config.height);
                        if (config.left && config.top) appWindow.setPosition(config.left,config.top);
                        //console.error(config);

                        function initPlugin(){
                            if (plugin.init){
                                let f = plugin.init;
                                if (typeof f === "string") f = mainContext[plugin.init];
                                f(appWindow);
                                next();
                            }
                        }

                        if (config.index){
                            if (config.index.indexOf("://")>0){
                                loadFrame(config.index,appWindow);
                            }else{
                                appWindow.setContent(plugin.html);
                            }
                            initPlugin();
                        }else{
                            initPlugin();
                        }
                    }else{
                        plugin={};
                        fetchService.json(pluginPath + "config.json",function(config){
                            if (config){
                                appWindow.isApplication = true;
                                plugin.config=config;
                                if (config.width && config.height) appWindow.setSize(config.width,config.height);
                                if (config.left && config.top) appWindow.setPosition(config.left,config.top);

                                function initScripts(){
                                    if (config.scripts) {
                                        console.error("DEPRECATED !!!!!")
                                        var initDone = false;
                                        system.loadScripts(pluginPath, config.scripts, function () {
                                            if (!initDone && mainContext[pluginName + '_plugin_init']) {
                                                plugin.init = pluginName + '_plugin_init';
                                                plugins[pluginName] = plugin;
                                                mainContext[plugin.init](appWindow);
                                                initDone = true;
                                            }
                                        });
                                    }else if (config.module){
                                        import("../" + pluginPath + config.module).then(p=>{
                                            plugin.handler = p.default;
                                            plugins[pluginName] = plugin;
                                            if (plugin.handler.init){
                                                plugin.init = plugin.handler.init
                                                plugin.init(appWindow,me.amiBridge());
                                            }
                                            initDone = true;
                                            next();
                                        });
                                    }else{
                                        plugins[pluginName] = plugin;
                                        initDone = true;
                                        next();
                                    }
                                }

                                if (config.index){
                                    if (config.index.indexOf("://")>0){
                                        loadFrame(config.index,appWindow);
                                    }else{
                                        fetchService.html(pluginPath + config.index,function(html){
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
                    fetchService.json(pluginPath + "config.json",function(config){
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
        })
    };

    function loadFrame(url,window){
        var frame = document.createElement("iframe");
        window.setContent(frame);
        window.isApplication = true;

        frame.addEventListener("mouseleave",function(){
           window.deActivateContent(true);
        });
        security.registerUrl(url,window);
        frame.src = url;
    }
    me.loadFrame = loadFrame;

    function registerApplicationActions(pluginName,actions){
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
        pluginName = pluginName||"";
        if (pluginName.indexOf(":")>0){
            pluginName = pluginName.split(":")[1];
        }
        return plugins[pluginName];
    }

    function handleMessage(message,event){
        //console.error(message.toString);
        if (message && message.target && message.target.indexOf("metamask-")===0) return;

        console.log("Got Message",message);
        if (typeof message === "string"){

        }else{
            var command = message.command;
            var windowId = message.windowId;


            if (command !== "register"){
                var appWindow = security.getWindow(windowId);
                if (!appWindow){
                    console.error("Application window not found, app is not registered");
                    return;
                }
            }

            if (command){
                switch (command) {
                    case "register":
                       var isRegistered = security.registerWindow(message.url);
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
                        mainMenu.setMenu(message.data,appWindow);
                        break;
                    case "requestFile":
                        console.error("requestFile");
                        system.requestFile().then(file=>{
                            var callbackId = message.callbackId;
                            console.error(callbackId);
                            event.source.postMessage({
                                message: "callback",
                                data: {
                                    id: callbackId,
                                    data: file.path,
                                    filename:  file.name
                                }
                            }, event.origin);
                        })
                    case "readFile":
                        var data = message.data;
                        var callbackId = message.callbackId;
                        fileSystem.readFile(data.path,data.asBinary).then(file => {
                            console.error(file);
                            event.source.postMessage({
                                message: "callback",
                                data: {
                                    id: callbackId,
                                    data: file.buffer,
                                    filename:  file.name
                                }
                            }, event.origin);

                        });
                        break;
                }
            }
        }
    }

    // main object to pass to trusted plugins and apps
    me.amiBridge = function(){
        return{
            registerApplicationActions: registerApplicationActions,
            service:{
                fetch: fetchService
            },
            fileSystem: fileSystem,
            system: system
        }
    }

    // needed for backwards compatibility: :-/
    me.registerApplicationActions = registerApplicationActions;
    window.Applications = me;

    return me;
};

export default Applications();