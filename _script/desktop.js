var Desktop = function(){
    var me = {
        type: 'desktop'
    };
    var container;
    var windows=[];
    var icons=[];
    var focusElement={};
    var selectedElements=[];
    var selectBox;

    me.init = function(){
        container = $div("desktop","desktop");
        document.body.appendChild(container);

        container.addEventListener("mousedown",function(e){
            if (e.target.id === "desktop"){
                me.setFocusElement(me);
            }
        });

        selectBox = $div("selectBox","selectBox");
        container.appendChild(selectBox);

        UI.enableSelection(me,container);
    };

    me.createWindow = function(config){
        if (typeof config === "string") config={
            caption: config,
            id: config
        };

        var window = AmiWindow(config);
        container.appendChild(window.element);
        window.moveToTop();
        windows.push(window);
        return window;
    };

    me.createIcon = function(config){
        if (typeof config === "string") config={
            label: config
        };

        var icon = AmiIcon(config);
        container.appendChild(icon.element);
        icons.push(icon);
        return icon;
    };

    me.openDrawer = function(config){
        var window = windows.find(function(w){return w.id === config.id});
        if (window){
            console.error("open");
        }else{
            console.error("create");
            Desktop.createWindow(config);
        }
    };

    me.launchProgram = function(config){
        var window = windows.find(function(w){return w.id === config.id});
        var label = config.url.split(":")[1];
        var w = Desktop.createWindow(label);
        Applications.load(config.url,w);
    };

    me.launchUrl = function(config){
        var window = windows.find(function(w){return w.id === config.id});
        var label = config.url;
        var w = Desktop.createWindow(label);
        w.setSize(800,600);
        Applications.loadFrame(config.url,w);
    };

    me.getTopZindex = function(){
        var max = 1;
        windows.forEach(function(item){
            max = Math.max(max,item.zIndex);
        });
        icons.forEach(function(item){
            max = Math.max(max,item.zIndex);
        });
        return max;
    };

    me.cleanUp = function(){
        var left= 50;
        var top= 50;

        icons.forEach(function(icon){
            icon.setPosition(left,top);
            top += 70;
        })

    };

    me.setFocusElement = function(elm){
        var undoSelection = true;
        if (elm.type === "icon" && elm.isActive()) undoSelection = false;
        if (Input.isShiftDown) undoSelection=false;
        if (Input.isCtrlDown) undoSelection=false;

        if (undoSelection){
            me.getSelectedIcons().forEach(function(item){
                if (item.id !== elm.id){
                    item.deActivate();
                }
            });
        }

        if (focusElement.id !== elm.id){
            if (undoSelection) if (focusElement.deActivate) focusElement.deActivate();
            focusElement = elm;
            EventBus.trigger(EVENT.ACTIVATE_DESKTOP_ELEMENT);
        }

        MainMenu.hideMenu();

    };

    me.getFocusElement = function(){
        return focusElement;
    };

    me.setSelectBox = function(x,y,w,h){
        if (w<0){
            w=-w;
            x-=w;
        }
        if (h<0){
            h=-h;
            y-=h;
        }
        selectBox.style.width = w + "px";
        selectBox.style.height = h + "px";
        selectBox.style.left = x + "px";
        selectBox.style.top = y + "px";

        if (!selectBox.classList.contains("active")){
            selectBox.classList.add("active");
            selectBox.style.zIndex = me.getTopZindex()+1;
        }

        icons.forEach(function(icon){
            if (icon.left>x && icon.left<x+w && icon.top>y && icon.top<y+h){
                icon.activate(true);
            }else{
                icon.deActivate(true);
            }
        });
    };

    me.removeSelectBox = function(){
        selectBox.classList.remove("active");
    };

    me.getSelectedIcons = function(){
        var result = [];
        icons.forEach(function(icon){
            if (icon.isActive()) result.push(icon);
        });
        return result;
    };

    return me;
}();