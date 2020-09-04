var AmiIcon = function(config){
    var me = {
        type:"icon",
        id: uuid(),
        zIndex: 0
    };

    var icon = $div("icon " + (Settings.useDelayedDrag?"delayed":""));
    var img = $div("image " + cleanString(config.label) + " " + config.type + " " + (config.className || "unknown"));
    var label = $div("label","","<span>" + config.label + "</span>");
    me.iconType = config.type;

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
    me.getConfig = function(){
        return config;
    };


    //icon.onmousedown = function(){
    //    me.activate();
    //};

    icon.ondblclick = function(){
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
        if (me.iconType === "file"){
            if (config.data && config.data.handler){
                //console.error(config);
                var action = config.data.handler.handle(config.file);
                if (!action && config.data.actions) action=config.data.actions[0];
                if (action){
                    if (action.plugin){
                        Desktop.launchProgram({
                            url: "plugin:" + action.plugin,
                            onload: function(window){
                                console.log("app loaded");
                                Applications.sendMessage(action.plugin,"openfile",config,window);
                            }
                        });
                    }
                }else{
                    // fall back to hex editor?
                }
            }else{
                if (config.onOpen) config.onOpen();
            }
        }
    };

    return me;
};