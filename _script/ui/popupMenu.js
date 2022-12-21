import eventBus from "../util/eventBus.js";
import {EVENT} from "../enum.js";
import desktop from "./desktop.js";
import {$div} from "../util/dom.js";
let PopupMenu = function(){

    var me = {};
    var popupMenu,popupMenuActive;

    me.show = function(config){
        if (config.items && config.items.length){
            if (!popupMenu){
                popupMenu = $div("popupmenu","popupmenu");
                desktop.getScreen().appendChild(popupMenu);
            }

            popupMenu.style.left = config.x + "px";
            popupMenu.style.top = config.y + "px";

            popupMenu.innerHTML = "";
            config.items.forEach(function(item){
                popupMenu.appendChild(createMenuItem(item));
            });

            popupMenu.style.display = "block";

            desktop.setFocusElement(popupMenu);
            popupMenuActive = true;
        }
    };


    me.hide = function(){
        if (popupMenu && popupMenuActive){
            popupMenu.style.display = "none";
            popupMenuActive = false;
        }
    };

    function createMenuItem(struct){
        var elm = $div("menuitem");
        if (struct.label === "-"){
            elm.classList.add("divider");
            return elm;
        }
        if (struct.disabled){
            elm.classList.add("disabled");
        }

        elm.innerHTML = "<label>" + struct.label + "</label>";
        elm.onclick = function(){
            handleMenuClick(struct);
        };

        if (struct.items){
            var submenu = $div("submenu");
            struct.items.forEach(function(item){
                if (item){
                    submenu.appendChild(createMenuItem(item));
                }
            });
            elm.appendChild(submenu);
            struct.submenu = submenu;
            elm.classList.add("hassubmenu");
        }

        elm.onmouseover = function(){
            if (submenu && menuActive){
                var items = elm.parentElement.querySelectorAll(".hassubmenu");
                for (var i = 0, max = items.length; i<max;i++){
                    var otherSubMenu = items[i].querySelector(".submenu");
                    if (otherSubMenu) otherSubMenu.classList.remove("active");
                }

                submenu.classList.add("active");
            }
        };

        return elm;
    }

    function handleMenuClick(item){
        if (item.submenu){
            item.submenu.classList.toggle("active");
            popupMenuActive = item.submenu.classList.contains("active");
        }else{
            me.hide();
            setTimeout(function(){
                if (item.action){
                    if (typeof item.action === "function"){
                        item.action();
                    }
                    if (typeof item.action === "string"){
                        Desktop.launchProgram(item.action);
                    }
                }
            },0);
        }
    }

    eventBus.on(EVENT.ACTIVATE_DESKTOP_ELEMENT,function(){
        if (popupMenuActive){
            me.hide();
        }
        //var focusElement = Desktop.getFocusElement() || {};
        //switch (focusElement.type) {
        //    case "desktop":
        //        break;
        //}
    })

    return me;
};

export default PopupMenu();

