var AmiIcon = function(config){
    var me = {
        type:"icon",
        id: uuid(),
        zIndex: 0
    };

    var attachment = config.attachment || undefined;

    var icon = $div("icon " + (Settings.useDelayedDrag?"delayed":""));
    var img = $div("image " + " " + config.type);
    var label = $div("label","","<span>" + config.label + "</span>");
    me.iconType = config.type || "file";
    me.name = config.label;


    if (config.iconClassName){
        icon.className = "icon delayed " + config.iconClassName;
    }
    if (config.image){
        img.style.backgroundImage = "url('" + config.image + "')";
        img.classList.add("cover");
    }else if (config.icon){

        async function getIcon(){
            var filetype;
            var iconPath;
            if (config.attachment && config.attachment.filetype){
                filetype = config.attachment.filetype;
                iconPath = config.attachment.path;
            }else{
                filetype = await System.detectFileType(config.icon);
                iconPath = config.icon;
            }

            var canvas = document.createElement("canvas");
            canvas.width = 96;
            canvas.height = 48;

            function setCanvas(){
                img.style.backgroundImage = "url('" + canvas.toDataURL() + "')";
                img.classList.add("canvasicon");
                img.classList.remove(config.type);
                if (config.icon2) img.classList.add("dual");
            }

            if (filetype.handler && filetype.handler.parse){
                // special icon format

                FileSystem.readFile(iconPath,true).then(file => {
                    filetype.handler.parse(file,(icon) => {
                        var c = filetype.handler.getImage(icon);
                        var c2 = filetype.handler.getImage(icon,1);
                        if (c){
                            canvas.getContext("2d").drawImage(c,0,0);
                            if (c2) canvas.getContext("2d").drawImage(c2,48,0);
                            config.icon2 = true;
                            setCanvas();
                        }
                    });
                })
            }else{
                // assume plain image
                var _img = new Image();
                _img.crossOrigin="anonymous";
                _img.onload = function(){
                    canvas.getContext("2d").drawImage(_img,0,0);
                    if (config.icon2){
                        var _img2 = new Image();
                        _img2.onload = function(){
                            canvas.getContext("2d").drawImage(_img2,48,0);
                            setCanvas();
                        };
                        _img2.src = config.icon2;
                    }else{
                        setCanvas();
                    }
                };
                _img.src = config.icon;
            }

        }




        getIcon();

    }else{
        img.classList.add(cleanString(config.label));
        img.classList.add((config.className || "unknown"));
    }

    icon.appendChild(img);
    icon.appendChild(label);

    me.setPosition = function(left,top,zIndex){
        me.left = left;
        me.top = top;
        icon.style.transform = "translate(" + left + "px," + top + "px)";
    };

    me.element = icon;
    me.setPosition(50,50);
    UI.enableDrag(me,true);

    me.setIndex = function(zIndex){
        me.zIndex = zIndex+1;
        icon.style.zIndex = me.zIndex;
    };

    me.moveToTop = function(){
        var zIndex = Desktop.getTopZindex();
        if (zIndex>me.zIndex){
            me.setIndex(zIndex+1);
        }
    };

    me.activate = function(soft){
        if (!soft){
            me.moveToTop();
            Desktop.setFocusElement(me);
        }
        icon.classList.add("active");
    };

    me.deActivate = function(soft){
        icon.classList.remove("active");
    };

    me.isActive = function(){
        return  icon.classList.contains("active");
    };

    me.hide = function(){
        icon.classList.add("hidden");
    };
    me.show = function(){
        icon.classList.remove("hidden");
        icon.classList.remove("ghost");
    };
    me.ghost = function(){
        icon.classList.add("ghost");
    };
    me.clone = function(){
        // returns a clone with absolute position coordinates relative to the desktop
        var clone = icon.cloneNode(true);
        var pos =  icon.getBoundingClientRect();
        clone.style.left = pos.left + "px";
        clone.style.top = pos.top + "px";
        clone.style.transform = "";
        return clone;
    };

    /**
     * attachment
     * @file BinaryStream object
     * @filetype : detected filetype
     * @type "file" or "drawer" or ...
     * @path string - path where the attachment comes from
     */
    me.setAttachment = function(data){
        attachment=data;
    };
    me.getAttachment = function(next){
        // might be delayed if the file content is not readily available
        if (attachment){
            next(attachment)
        }else{
            if (config.getAttachment){
                config.getAttachment(next);
            }else{
                // load File?
                if (config.type === "file" && config.url){
                    Desktop.loadFile(config.url,function(attachment){
                        next(attachment);
                    });
                }else{
                    next({});
                }
                
            }
        }
    };

    me.getConfig = function(){
        return config;
    };

    me.setLabel = function(name){
        console.error(config);
        label.innerHTML = "<span>" + name + "</span>";
        me.name = name;
        var path = config.path;
        if (!path && config.attachment && config.attachment.path) path = config.attachment.path;
        if (path) FileSystem.rename(path,name);
    };


    //icon.onmousedown = function(){
    //    me.activate();
    //};

    icon.ondblclick = function(){
        console.error(me);
        if (me.iconType === "drive"){
            config.id = config.id||uuid();
            Desktop.openDrive(config);
        }
        if (me.iconType === "drawer"){
            config.id = config.id||uuid();
            Desktop.openDrawer(config);
        }
        if (me.iconType === "program"){
            Desktop.launchProgram(config);
        }
        if (me.iconType === "url"){
            Desktop.launchUrl(config);
        }
        if (me.iconType === "file" || me.iconType === "action"){
            console.log(config);
            if (config.onOpen){
                config.onOpen();
            }else if(config.handler){
                if (typeof config.handler === "string"){
                    Desktop.launchProgram({
                        url: (config.handler.indexOf(":")<0?"plugin:":"") + config.handler,
                        onload: function(window){
                            console.log("app loaded",window);
                            Applications.sendMessage(window,"openfile",config);
                        }
                    });
                }else{
                    config.handler(me);
                }
            }else{
                me.getAttachment(function(attachment){
                    Desktop.handleFileOpen(attachment);
                });
            }
        }
        
    };

    return me;
};