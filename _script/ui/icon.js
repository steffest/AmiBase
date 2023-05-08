import {uuid, $div, cleanString} from "../util/dom.js";
import settings from "../settings.js";
import amiFile from "../system/file.js";
import ui from "./ui.js";
import desktop from "./desktop.js";
import system from "../system/system.js";
import input from "../input.js";
import popupMenu from "./popupMenu.js";

let AmiIcon = function(config){
    var me = {
        type:"icon",
        id: uuid(),
        zIndex: 0
    };

    var icon = $div("icon " + (settings.useDelayedDrag?"delayed":""));
    var img = $div("image " + " " + config.type);
    var label = $div("label","","<span>" + config.label + "</span>");
    me.iconType = config.type || "file"; // TODO difference between iconType and type ?
    me.name = config.label;

    if (config.attachment){
        me.attachment = config.attachment;
    }else{
        if (me.iconType === "file"){
            me.attachment = new amiFile(config);
        }
        if (me.iconType === "drive" || me.iconType === "folder"){
            if (config.items){
                me.attachment = {
                    name: config.label,
                    items: config.items
                }
            }
        }
    }

    if (config.iconClassName){
        icon.className = "icon delayed " + config.iconClassName;
    }
    if (config.image){
        if (typeof config.image === "string"){
            img.style.backgroundImage = "url('" + config.image + "')";
            img.style.backgroundPosition = "center center";
            img.classList.add("cover");
        }else{
            let info = config.image[0];
            img.style.backgroundImage = "url('" + info.url + "')";
            if (info.width && info.height){
                img.style.width = info.width + "px";
                img.style.height = info.height + "px";
                icon.style.width = info.width + "px";
                img.classList.add("contain");
            }
        }

    }else if (config.icon){

        /*async function getIcon(){
            var filetype;
            var iconPath;
            if (config.iconInfo && config.iconInfo.filetype){
                filetype = config.iconInfo.filetype;
                iconPath = config.iconInfo.path;
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

        getIcon();*/



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

    me.setListPosition = function(top){
        me.listTop = top;
        icon.style.transform = "translate(0px," + top + "px)";
    };

    me.element = icon;
    me.setPosition(50,50);
    ui.enableDrag(me,true);

    me.setIndex = function(zIndex){
        me.zIndex = zIndex+1;
        icon.style.zIndex = me.zIndex;
    };

    me.moveToTop = function(){
        var zIndex = desktop.getTopZindex();
        if (zIndex>me.zIndex){
            me.setIndex(zIndex+1);
        }
    };

    me.activate = function(soft){
        if (!soft){
            me.moveToTop();
            desktop.setFocusElement(me);
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

    me.setLabel = function(name){
        console.error(config);
        label.innerHTML = "<span>" + name + "</span>";
        me.name = name;
        var path = config.path;
        if (!path && config.attachment && config.attachment.path) path = config.attachment.path;
        if (path) FileSystem.rename(path,name);
    };

    icon.addEventListener('contextmenu', function(event){
        event.stopPropagation();

        if (input.isCtrlDown) return;
        event.preventDefault();

        if (config.onContext){
            config.onContext(event.clientX,event.clientY);
        }else{
            var items = [];
            switch (me.iconType){
                case "file":
                    items=[
                        {
                            label:"Open",
                            action: function(){
                                system.openFile(me.attachment);
                            }
                        }
                    ]
                    break;
                default:

            }

            items.push({
                label:"Info",
                action: inspect,
            });

            if (items.length){
                popupMenu.show({
                    items: items,
                    target: me,
                    x: event.clientX,
                    y: event.clientY
                })
            }
        }
    });

    ui.onDoubleClick(icon,function(event){
        event.preventDefault();
        event.stopPropagation();
        let iconType = me.iconType;
        if (!iconType && icon.attachment) iconType= icon.attachment.type;
        switch(iconType){
            case "drive":
                desktop.openDrive(me.attachment);
                break;
            case "folder":
                desktop.openFolder(me.attachment);
                break;
            case "program":
                desktop.launchProgram(config);
                break;
            case "url":
                desktop.launchUrl(config);
                break;
            case "file":
                system.openFile(me.attachment);
                break;
        }
    });
    

    async function inspect(){
        let inspector = await system.loadLibrary("inspector.js");
        inspector.inspect(me.attachment);
    }

    return me;
};

export default AmiIcon;