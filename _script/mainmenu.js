var MainMenu = function(){

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
                        Desktop.launchProgram({
                            url: "plugin:notepad",
                            width: 400,
                            height: 200,
                            onload: function(window){
                                Applications.sendMessage(window,"openfile",{
                                    type: "file",
                                    label: "About Amibase",
                                    url: "content/files/about.txt"
                                });
                            }
                        });
                    },
                },
                {
                    label:"Upload File",
                    action: function(){
                        Desktop.uploadFile();
                    }
                },
                {
                    label:"New Drawer",
                    action: function(){
                        Desktop.createIcon({label: "My Content", type: "drawer"});
                        Desktop.cleanUp();
                    }
                },
                {
                    label:"Import Content",
                    action: function(){
                        var w = Desktop.createWindow({label:"Content"});
                        var items = [
                            {label: "Youtube", type:"drawer"},
                            {label: "Vimeo", type:"drawer"},
                            {label: "Upload File", type:"file", onOpen: function(){
                                    Desktop.uploadFile();
                                }},
                            {label: "Other", type:"drawer"},
                        ];
                        items.forEach(item => {
                            w.createIcon(item);
                        });
                        w.cleanUp();
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
                            var icon =  Desktop.getFocusElement();
                            icon.setLabel(name);
                        }
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
                        var w =  Desktop.getFocusElement();
                        if (w && w.cleanUp) w.cleanUp();
                    }
                },
                {
                    label:"Rename",
                    action: function(){
                        var name =  prompt("Enter the new name:");
                        if (name){
                            var w =  Desktop.getFocusElement();
                            w.setCaption(name);
                        }
                    }
                },
                {
                    label:"Upload File",
                    action: function(){
                        Desktop.uploadFile(Desktop.getFocusElement());
                    }
                },
                {
                    label:"New Drawer",
                    action: function(){
                        var w =  Desktop.getFocusElement();
                        if (w){
                            var newName = "My Content";
                            var config = w.getConfig();
                            if (config.path){
                                FileSystem.createDirectory(config.path,newName);
                            }
                            w.createIcon({label: newName, type: "drawer"});
                            w.cleanUp();
                        }
                    }
                },
            ]
        }
    ];

    me.init = function(){
        var topbar = $div("topbar");

        //var homebutton =$div("homebutton","","<div>AmiBase <small>v" + Settings.version + "</small></div>");
        var homebutton =$div("homebutton","","<div>Amibase <small>v" + Settings.version + "</small></div>");
        messageContainer = $div("message");
        root=$div("menu");

        topbar.appendChild(homebutton);
        topbar.appendChild(messageContainer);
        topbar.appendChild(root);
        document.body.appendChild(topbar);

        if (Settings.themes && Settings.themes.length>1){
            var themes = {
                label:"Theme",
                items:[]
            };
            Settings.themes.forEach(theme => {
                themes.items.push({
                    label: theme.label,
                    action: function(){
                        Desktop.loadTheme(theme.name);
                    }
                });
            });
            mainMenu.push(themes);
            windowMenu.push(themes);
            iconMenu.push(themes);
        }


        me.setMenu(mainMenu);

        EventBus.on(EVENT.ACTIVATE_DESKTOP_ELEMENT,function(){
            var focusElement = Desktop.getFocusElement() || {};
            switch (focusElement.type) {
                case "desktop":
                    me.setMenu(mainMenu);
                    break;
                case "icon":
                    if (focusElement.getConfig().linkedFile){
                        iconMenu[0].items[1] = {
                            label:"Download",
                            action: function(){
                                var url = FileSystem.getDownloadUrl(focusElement.getConfig().linkedFile);
                                window.open(url);
                            }
                        };
                        iconMenu[0].items[2] = {
                            label:"Open In Editor",
                            action: function(){
                                Desktop.launchProgram({
                                    url: "plugin:iconeditor",
                                    onload: function(window){
                                        Applications.sendMessage(window,"openfile",focusElement.getConfig());
                                    }
                                });
                            }
                        }
                    }else{
                        iconMenu[0].items[1] = undefined;
                        iconMenu[0].items[2] = undefined;
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
            console.error(item);
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
            menuActive = item.submenu.classList.contains("active");
        }else{
            if (item.action){
                if (typeof item.action === "function"){
                    item.action();
                }
            }
            if (item.message){
                if (currentMenuTarget) currentMenuTarget.sendMessage(item.message);


            }
        }
        //console.error(item);
    }

    return me;
}();

