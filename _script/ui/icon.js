import {uuid, $div, cleanString} from "../util/dom.js";
import settings from "../settings.js";
import ui from "./ui.js";
import desktop from "./desktop.js";
import system from "../system/system.js";
import input from "../input.js";
import popupMenu from "./popupMenu.js";

let AmiIcon = function(object){
    var me = {
        type:"icon",
        object: object,
        id: uuid(),
        zIndex: 0
    };

    var icon = $div("icon " + (settings.useDelayedDrag?"delayed ":" ") + object.type);
    var img = $div("image " + " " + object.type);
    var label = $div("label","","<span>" + object.name + "</span>");

    if (object.icon){
        img.style.backgroundImage = "url('" + object.icon + "')";
        img.style.backgroundPosition = "center center";
        img.classList.add("cover");
    }

    icon.appendChild(img);
    icon.appendChild(label);

    me.setPosition = function(left,top,zIndex){
        me.left = left;
        me.top = top;
        icon.style.transform = "translate(" + left + "px," + top + "px)";
    };

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


    me.setLabel = function(name){
        label.innerHTML = "<span>" + name + "</span>";
        me.name = name;
    };

    // TODO move to global event handler
    icon.addEventListener('contextmenu', function(event){
        event.stopPropagation();

        if (input.isCtrlDown) return;
        event.preventDefault();

        var items = [];
        switch (object.type){
            case "file":
                items=[
                    {
                        label:"Open",
                        action: function(){
                            system.openFile(object);
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
                x: event.clientX,
                y: event.clientY
            })
        }
    });

    ui.onDoubleClick(icon,function(event){
        event.preventDefault();
        event.stopPropagation();
        object.open();
    });
    

    /*async function inspect(){
        let inspector = await system.loadLibrary("inspector.js");
        inspector.inspect(me.attachment);
    }*/

    me.element = icon;
    me.setPosition(50,50);
    ui.enableDrag(me,true);

    return me;
};

export default AmiIcon;