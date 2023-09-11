import $,{uuid, $div, cleanString} from "../util/dom.js";
import settings from "../settings.js";
import desktop from "./desktop.js";
import system from "../system/system.js";
import popupMenu from "./popupMenu.js";
import fileSystem from "../system/filesystem.js";
import ui from "./ui.js";
import Modal from "./modal.js";

let AmiIcon = function(object){
    var me = {
        type:"icon",
        object: object,
        id: uuid(),
        zIndex: 0
    };

    let icon = $(".icon" + (settings.useDelayedDrag?".delayed":"") + "." + object.type,
        {
            onDragStart: (e)=>{
                me.activate();
                return me.parent.getSelectedIcons();
            },
            globalDrag:true,
            onDoubleClick: (e)=>{
                console.log("doubleClick",object);
                object.open();
            },
            onContext: (e)=>{
                let modal = ui.getModal();
                if (modal) return;

                let x = e.clientX;
                let y = e.clientY;
                var items = [];
                switch (object.type){
                    case "file":
                    case "drive":
                        items=object.getActions(me);
                        break;
                    case "folder":
                        items=[
                            {label:"Open",
                                action: function(){system.exploreFolder(object)}
                            },
                            {
                                label:"Rename"
                            },
                            {
                                label:"Delete",
                                action: function(){
                                    fileSystem.deleteDirectory(object);
                                    me.parent.removeIcon(me);
                                }
                            }
                        ]
                        break;
                    default:

                }

                items.push({
                    label:"Info",
                    action: function(){
                        system.inspectFile(object);
                    }
                });

                if (items.length){
                    popupMenu.show({
                        items: items,
                        target: me,
                        x: x,
                        y: y,
                        onAction:(menuItem)=>{
                            if (menuItem.label === "Rename"){
                                label.innerHTML = "";
                                let input = $("input",{value:object.name});
                                let modal = Modal({
                                    content:input,
                                    onClose:(isOk)=>{
                                        let newName = isOk?input.value:object.name;
                                        if (newName !== object.name){
                                            fileSystem.rename(object.path,newName);
                                        }
                                        me.setLabel(newName);
                                        icon.classList.add("draggable");
                                    },
                                    autoCloseOnBlur:true
                                });
                                label.appendChild(modal);
                                input.focus();
                                icon.classList.remove("draggable");
                            }
                        }
                    })
                }
            }
        });
    var img = $div("glyph " + " " + object.type);
    var label = $div("label","","<span>" + object.name + "</span>");

    if (object.icon){
        img.style.backgroundImage = "url('" + object.icon + "')";
        img.style.backgroundPosition = "center center";
        img.classList.add("cover");
    }else{
        let name = object.path || object.url || object.name || object.label || "";
        system.getFileTypeFromName(name).then(fileType=>{
            if (fileType.className) img.classList.add(fileType.className);
            if (fileType.classType) img.classList.add(fileType.classType);
            img.classList.add(cleanString(object.name));
        });

        if (object.getIcon){
            object.getIcon().then(icon=>{
                if (icon && icon.tagName){
                    img.style.backgroundImage = "none";
                    img.innerHTML = "";
                    img.appendChild(icon);
                }
            });
        }
    }

    icon.appendChild(img);
    icon.appendChild(label);

    me.setPosition = function(left,top,zIndex){
        me.left = left;
        me.top = top;
        icon.style.transform = "translate(" + left + "px," + top + "px)";
    };

    me.setSize = function(width,height){
        me.width = width;
        me.height = height;
        icon.style.width = width + "px";
        icon.style.height = height + "px";
        img.style.width = width + "px";
        img.style.height = height + "px";
    }

    me.setImage = function(element){
        img.style.backgroundImage = "none";
        img.innerHTML = "";
        img.appendChild(element);
    }

    me.setIndex = function(zIndex){
        me.zIndex = zIndex+1;
        icon.style.zIndex = me.zIndex;
    };

    me.onDown = function(action){
        icon.onDown = action;
    }

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


    me.setLabel = function(name){
        label.innerHTML = "<span>" + name + "</span>";
        me.name = name;
    };


    me.element = icon;
    me.setPosition(50,50);

    return me;
};

export default AmiIcon;