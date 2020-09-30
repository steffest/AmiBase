var Desktop = function(){
    var me = AmiWindow({
        type: 'desktop',
        paddingLeft: 20,
        paddingTop: 30
    });

    me.left = 0;
    me.top = 0;

    var container;
    var windows=[];
    var focusElement={};
    var selectedElements=[];
    var selectBox;
    var loadTimer;

    me.init = function(){
        container = me.getInner();
        container.classList.add("desktop");
        container.id = "desktop";
        document.body.appendChild(container);
        me.height = document.body.offsetHeight;
        me.width = document.body.offsetWidth;

        container.addEventListener("mousedown",function(e){
            if (e.target.id === "desktop"){
                me.setFocusElement(me);
            }
        });

        UI.enableSelection(me,container);
        me.setDropTarget(container);
    };

    me.createWindow = function(config){
        var window = AmiWindow(config);
        container.appendChild(window.element);
        window.activate();
        windows.push(window);
        return window;
    };


    me.openDrawer = function(config){

        var window = windows.find(function(w){return w.id === config.id});

        window = undefined;
        if (window){
            window.activate();
        }else{
            window = Desktop.createWindow(config);
            if (config.items){
                // static structure
                config.items.forEach(function(item){
                    window.createIcon(item);
                });
                window.cleanUp();
            }
            if (config.handler){
                if (typeof config.handler === "string"){
                    Applications.load((config.handler.indexOf(":")<0?"plugin:":"") + config.handler,window);
                }else{
                    config.handler(me);
                }
            }else{
                if (config.path){
                    FileSystem.getDirectory(config.path,window);
                }
            }
        }
        if (config.onOpen) config.onOpen(window);
        return window;
    };

    me.openDrive = async function(config){
        var w = Desktop.createWindow(config);
        if (config.volume){
            FileSystem.getDirectory(config.volume + ":",w);
        }  else{
            me.openDrawer(config)
        }
    };

    me.launchProgram = function(config,onload){
        if (typeof config === "string"){
            config = {
                url: config
            }
        }
        var window = windows.find(function(w){return w.id === config.id});
        var label = config.label || config.url.split(":")[1];
        var windowConfig = {caption: label};

        // hmmm...
        if (config.url && config.url.indexOf("mediaplayer")>=0) windowConfig.border =  false;

        var w = Desktop.createWindow(windowConfig);
        if (onload && config.onload) {
            console.warn("WARNING: you have 2 onload handlers defined");
        }
        w.onload = onload || config.onload;
        Applications.load(config.url,w);
    };

    me.launchUrl = function(config){
        var label = config.url;
        var w = Desktop.createWindow(config.label || label);
        w.setSize(800,600);
        Applications.loadFrame(config.url,w);
    };

    me.removeWindow = function(window){
        var index = windows.findIndex(function(item){return item.id === window.id});
        if (index>=0){
            windows.splice(index,1);
        }
        window.element.remove();
    };

    me.getTopZindex = function(){
        var max = 1;
        windows.forEach(function(item){
            max = Math.max(max,item.zIndex);
        });
        me.getIcons().forEach(function(item){
            max = Math.max(max,item.zIndex);
        });
        return max;
    };

    me.setFocusElement = function(elm){
        var undoSelection = true;
        if (elm.type === "icon" && elm.isActive()) undoSelection = false;
        if (Input.isShiftDown) undoSelection=false;
        if (Input.isCtrlDown) undoSelection=false;

        if (undoSelection){
            me.getSelectedIcons().forEach(function(item){
                if (item.id !== elm.id){
                    item.deActivate();
                }
            });
        }

        if (focusElement.id !== elm.id){
            if (undoSelection) if (focusElement.deActivate) focusElement.deActivate();
            focusElement = elm;
            EventBus.trigger(EVENT.ACTIVATE_DESKTOP_ELEMENT);
        }

        MainMenu.hideMenu();

    };


    me.getFocusElement = function(){
        return focusElement;
    };
    
    me.uploadFile = function(){
        var input = document.createElement('input');
        input.type = 'file';
        input.onchange = function(e){
            me.handleUpload(e.target.files);
        };
        input.click();
    };

    me.loadFile = function(url,next){
        FetchService.arrayBuffer(url,async function(arrayBuffer){
            if (arrayBuffer){
                var fileName = url.split("/").pop();
                var fileInfo = await System.inspectFile(arrayBuffer,fileName);
                fileInfo.path = "http";
                next(fileInfo);
            }else{
                next({});
            }
        });
    };

    me.handleUpload = function(files){
        console.log("file uploaded");
        if (files.length){
            var uploadfile = files[0];

            var reader = new FileReader();
            reader.onload = async function(){
                //console.error(file.name);
                var fileInfo = await System.inspectFile(reader.result,uploadfile.name);
                fileInfo.path = "upload";
                fileInfo.mimeType = uploadfile.type;
                console.log("uploaded file is of type " + fileInfo.filetype.name);

                Desktop.createIcon({
                    label: fileInfo.file.name,
                    type:"file",
                    className: fileInfo.filetype.className,
                    attachment: fileInfo
                });

                Desktop.cleanUp();
            };
            reader.readAsArrayBuffer(uploadfile);
        }
    };



    me.handleFileOpen = function(attachment){
        console.log("handle file open", attachment);
        var filetype = attachment.filetype;
        if (filetype && filetype.handler){
            var action = filetype.handler.handle(attachment.file);
            if (!action && filetype.actions) action=filetype.actions[0];
            if (action){
                if (action.plugin){
                    Desktop.launchProgram({
                        url: "plugin:" + action.plugin,
                        onload: function(window){
                            console.log("app loaded");
                            Applications.sendMessage(window,"openfile",attachment);
                        }
                    });
                }
            }else{
                console.warn("can't open file , no filetype default action",attachment);
                // fall back to hex editor?
            }
        }else{
            // file is not loaded yet?
            console.warn("can't open file , no filetype handler",attachment);
        }
    };

    me.loadContent = function(url){
        url = url||"content/default.json";
        FetchService.json(url,function(data){
            data.forEach(function(item){
                Desktop.createIcon(item);
            });
            Desktop.cleanUp();
        });
    };

    me.loadTheme = function(name){
        return new Promise(function (resolve,reject) {
            var url = "themes/" + name + "/theme.css";
            var loaded = false;
            clearTimeout(loadTimer);
            loadTimer = setTimeout(function(){
                if (!loaded){
                    console.warn("Theme not loaded properly");
                    resolve();
                }
            },3000);

            function apply(){
                var remove = [];
                document.body.classList.forEach(function(className){
                    if (className.indexOf("theme_")>=0) remove.push(className);
                });
                remove.forEach(function(className){document.body.classList.remove(className)});
                document.body.classList.add("theme_" + name);
                User.storeSetting("theme",name);
                resolve();
            }

            loadCss(url,function(){
                clearTimeout(loadTimer);
                loaded=true;
                apply();
            });
        });
    };
    
    me.showMessage = function(message){
        Toolbar.showMessage(message);
    };



    return me;
}();