import $,{uuid, $div} from "../util/dom.js";
import ui from "./ui.js";
import amiIcon from "./icon.js";
import desktop from "./desktop.js";
import mainMenu from "./mainmenu.js";
import settings from "../settings.js";
import fileSystem from "../system/filesystem.js";
import popupMenu from "./popupMenu.js";

let AmiWindow = function(config){
    if (typeof config === "string") config={
        caption: config
    };

    var me = {
        type: config.type || "window",
        id: config.id || uuid(),
        zIndex: 0,
        minWidth: 120,
        minHeight: 100,
    };

    config.caption = config.caption||config.label||config.name;
    
    var icons = [];
    var menu;
    var selectBox;

    var borderLess = config.hasCustomUI;

    // TODO: move Icon stuff to explorer plugin

    var gridWidth= 80;
    var gridHeight= 70;
    var view = "icon";

    let amiWindow = $(".window" + (config.autogrid?".autogrid":"") + (borderLess?".borderless":""),{
            id:me.id,
            style:{
                zIndex: me.zIndex,
            },
            onClick : function(e){
                me.activate()
            },
            onDrop: handleDrop
    });


    var caption = $(".caption",config.caption);

    let windowBar =  $(".bar",
        {
            onDragStart: (e)=>{
                me.activate();
                setTimeout(me.deActivateContent,10);
                return([me])
            },
            onDoubleClick: function(){
                me.maximize();
            },
            onUp: function(){
                me.activate();
            }
        },
        caption,
        $(".close",{onDown:()=>{
                me.close();
            }}),
        $(".button.maximize",{onDown:()=>{
                me.maximize();
        }})
    );

    var inner = $(".inner.innerwindow",{
        onContext: (event)=>{
            if (config.type === "desktop"){
                let items = [
                    {
                        label:"Mount Drive",
                        action: ()=>{
                            desktop.mountWithDialog();
                        }
                    },
                ];
                if (settings.mainMenu && settings.mainMenu.length) items = items.concat(settings.mainMenu[0].items);

                popupMenu.show({
                    x: event.clientX,
                    y: event.clientY,
                    items: items
                });
            }else{
                if (menu){
                    let submenu = menu;
                    if (menu[0] && menu[0].items) submenu = menu[0].items;
                    popupMenu.show({
                        x: event.clientX,
                        y: event.clientY,
                        items:  submenu
                    });
                }
            }
        }
    });
    var sizer = $div("sizer");

    //var viewButton = $div("button view");
    //var menuButton = $div("button menu");


    if (!borderLess) amiWindow.appendChild(windowBar);
    amiWindow.appendChild(inner);
    if (!borderLess) amiWindow.appendChild(sizer);

    me.getInner = function(){
        return inner;
    };


    me.clear = function(){
        inner.innerHTML = "";
        icons=[];
    };

    me.close = function(){
        if (me.onClose) me.onClose();
        desktop.removeWindow(me);
    };

    me.maximize = function(){
        if (me.left === 0 && me.prevDimensions){
            me.setPosition(me.prevDimensions.left,me.prevDimensions.top);
            me.setSize(me.prevDimensions.width,me.prevDimensions.height);
        }else{
            me.prevDimensions = {
                left: me.left,
                top: me.top,
                width: me.width,
                height: me.height
            }
            me.setPosition(0,26);
            me.setSize(desktop.width,desktop.height-26);
        }
        me.activate();
    };

    me.refresh = function(){
        if (me.application) me.sendMessage("refresh");
    }

    me.createIcon = function(config,target){
        var icon = amiIcon(config);
        return me.addIcon(icon,target);
    };

    me.removeIcon = function(icon){
        var index = icons.findIndex(function(item){return item?item.id === icon.id:false});
        if (index>=0){
            icons.splice(index,1);
        }
        icon.element.remove();
    };

    me.addIcon = function(icon,target){
        target = target || inner;
        target.appendChild(icon.element);
        icon.parent = me;
        icons.push(icon);
        return icon;
    };

    me.clearIcons = function(){
        icons=[];
    }

    me.setGridSize = function(w,h){
        gridWidth=w;
        gridHeight=h;
        me.cleanUp();
    };

    me.getGridSize = function(){
        return {
            width: gridWidth,
            height: gridHeight
        }
    }

    me.setAutoGrid = function(state){
        if (state){
            amiWindow.classList.add('autogrid');
        }else{
            amiWindow.classList.remove('autogrid');
        }
    };

    me.reOrderIcon = function(item,x,y){
        //console.error(item.startLeft + x);
        var index = icons.findIndex(function(a){
            return a ? a.id === item.id : false;
        })

        var left= 10 + (config.paddingLeft || 0);
        var top= 20 + (config.paddingTop || 0);

        var col = Math.floor((x - me.left)/gridWidth);
        var row = Math.floor((y - me.top)/gridHeight);
        var colCount = Math.floor((me.width-left)/gridWidth)
        var newIndex = row*colCount + col;
        if (index !== newIndex){
            array_move(icons,index,newIndex);
            me.cleanUp();
        }
        //console.error(col);

        //console.error(x - me.left);

        function array_move(arr, old_index, new_index) {
            if (new_index >= arr.length) {
                var k = new_index - arr.length + 1;
                while (k--) {
                    arr.push(undefined);
                }
            }
            arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
            return arr; // for testing
        }
    }

    me.getIcons = function(){
      return icons;
    };


    me.getSelectedIcons = function(){
        var result = [];
        icons.forEach(function(icon){
            if (icon && icon.isActive()) result.push(icon);
        });
        return result;
    };

    me.setSelectBox = function(x,y,w,h){

        let selectBox = me.selectBox;
        if (!selectBox){
            console.error("no selectbox");
            return;
        }

        if (w<0){
            w=-w;
            x-=w;
        }
        if (h<0){
            h=-h;
            y-=h;
        }
        x = x-me.left-inner.offsetLeft+inner.scrollLeft;
        y = y-me.top-inner.offsetTop+inner.scrollTop;

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
                if (!icon.isActive()){
                    icon.activate(true);
                    icon.moveToTop();
                }
            }else{
                icon.deActivate(true);
            }
        });
    };

    me.removeSelectBox = function(){
        me.selectBox.classList.remove("active");
    };

    me.getTopZindex = function(){
        var max = 1;
        icons.forEach(function(item){
            max = Math.max(max,item.zIndex);
        });
        return max;
    };

    function handleDrop(droppedItems,deltaX,deltaY){
        console.log("dropping item on window",droppedItems);
        droppedItems.forEach(function(item){
            var left = item.left + deltaX;
            var top = item.top + deltaY;
            var doMove = false;
            if (item.parent.id === me.id){
                // move inside parent
                console.log("dropped into same window");
                doMove = true;
                if (amiWindow.classList.contains("autogrid")) doMove = false;
            }else{
                // drop in other window
                console.log("dropped into other window",me.application);
                if (me.application){
                    console.log("sending drop message",item.object);
                    me.sendMessage("dropFile",item);
                }else{
                    console.log("moving item to new parent");
                    // I think this is deprecated ?

                    if ((item.type === "icon" || item.type === "dragitem") && item.object){
                        var itemConfig = item.parent.getConfig?item.parent.getConfig():{};
                        var itemPath = itemConfig.path;
                        if (!itemPath) itemPath=item.getConfig?item.getConfig().path:"";

                        if (item.type === "icon"){
                            var oldPos = item.element.getBoundingClientRect();
                            if (config.path && itemPath){
                                fileSystem.moveFile(item.object,itemPath,config.path)
                            }

                            item.parent.removeIcon(item);
                            me.addIcon(item);
                            var newPos = item.element.getBoundingClientRect();

                            // get new coordinates offset relative to new parent;
                            var cX = newPos.left-oldPos.left;
                            var cY = newPos.top-oldPos.top;
                            left -= cX;
                            top -= cY;

                            doMove = true;
                        }

                        if (item.type === "dragitem"){
                            console.error("dropped dragitem",item.object);
                        }

                    }else{
                        console.warn("dropped unknown item, don't know what to do with it");
                    }


                }
            }

            if (doMove && item.setPosition){
                if (left<0) left=0;
                if (top<0) top=0;
                item.setPosition(left,top);
            }

        });
    };

    // creates a globally draggable item
    me.createDragItem = function(config){
        let item = $(".dragclone",{
            style:{
                left: config.left + "px",
                top: config.top + "px",
            }
        },config.label);

        item.type = "dragitem";
        item.parent = me;
        item.object = config.object;

        return item;
    }

    if (config.type !== "desktop"){

        me.getCaption = function(){
            return caption.innerText;
        };

        me.setCaption = function(text){
            caption.innerHTML = text;
        };

        me.addClass = function(className){
            amiWindow.classList.add(className);
        };

        me.removeClass = function(className){
            amiWindow.classList.remove(className);
        };

        me.setPosition = function(left,top,zIndex){
            me.left = left;
            me.top = top;
            amiWindow.style.transform = "translate(" + left + "px," + top + "px)";
        };

        me.setSize = function(width,height,fitOnScreen){
            console.log("setSize",width,height);
            if (width<me.minWidth) width=me.minWidth;
            if (height<me.minHeight) height=me.minHeight;

            if (fitOnScreen){
                var dw = desktop.width-100;
                var dh = desktop.height-100;
                if ((width>dw) || (height>dh)){
                    var ratio = Math.min(dw/width,dh/height);
                    width *= ratio;
                    height *= ratio;
                }
            }
            me.width = width;
            me.height = height;
            amiWindow.style.width = width + "px";
            amiWindow.style.height = height + "px";
        };

        me.setMinSize = function(width,height){
            me.minWidth = width;
            me.minHeight = height;
        }

        me.setIndex = function(zIndex){
            me.zIndex = zIndex+1;
            amiWindow.style.zIndex = me.zIndex;
        };

        me.moveToTop = function(){
            var zIndex = desktop.getTopZindex();
            if (zIndex>me.zIndex){
                me.setIndex(zIndex+1);
            }
        };

        me.activate = function(soft){
            amiWindow.classList.remove("inactive");
            amiWindow.classList.remove("inactivecontent");
            setTimeout(()=>me.sendMessage("focus"),200);
            if (!soft){
                me.moveToTop();
                desktop.setFocusElement(me);
            }
        };

        me.deActivate = function(soft){
            console.log("deactivate window");
            amiWindow.classList.add("inactive");

            icons.forEach(function(icon){
                if (icon) icon.deActivate();
            });
        };

        me.activateContent = function(soft){
            console.error("activate window content")
        };

        me.deActivateContent = function(soft){
            // this is needed if the window contains an iframe that would otherwise steal mouse focus
            amiWindow.classList.add("inactivecontent");
        };

        me.setContent = function(content){
            inner.innerHTML="";
            me.appendContent(content);
        };

        me.setMenu = function(_menu,apply){
            menu = _menu;
            if (apply) mainMenu.setMenu(menu);
        };

        me.getMenu = function(){
            return menu;
        };

        me.setMenuItem = function(id,label,enabled){
            function scan(tree){
                tree.forEach(branch=>{
                    if (branch.id === id){
                        if (label) branch.label = label;
                        if (typeof enabled === "boolean") branch.disabled = !enabled;
                    }
                    if (branch.items) scan(branch.items);
                })
            }
            scan(menu);
            mainMenu.setMenuItem(id,label,enabled);
        };

        me.removeBorder = function(){
            amiWindow.classList.add("borderless");
            caption.style.display = "none";
            sizer.style.display = "none";

            // move drag handle to top full window
            amiWindow.onDragStart = (e)=>{
                me.activate();
                return([me])
            };
            amiWindow.classList.add("draggable");
        }

        me.getConfig = function(){
            return config;
        };

        me.appendContent = function(content){
            if (typeof content === "string"){
                inner.innerHTML= content;
            }else{
                inner.appendChild(content);
            }
        };


        // this uniforms communication between plugins and amiBase
        // if the plugin is loading directly into amiBase it can register a handler for the message
        // otherwise - if the application is running in an iframe it will be sent to the iframe through postMessage
        me.sendMessage = async function(message,data){
            console.log("sendMessage",message,data);

            // first check if the application is running as plugin directly in amiBase
            let plugin = me.application;
            if (plugin && plugin[message] && typeof plugin[message] === "function"){
                plugin[message](data);
                return;
            }

            // if not, check if the application is running in an iframe
            // only registered applications will receive messages
            // the "messageTarget" property is set by the application when it's ready to receive messages
            if (me.messageTarget){
                var messageData;
                console.log("messagedata",data);
                
                if (data){
                    if (data.object && data.object.isAmiObject) data=data.object;

                    if (data.type === "file"){
                        messageData = {
                            filename: data.name,
                            path: data.path,
                            url: data.url,
                            action: data.action,
                        };
                        if (data.binary){
                            messageData.data = data.binary.buffer;
                        }
                        
                        // TODO: only load when no HTTP is available
                        // and only when data is not loaded yet

                        if (!messageData.url && !messageData.data){
                            messageData.data = await fileSystem.readFile(data,true);
                            // make sure it's an arraybuffer
                            if (messageData.data.buffer)  messageData.data = messageData.data.buffer;
                        }
                     }


                    if (!messageData){
                        // we can't send functions or circular structures to another frame;
                        messageData = {};
                        if (data.path) messageData.path = data.path;
                        if (data.url) messageData.url = data.url;
                        if (data.action && typeof data.action==="string") messageData.action = data.action;
                        if (data.filetype) {
                            messageData.filetype = {
                                id: data.filetype.id,
                                name: data.filetype.name,
                                hasHandler: !!data.filetype.handler
                            };
                        }
                    }
                }

                me.messageTarget.postMessage({
                    message: message,
                    data: messageData
                },me.messageOrigin);


            }else{
                if (me.isLoading){
                    console.log("Application hasn't signalled it's ready yet, queueing message");
                    me.messageQueue = me.messageQueue||[];
                    me.messageQueue.push({
                        message: message,
                        data: data
                    });
                }else{
                    console.error("Can't send message: no target defined");
                }
            }
        };


        me.element = amiWindow;
        me.dragHandle = borderLess ? amiWindow : windowBar;
        me.resizeHandle = sizer;
        config.left = config.left||200;
        config.top = config.top||200;
        me.setPosition(config.left,config.top);
        config.width = config.width||240;
        config.height = config.height||200;
        me.setSize(config.width,config.height);
        ui.enableResize(me);

        /*window.addEventListener("mouseenter",function(){
            if (!mouse.isDown){
                me.activateContent(true);
            }
        });
        inner.addEventListener("pointermove",function(){
            if (!mouse.isDown){
                me.activateContent(true);
            }
        });*/
        /*window.addEventListener("mousedown",function(e){
            if (e.target.classList.contains("window") || e.target.classList.contains("inner")){
                me.getSelectedIcons().forEach(function(item){
                    item.deActivate();
                });
            }
        });

        inner.addEventListener("onmousedown",function(){
            me.activate(true);
        });*/
    }



    return me;
};

export default AmiWindow;