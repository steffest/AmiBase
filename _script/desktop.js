var Desktop = function(){
    var me = AmiWindow({
        type: 'desktop',
        paddingLeft: 20,
        paddingTop: 30
    });

    me.left = 0;
    me.top = 0;

    var container;
    var windows=[];
    var focusElement={};
    var selectedElements=[];
    var selectBox;

    me.init = function(){
        container = me.getInner();
        container.classList.add("desktop");
        container.id = "desktop";
        document.body.appendChild(container);

        container.addEventListener("mousedown",function(e){
            if (e.target.id === "desktop"){
                me.setFocusElement(me);
            }
        });

        UI.enableSelection(me,container);
        me.setDropTarget(container);
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
        me.getIcons().forEach(function(item){
            max = Math.max(max,item.zIndex);
        });
        return max;
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



    return me;
}();