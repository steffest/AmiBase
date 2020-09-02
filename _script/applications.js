var Applications = function(){
    var me = {};
    var plugins={};
    var mainContext = window;

    window.addEventListener("message", receiveMessage, false);

    function receiveMessage(event) {
        //console.error("got message");
        //console.log(event);

        var message = event.data;

        if (message === "hello"){
            event.source.postMessage("hi there yourself!", event.origin);
        }

        handleMessage(message,event);

    }
    
    me.load = function(plugin,window){
        console.log("loading " + plugin + " into " + window.getCaption());
        window.setContent("loading");

        if (plugin.indexOf(":")>0){
            var pluginType = plugin.split(":")[0];
            plugin = plugin.split(":")[1];
        }else{
            pluginType = "plugin"
        }

        switch (pluginType) {
            case "plugin":
                // this is a trusted plugin, we can just load all files in the root space
                var pluginPath = "plugins/" + plugin + "/";
                FetchService.json(pluginPath + "config.json",function(config){
                    if (config){
                        console.error(config);
                        if (config.width && config.height){
                            window.setSize(config.width,config.height);
                        }
                        if (config.index){
                            if (config.index.indexOf("://")>0){
                                loadFrame(config.index,window);
                            }else{
                                FetchService.html(pluginPath + config.index,function(html){
                                    window.setContent(html);
                                });
                            }
                        }
                        if (config.scripts){
                            var initDone = false;
                            config.scripts.forEach(function(src){
                                loadScript(pluginPath + src,function(){
                                    if (!initDone && mainContext[plugin + '_plugin_init']){
                                        mainContext[plugin + '_plugin_init'](window);
                                        initDone=true;
                                    }
                                });
                            })
                        }
                        if (config.styles){
                            config.styles.forEach(function(src){
                                loadCss(pluginPath + src);
                            })
                        }
                    }else{
                        console.error("Error: Plugin " + plugin + " not found");
                    }
                });
                break;
            case "frame":
                pluginPath = "plugins/" + plugin + "/";
                FetchService.json(pluginPath + "config.json",function(config){
                    if (config){
                        console.error(config);
                        if (config.width && config.height){
                            window.setSize(config.width,config.height);
                        }
                        if (config.index){
                            var frameUrl = config.index;
                            if (config.index.indexOf("://")<0) frameUrl = pluginPath + frameUrl;
                            loadFrame(frameUrl,window);
                        }
                    }else{
                        console.error("Error: Plugin " + plugin + " not found");
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

        frame.addEventListener("mouseleave",function(){
           window.deActivateContent(true);
        });
        window.element.addEventListener("mouseenter",function(){
            if (!Mouse.isDown){
                window.activateContent(true);
            }
        });
        window.getInner().addEventListener("mousemove",function(){
            if (!Mouse.isDown){
                window.activateContent(true);
            }
        });
        window.element.addEventListener("click",function(){
            window.activate(true);
        });
        Security.registerUrl(url,window);
        frame.src = url;
    }
    me.loadFrame = loadFrame;

    function loadText(url,next){

    }

    function loadScript(src,onload){
        var script = document.createElement('script');
        script.src = src;
        if (onload) {
            script.onload = onload;
            script.onreadystatechange = script;
        }
        document.body.appendChild(script);
    }

    function loadCss(src,onload){
        var head  = document.getElementsByTagName('head')[0];
        var link  = document.createElement('link');
        link.rel  = 'stylesheet';
        link.type = 'text/css';
        link.href = src;
        head.appendChild(link);
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
                           event.source.postMessage({
                               registered: true,
                               id:isRegistered.id
                           }, event.origin);
                       }else{
                           console.error("Can't register app, url " + message.url + " was not launched from here.");
                           event.source.postMessage({
                               registered: false,
                           }, event.origin);
                       }
                        break;
                    case "setMenu":
                        console.error(appWindow);
                        appWindow.setMenu(message.data);
                        MainMenu.setMenu(message.data);
                        break;
                }
            }
        }
    }

    return me;
}();