import {$div} from "../util/dom.js";
import settings from "../settings.js";
import desktop from "./desktop.js";
import ui from "./ui.js";
import eventBus from "../util/eventBus.js";
import {EVENT} from "../enum.js";
import applications from "../applications.js";
import system from "../system/system.js";
import fileSystem from "../system/filesystem.js";

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
                            applications.sendMessage(window,"openfile",{
                                type: "file",
                                label: "About " + settings.name || "Amibase",
                                url: settings.aboutUrl || "content/files/about.txt"
                            });
                        });

                    },
                },
                {
                    label:"Open File",
                    action: async ()=>{
                        let file = await system.requestFile();
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
                    label:"New Drawer",
                    action: function(){
                        desktop.createIcon({label: "My Content", type: "drawer"});
                        desktop.cleanUp();
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
                        var name =  prompt("Enter the new name:");
                        if (name){
                            var icon =  desktop.getFocusElement();
                            icon.setLabel(name);
                        }
                    }
                },
                {
                    label:"Info",
                    action: async function(){
                        var icon =  desktop.getFocusElement();
                        let inspector = await system.loadLibrary("inspector.js");
                        inspector.inspect(icon);
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
                    label:"Cleanup",
                    action: function(){
                        var w =  desktop.getFocusElement();
                        if (w && w.cleanUp) w.cleanUp();
                    }
                },
                {
                    label:"Rename",
                    action: function(){
                        var name =  prompt("Enter the new name:");
                        if (name){
                            var w =  desktop.getFocusElement();
                            w.setCaption(name);
                        }
                    }
                },
                {
                    label:"Upload File",
                    action: function(){
                        desktop.uploadFile(desktop.getFocusElement());
                    }
                },
                {
                    label:"New Drawer",
                    action: function(){
                        var w =  desktop.getFocusElement();
                        if (w){
                            var newName = "My Content";
                            var config = w.getConfig();
                            if (config.path){
                                fileSystem.createDirectory(config.path,newName);
                            }
                            w.createIcon({label: newName, type: "drawer"});
                            w.cleanUp();
                        }
                    }
                },
                {
                    label:"New File",
                    action: async function(){
                        var w =  desktop.getFocusElement();
                        if (w){
                            var newName = "new.txt";
                            var config = w.getConfig();
                            if (config.path){
                                let created = await fileSystem.saveFile(config.path + "/" + newName,"");
                                console.log("created:" + created);
                                w.createIcon({label: newName, type: "file"});
                                w.cleanUp();
                            }
                        }
                    }
                },
            ]
        }
    ];

    me.init = function(){
        var topbar = $div("topbar");

        //var homebutton =$div("homebutton","","<div>AmiBase <small>v" + settings.version + "</small></div>");
        var homebutton =$div("homebutton","","<div>" + (settings.name || "Amibase") + " <small>v" + settings.version + "</small></div>");

        messageContainer = $div("message");
        root=$div("menu");

        topbar.appendChild(homebutton);
        topbar.appendChild(messageContainer);
        topbar.appendChild(root);
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
                    if (focusElement.getConfig().linkedFile){
                        iconMenu[0].items[2] = {
                            label:"Download",
                            action: function(){
                                var url = fileSystem.getDownloadUrl(focusElement.getConfig().linkedFile);
                                window.open(url);
                            }
                        };
                        iconMenu[0].items[3] = {
                            label:"Open In Editor",
                            action: function(){
                                system.launchProgram({
                                    url: "plugin:iconeditor"
                                }).then(window=>{
                                    Applications.sendMessage(window,"openfile",focusElement.getConfig());
                                })
                            }
                        }
                    }else{
                        iconMenu[0].items[2] = undefined;
                        iconMenu[0].items[3] = undefined;
                    }
                    me.setMenu(iconMenu);
                    break;
                case "window":
                    if (focusElement.getMenu()){
                        me.setMenu(focusElement.getMenu(),focusElement);
                    }else{
                        me.setMenu(windowMenu);
                    }
                    break;
                case "drawer":
                    if (focusElement.getMenu()){
                        me.setMenu(focusElement.getMenu(),focusElement);
                    }else{
                        me.setMenu(windowMenu);
                    }
                    break;
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

    function createMenuItem(struct){
        var elm = $div("menuitem");
        if (struct.label === "-"){
            elm.classList.add("divider");
            return elm;
        }
        if (struct.disabled){
            elm.classList.add("disabled");
        }
        if (struct.id){
            elm.id="am_" + struct.id;
        }

        elm.innerHTML = "<label>" + struct.label + "</label>";
        ui.onClick(elm,function(e){
            e.stopPropagation();
            handleMenuClick(struct);
        });

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

