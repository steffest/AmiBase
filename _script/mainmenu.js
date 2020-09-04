var MainMenu = function(){

    var me = {};
    var root;
    var menuActive;
    var activeSubmenu;
    var currentMenuTarget;

    var mainMenu = [
        {
            label:"test",
            action: "test",
            items:[
                {
                    label:"test2",
                    action: "test2"
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

    me.init = function(){
        var topbar = $div("topbar");

        var homebutton =$div("homebutton","","<div>AmiBase <small>v" + Settings.version + "</small></div>");

        root=$div("menu");

        topbar.appendChild(homebutton);
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
                        me.setMenu(mainMenu);
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