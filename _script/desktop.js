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
        }
        if (config.onOpen) config.onOpen(window);
    };
    me.openDrive = me.openDrawer;

    me.launchProgram = function(config){
        if (typeof config === "string"){
            config = {
                url: config
            }
        }
        var window = windows.find(function(w){return w.id === config.id});
        var label = config.label || config.url.split(":")[1];
        var w = Desktop.createWindow(label);
        if (config.onload) {
            w.onload = config.onload;
        }
        Applications.load(config.url,w);
    };

    me.launchUrl = function(config){
        var label = config.url;
        var w = Desktop.createWindow(label);
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
            console.error(focusElement);
            EventBus.trigger(EVENT.ACTIVATE_DESKTOP_ELEMENT);
        }

        MainMenu.hideMenu();

    };


    me.getFocusElement = function(){
        return focusElement;
    };

    me.handleUpload = function(files){
        console.log("file uploaded");
        if (files.length){
            var file = files[0];

            var reader = new FileReader();
            reader.onload = async function(){
                //console.error(file.name);
                var filetype = await System.detectFileType(reader.result,file.name);

                Desktop.createIcon({label: file.name, type:"file",className: filetype.className, data: filetype, fileName: file.name});
                Desktop.cleanUp();

                console.error(filetype);
                //me.processFile(reader.result,file.name,function(isMod){
                    //if (UI) UI.setStatus("Ready");
                //});
            };
            reader.readAsArrayBuffer(file);
        }
    };

    me.handleFileOpen = function(fileInfo){
        console.log(fileInfo);
        var action;
        if (fileInfo.handler) action = fileInfo.handler.handle(fileInfo.file);

        if (!action && fileInfo.actions) action=fileInfo.actions[0];
        console.log(action);
        if (action){
            if (action.plugin){
                Desktop.launchProgram({
                    url: "plugin:" + action.plugin,
                    onload: function(){
                        Applications.sendMessage(action.plugin,"openfile",fileInfo);
                    }
                });
            }
        }else{
            // fall back to hex editor?
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
        var url = "themes/" + name + "/theme.css";
        var loaded = false;
        clearTimeout(loadTimer);
        loadTimer = setTimeout(function(){
            if (!loaded){
                console.warn("Theme not loaded properly");
            }
        },5000);

        function apply(){
            var remove = [];
            document.body.classList.forEach(function(className){
                if (className.indexOf("theme_")>=0) remove.push(className);
            });
            remove.forEach(function(className){document.body.classList.remove(className)});
            document.body.classList.add("theme_" + name);
        }

        loadCss(url,function(){
            clearTimeout(loadTimer);
            loaded=true;
            apply();
        });
    };



    return me;
}();