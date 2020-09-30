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
        },
        {
            label:"item 2",
            items:[
                {
                    label:"subitem 2",
                    action: function(){
                        console.error("clicked subitem 2");
                    }
                },
                {
                    label:"subitem 3",
                    action: "test2"
                }
            ]
        },
        {
            label:"Theme",
            items:[
                {
                    label:"Choice",
                    action: function(){
                        Desktop.loadTheme("choice");
                    }
                },
                {
                    label:"Light",
                    action: function(){
                        Desktop.loadTheme("tangerine");
                    }
                },
                {
                    label:"Dark",
                    action: function(){
                        Desktop.loadTheme("dark");
                    }
                }
            ]
        }
    ];

    var iconMenu = [
        {
            label:"icon",
            action: "test",
            items:[
                {
                    label:"test2",
                    action: "test2"
                }
            ]
        },
        {
            label:"Edit",
            items:[
                {
                    label:"Delete",
                    action: function(){
                        console.error("clicked subitem 2");
                    }
                },
                {
                    label:"Edit",
                    action: "test2"
                }
            ]
        }
    ];

    var windowMenu = [
        {
            label:"window",
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
                }
            ]
        },
        {
            label:"Edit",
            items:[
                {
                    label:"Delete",
                    action: function(){
                        console.error("clicked subitem 2");
                    }
                },
                {
                    label:"Edit",
                    action: "test2"
                }
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

        me.setMenu(mainMenu);

        EventBus.on(EVENT.ACTIVATE_DESKTOP_ELEMENT,function(){
            var focusElement = Desktop.getFocusElement() || {};
            switch (focusElement.type) {
                case "desktop":
                    me.setMenu(mainMenu);
                    break;
                case "icon":
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
            }
        })

    };

    me.setMenu = function(menu,window){
        root.innerHTML = "";
        menu.forEach(function(item){
            root.appendChild(createMenuItem(item));
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

        elm.innerHTML = "<label>" + struct.label + "</label>";
        elm.onclick = function(){
            handleMenuClick(struct);
        };

        if (struct.items){
            var submenu = $div("submenu");
            struct.items.forEach(function(item){
                submenu.appendChild(createMenuItem(item));
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

