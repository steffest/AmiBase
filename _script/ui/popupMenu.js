import eventBus from "../util/eventBus.js";
import {EVENT} from "../enum.js";
import desktop from "./desktop.js";
import {$div} from "../util/dom.js";
import system from "../system/system.js";
let PopupMenu = function(){

    var me = {};
    var popupMenu,popupMenuActive;
    var submenuHideDelay = 80;

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
                popupMenu.appendChild(createMenuItem(item,config));
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

    function createMenuItem(struct,config){
        var submenu;
        var hideSubmenuTimer;
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
            handleMenuClick(struct,config,submenu);
        };

        if (struct.items){
            submenu = $div("submenu");
            struct.items.forEach(function(item){
                if (item){
                    submenu.appendChild(createMenuItem(item));
                }
            });
            elm.appendChild(submenu);
            elm.classList.add("hassubmenu");
        }

        elm.onmouseover = function(){
            if (submenu && popupMenuActive){
                clearTimeout(hideSubmenuTimer);
                var items = elm.parentElement.children;
                for (var i = 0, max = items.length; i<max;i++){
                    var item = items[i];
                    if (item === elm || !item.classList || !item.classList.contains("hassubmenu")) continue;
                    var otherSubMenu;
                    for (var j = 0, jMax = item.children.length; j<jMax; j++){
                        if (item.children[j].classList.contains("submenu")){
                            otherSubMenu = item.children[j];
                            break;
                        }
                    }
                    if (otherSubMenu) otherSubMenu.classList.remove("active");
                }

                submenu.classList.add("active");
            }
        };

        elm.onmouseleave = function(){
            if (submenu){
                clearTimeout(hideSubmenuTimer);
                hideSubmenuTimer = setTimeout(function(){
                    submenu.classList.remove("active");
                    var activeChildren = submenu.querySelectorAll(".submenu.active");
                    for (var i = 0, max = activeChildren.length; i<max; i++){
                        activeChildren[i].classList.remove("active");
                    }
                },submenuHideDelay);
            }
        };

        return elm;
    }

    function handleMenuClick(item,config,submenu){
        if (submenu){
            submenu.classList.toggle("active");
            popupMenuActive = submenu.classList.contains("active");
        }else{
            me.hide();
            setTimeout(function(){
                if (item.action){
                    if (typeof item.action === "function"){
                        item.action();
                    }
                    if (typeof item.action === "string"){
                        system.launchProgram(item.action);
                    }
                }
                if (config.onAction) config.onAction(item);
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

