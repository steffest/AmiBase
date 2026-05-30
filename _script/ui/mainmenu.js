import $ from "../util/dom.js";
import settings from "../settings.js";
import desktop from "./desktop.js";
import eventBus from "../util/eventBus.js";
import {EVENT} from "../enum.js";
import applications from "../applications.js";
import system from "../system/system.js";
import fileSystem from "../system/filesystem.js";
import amiObject from "../system/object.js";
import network from "../system/network.js";

let MainMenu = function(){

    var me = {};
    var root;
    var menuActive;
    var activeSubmenu;
    var currentMenuTarget;
    var messageContainer;
    var connectionDot;
    var submenuHideDelay = 80;

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
                                label: "About " + (settings.name || "Amibase"),
                                url: settings.aboutUrl || "content/files/about.txt"
                            }));
                        });

                    },
                },
                {
                label:"Full Screen",
                    action:function(){
                        document.body.requestFullscreen();
                    }
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
                    label:"New",
                    items:[
                        {
                            label:"Drawer",
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
                            label:"File",
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
                            label:"Link",
                            action: ()=>{
                                fileSystem.getUniqueName("desktop:","new.link").then(name=>{
                                    let path = "desktop:" + name;
                                    fileSystem.writeFile(path,"").then(result=>{
                                        desktop.createIcon(amiObject({label: result.name, path: path,type: "link"}));
                                        desktop.cleanUp();
                                    })
                                });
                            }
                        }
                    ]
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
                },
                {
                    label:"Connects",
                    action: function(){
                        showConnectDialog();
                    }
                },
                {
                    label:"Reset",
                    action: async function(){
                        await system.reset();
                        window.location.reload();
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

    var desktopMenu = [
        {
            label:"Clean up",
            action: function(){
                desktop.cleanUp();
            }
        },
    ]

    me.init = function(){
        var topbar = $(".topbar",
            $(".homebutton",$("div"),(settings.name || "Amibase"),$("small","v" + settings.version)),
            messageContainer = $(".message"),
            connectionDot = $(".network-dot.disconnected",{
                title: "Network connections",
                onClick: ()=>network.openManagerWindow()
            }),
            root=$(".menu")
        );

        desktop.getScreen().appendChild(topbar);

        me.rebuildMenu();

        network.on("connection.dot",updateConnectionDot);
        updateConnectionDot();

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

    me.rebuildMenu = function(){
        // Reset mainMenu to base System menu
        mainMenu = [
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
                                    label: "About " + (settings.name || "Amibase"),
                                    url: settings.aboutUrl || "content/files/about.txt"
                                }));
                            });
                        },
                    },
                    {
                        label:"Full Screen",
                        action:function(){
                            document.body.requestFullscreen();
                        }
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
                        label:"New",
                        items:[
                            {
                                label:"Drawer",
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
                                label:"File",
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
                                label:"Link",
                                action: ()=>{
                                    fileSystem.getUniqueName("desktop:","new.link").then(name=>{
                                        let path = "desktop:" + name;
                                        fileSystem.writeFile(path,"").then(result=>{
                                            desktop.createIcon(amiObject({label: result.name, path: path,type: "link"}));
                                            desktop.cleanUp();
                                        })
                                    });
                                }
                            }
                        ]
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
                    },
                    {
                        label:"Connect",
                        action: function(){
                            showConnectDialog();
                        }
                    }
                ]
            }
        ];

        // Add themes if configured
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

        // Add programs
        let apps = system.getRegisteredApplications().filter(item=>!item.skipMenu);
        if (apps && apps.length){
            let categories = {};
            apps.forEach(app=>{
                let category = app.category || "Generic";
                if (!Array.isArray(categories[category])) categories[category] = [];
                categories[category].push({
                    label: app.name,
                    action: function(){
                        if (app.url){
                            desktop.launchUrl({
                                name: app.name,
                                url: app.url,
                                width: app.width,
                                height: app.height,
                                target: app.target,
                            });
                            return;
                        }
                        system.launchProgram({url: "plugin:" + app.plugin});
                    }
                });
            });

            let sortedCategories = Object.keys(categories).sort((a,b)=>a.localeCompare(b));
            let programs = {
                label: "Programs",
                items: sortedCategories.map(category=>({
                    label: category,
                    items: categories[category].sort((a,b)=>a.label.localeCompare(b.label))
                }))
            };
            mainMenu.push(programs);
        }

        // Add custom menu items from settings
        if (settings.mainMenu) mainMenu = mainMenu.concat(settings.mainMenu);

        // Rebuild derived menus
        windowMenu = [
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
        ].concat(mainMenu);

        iconMenu = [
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
        ].concat(mainMenu);

        me.setMenu(mainMenu);

    };

    function showConnectDialog(){
        let connectWindow = desktop.createWindow({
            caption: "Connect Remote Device",
            width: 380,
            height: 220,
            left: 220,
            top: 120,
        });

        let tokenInput = $("input", {
            id: "connect-device-token",
            type: "text",
            required: true,
            style: { width: "100%" }
        });

        let passwordInput = $("input", {
            id: "connect-password",
            name: "Password",
            type: "password",
            required: true,
            style: { width: "100%" }
        });

        let submitButton = $("button.button.inline", {
            onClick: async () => {
                let token = tokenInput.value.trim();
                let password = passwordInput.value.trim();
                submitButton.disabled = true;

                system.connectEnv(token, password).then(result=>{

                    }
                )
            }
        }, "Connect");

        let form = $(".form",
            $("label", { htmlFor: "connect-device-token" }, "Device Token"),
            tokenInput,
            $("label", { htmlFor: "connect-password" }, "Password"),
            passwordInput,
            $("div", {
                style: {
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "8px"
                }
            }, submitButton)
        );

        connectWindow.setContent($(".panel", {
            style: {
                width: "100%",
                height: "100%",
                padding: "12px",
                boxSizing: "border-box"
            }
        }, form));

        tokenInput.focus();
    }

    function updateConnectionDot(state){
        if (!connectionDot) return;
        let connected = false;
        let signaling = network.getSignalStatus ? network.getSignalStatus() : "disconnected";
        if (state){
            connected = !!state.connected;
            signaling = state.signaling || signaling;
        }

        connectionDot.classList.remove("connected","disconnected","partial");
        if (connected){
            connectionDot.classList.add("connected");
        }else if (signaling === "connected" || signaling === "connecting"){
            connectionDot.classList.add("partial");
        }else{
            connectionDot.classList.add("disconnected");
        }
        connectionDot.title = `Connections (${connected ? "connected" : signaling})`;
    }

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
        if (type === "desktop") return mainMenu[0].items.concat(desktopMenu);
        if (type === "window") return windowMenu[0].items;
        if (type === "icon") return iconMenu[0].items;
        return mainMenu;
    }

    me.hideMenu = function(){
        var subMenus = root.querySelectorAll(".submenu.active");
        for (var i = 0, max = subMenus.length; i<max;i++){
            subMenus[i].classList.remove("active");
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

        var submenu;
        var hideSubmenuTimer;
        let elm = $(".menuitem"+(config.disabled?".disabled":"")+(config.items?".hassubmenu":""),
            {onClick:()=> {handleMenuClick(config,submenu)},
            id:config.id?"am_" + config.id:undefined},
            $("label",config.label)
        );

        if (config.items){
            submenu = $(".submenu");
            config.items.forEach(function(item){
                if (item){
                    submenu.appendChild(createMenuItem(item));
                }
            });
            elm.appendChild(submenu);
        }

        elm.onmouseover  = function(){
            if (submenu && menuActive){
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

    function handleMenuClick(item,submenu){
        if (submenu){
            var doShow = !submenu.classList.contains("active");
            me.hideMenu();
            if (doShow){
                submenu.classList.add("active");
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
                if (item.url){
                    desktop.launchUrl({
                        name: item.name || item.label,
                        url: item.url
                    });
                }
            },10);
        }
    }

    return me;
};

export default MainMenu();

