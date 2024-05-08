import $ from "../util/dom.js";
import settings from "../settings.js";
import desktop from "./desktop.js";
import eventBus from "../util/eventBus.js";
import {EVENT} from "../enum.js";
import applications from "../applications.js";
import system from "../system/system.js";
import fileSystem from "../system/filesystem.js";
import amiObject from "../system/object.js";

let MainMenu = function(){

    var me = {};
    var root;
    var menuActive;
    var activeSubmenu;
    var currentMenuTarget;
    var messageContainer;

    var mainMenu = [
        {
            label:"System",
            items:[
                {
                    label:"About",
                    action: function(){
                        system.launchProgram({
                            url: "plugin:notepad",
                            width: 400,
                            height: 200
                        }).then(window=>{
                            applications.sendMessage(window,"openFile",amiObject({
                                type: "file",
                                label: "About " + settings.name || "Amibase",
                                url: settings.aboutUrl || "content/files/about.txt"
                            }));
                        });

                    },
                },
                {
                    label:"Open File",
                    action: async ()=>{
                        let file = await system.requestFileOpen();
                        if (file){
                            system.openFile(file)
                        }
                    }
                },
                {
                    label:"Upload File",
                    action: function(){
                        desktop.uploadFile();
                    }
                },
                {
                    label:"Mount Drive",
                    action: function(){
                        desktop.mountWithDialog();
                    }
                },
                {
                    label:"New Drawer",
                    action: function(){
                        let newName = "My Content";
                        let path = "desktop:" + newName;
                        fileSystem.createDirectory("desktop:",newName).then(result=>{
                            desktop.createIcon(amiObject({label: result.name, path:path, type: "folder", items: result.items || []}));
                            desktop.cleanUp();
                        })
                    }
                },
                {
                    label:"New File",
                    action: ()=>{
                        let newName = "My File.txt";
                        let path = "desktop:" + newName;
                        fileSystem.writeFile(path,"").then(result=>{
                            desktop.createIcon(amiObject({label: result.name, path: path,type: "file"}));
                            desktop.cleanUp();
                        })
                    }
                },
                {
                    label:"Settings",
                    action: function(){
                        system.launchProgram({
                            url: "plugin:settings",
                            width: 400,
                            height: 200
                        });
                    }
                }
            ]
        }
    ];

    var iconMenu = [
        {
            label:"Icon",
            items:[
                {
                    label:"Rename",
                    action: function(){
                        var icon =  desktop.getFocusElement();
                        let oldName = icon.object.name;
                        let path = icon.object.path;
                        var name =  prompt("Enter the new name:",oldName);
                        if (name){
                            icon.setLabel(name);
                            fileSystem.rename(path,name);
                        }
                    }
                },
                {
                    label:"Delete",
                    action: async function(){
                        var icon =  desktop.getFocusElement();
                        fileSystem.deleteFile(icon.object);
                        icon.parent.removeIcon(icon);
                    }
                },
                {
                    label:"Info",
                    action: async function(){
                        var icon =  desktop.getFocusElement();
                        let inspector = await system.loadLibrary("inspector.js");
                        inspector.inspect(icon.object);
                    }
                }
            ]
        }
    ];

    var windowMenu = [
        {
            label:"Window",
            items:[
                {
                    label:"Close",
                    action: function(){
                        var w =  desktop.getFocusElement();
                        if (w && w.close) w.close();
                    }
                },

            ]
        }
    ];

    me.init = function(){
        var topbar = $(".topbar",
            $(".homebutton",$("div"),(settings.name || "Amibase"),$("small","v" + settings.version)),
            messageContainer = $(".message"),
            root=$(".menu")
        );

        desktop.getScreen().appendChild(topbar);

        if (settings.themes && settings.themes.length>1){
            var themes = {
                label:"Theme",
                items:[]
            };
            settings.themes.forEach(theme => {
                themes.items.push({
                    label: theme.label,
                    action: function(){
                        desktop.loadTheme(theme.name);
                    }
                });
            });
            mainMenu.push(themes);
        }

       if (settings.mainMenu) mainMenu = mainMenu.concat(settings.mainMenu);

        windowMenu = windowMenu.concat(mainMenu);
        iconMenu = iconMenu.concat(mainMenu);

        me.setMenu(mainMenu);

        eventBus.on(EVENT.ACTIVATE_DESKTOP_ELEMENT,function(){
            var focusElement = desktop.getFocusElement() || {};

            switch (focusElement.type) {
                case "desktop":
                    me.setMenu(mainMenu);
                    break;
                case "icon":
                    iconMenu[0].items[2] = undefined;
                    iconMenu[0].items[3] = undefined;
                    me.setMenu(iconMenu);
                    break;
                case "window":
                    if (focusElement.getMenu()){
                        me.setMenu(focusElement.getMenu(),focusElement);
                    }else{
                        me.setMenu(windowMenu);
                    }
                    break;
                case "folder":
                case "drive":
                    if (focusElement.getMenu()){
                        me.setMenu(focusElement.getMenu(),focusElement);
                    }else{
                        me.setMenu(windowMenu);
                    }
                    break;
            }
        })

    };

    me.setMenu = function(menu,window){
        root.innerHTML = "";
        menu.forEach(function(item){
            if (item){
                root.appendChild(createMenuItem(item));
            }
        });
        menuActive=false;
        currentMenuTarget = window;
    };

    me.getMenu = function(type){
        if (type === "desktop") return mainMenu[0].items;
        if (type === "window") return windowMenu[0].items;
        if (type === "icon") return iconMenu[0].items;
        return mainMenu;
    }

    me.hideMenu = function(){
        var items = root.querySelectorAll(".hassubmenu");
        for (var i = 0, max = items.length; i<max;i++){
            var subMenu = items[i].querySelector(".submenu");
            if (subMenu) subMenu.classList.remove("active");
        }
        menuActive = false;
    };

    me.setMenuItem = (id,label,enabled)=>{
        let menuItem = root.querySelector("#am_" + id);
        if (menuItem){
            if (label){
                let labelElm = menuItem.querySelector('label');
                if (labelElm) labelElm.innerHTML = label;
            }
            if (typeof enabled === "boolean") menuItem.classList.toggle("disabled",!enabled);
        }
    }
    
    me.showMessage = function(message){
        messageContainer.innerHTML = message;
    };

    function createMenuItem(config){
        if (config.label === "-"){
           return $(".menuitem.divider")
        }

        let elm = $(".menuitem"+(config.disabled?".disabled":"")+(config.items?".hassubmenu":""),
            {onClick:()=> {handleMenuClick(config)},
            id:config.id?"am_" + config.id:undefined},
            $("label",config.label)
        );

        if (config.items){
            var submenu = $(".submenu");
            config.items.forEach(function(item){
                if (item){
                    submenu.appendChild(createMenuItem(item));
                }
            });
            elm.appendChild(submenu);
            config.submenu = submenu;
        }

        elm.onmouseover  = function(){
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
            var doShow = !item.submenu.classList.contains("active");
            me.hideMenu();
            if (doShow){
                item.submenu.classList.add("active");
                menuActive = doShow;
            }
        }else{
            me.hideMenu();
            setTimeout(function(){
                if (item.action){
                    if (typeof item.action === "function"){
                        item.action();
                    }
                    if (typeof item.action === "string"){
                        system.launchProgram(item.action);
                    }
                }
                if (item.message){
                    if (currentMenuTarget) currentMenuTarget.sendMessage(item.message);
                }
            },10);
        }
    }

    return me;
};

export default MainMenu();

