import {uuid, $div} from "../util/dom.js";
import ui from "./ui.js";
import amiIcon from "./icon.js";
import desktop from "./desktop.js";
import mouse from "./mousepointer.js";
import mainMenu from "./mainmenu.js";
import fileSystem from "../system/filesystem.js";

let AmiWindow = function(config){
    if (typeof config === "string") config={
        caption: config
    };

    var me = {
        type: config.type || "window",
        id: config.id || uuid(),
        zIndex: 0,
    };

    config.caption = config.caption||config.label||config.name;
    
    var icons = [];
    var menu;
    var selectBox;
    var borderLess = (typeof config.border === "boolean" && !config.border);
    var gridWidth= 70;
    var gridHeight= 70;
    var view = "icon";

    var window = $div("window",me.id);
    window.style.zIndex = me.zIndex;
    var caption = $div("caption","",config.caption);
    var windowBar =  $div("bar","",caption);
    var inner = $div("inner innerwindow");
    var sizer = $div("sizer");
    var close = $div("close");
    var maximize = $div("button maximize");
    var viewButton = $div("button view");
    var menuButton = $div("button menu");
    selectBox = $div("selectBox");

    windowBar.appendChild(close);
    windowBar.appendChild(maximize);
    //windowBar.appendChild(viewButton);
    //windowBar.appendChild(menuButton);
    if (!borderLess) window.appendChild(windowBar);
    window.appendChild(inner);
    if (!borderLess) window.appendChild(sizer);
    inner.appendChild(selectBox);

    if (borderLess){
        window.classList.add("borderless");
    }
    if (config.autogrid)  window.classList.add("autogrid");

    ui.onClick(close,function(){
        me.close();
    });

    ui.onClick(maximize,function(){
        me.maximize();
        me.cleanUp();
    });

    ui.onClick(menuButton,function(){
        window.classList.toggle("listview");
        view = window.classList.contains("listview") ? "list" : "icon";
        me.refresh();
    });

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
            me.setPosition(0,22);
            me.setSize(desktop.width,desktop.height-22);
        }
    };

    me.createIcon = function(config){
        var icon = amiIcon(config);
        return me.addIcon(icon);
    };

    me.removeIcon = function(icon){
        var index = icons.findIndex(function(item){return item?item.id === icon.id:false});
        if (index>=0){
            icons.splice(index,1);
        }
        icon.element.remove();
    };

    me.addIcon = function(icon){
        inner.appendChild(icon.element);
        icon.parent = me;
        icons.push(icon);
        return icon;
    };

    me.setGridSize = function(w,h){
        gridWidth=w;
        gridHeight=h;
        me.cleanUp();
    };

    me.setAutoGrid = function(state){
        if (state){
            window.classList.add('autogrid');
        }else{
            window.classList.remove('autogrid');
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

    me.cleanUp = function(){
        var left= 10 + (config.paddingLeft || 0);
        var top= 20 + (config.paddingTop || 0);

        var h = (me.height||350) - gridHeight;
        var w = (me.width||inner.offsetWidth||500) - gridWidth;

        var fill = "horizontal";
        if (me.type === "desktop"){
            fill = "vertical";
        }

        if (fill === "horizontal"){
            icons.forEach(function(icon){
                if (icon){
                    icon.setPosition(left,top);
                    left += gridWidth;
                    if (left>w){
                        top+=gridHeight;
                        left = 10 + (config.paddingLeft || 0);
                    }
                }
            })
        }else{
            icons.forEach(function(icon){
                if (icon){
                    icon.setPosition(left,top);
                    top += gridHeight;
                    if (left>w){
                        top+=gridHeight;
                        left = 10 + (config.paddingLeft || 0);
                    }
                }
            })
        }
    };

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
        selectBox.classList.remove("active");
    };

    me.getTopZindex = function(){
        var max = 1;
        icons.forEach(function(item){
            max = Math.max(max,item.zIndex);
        });
        return max;
    };

    me.setDropTarget = function(target){
        ui.enableDrop(target,function(droppedItems,deltaX,deltaY){
            droppedItems.forEach(function(item){
                var left = item.left + deltaX;
                var top = item.top + deltaY;
                var doMove = false;
                if (item.parent.id === me.id){
                    // move inside parent
                    doMove = true;
                    if (window.classList.contains("autogrid")) doMove = false;
                }else{
                    // drop in other window
                    if (me.isApplication){
                        Applications.sendMessage(me,"dropfile",item);
                    }else{
                        console.log("moving item to new parent");
                        var oldPos = item.element.getBoundingClientRect();
                        var oldConfig = item.parent.getConfig?item.parent.getConfig():{};
                        var oldPath = oldConfig.path;
                        if (!oldPath) oldPath=item.getConfig?item.getConfig().path:"";

                        // propagate action to window handler
                        if (config.path){
                            fileSystem.moveFile(item,oldPath,config.path)
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
                }

                if (doMove){
                    if (left<0) left=0;
                    if (top<0) top=0;

                    item.setPosition(left,top);
                }

            });
            //me.activate();
        });
    };
    
    me.refresh = function(){
        //window.classList.

        var top = 0;
        
        if (view === "list"){
            icons.forEach(function(icon){
                icon.setListPosition(top);
                top += 20;
            });
        }

        if (view === "icon"){
            icons.forEach(function(icon){
                icon.setPosition(icon.left,icon.top);
            });
        }
        
    }

    if (config.type !== "desktop"){

        me.getCaption = function(){
            return caption.innerText;
        };

        me.setCaption = function(text){
            caption.innerHTML = text;
        };

        me.addClass = function(className){
            window.classList.add(className);
        };

        me.removeClass = function(className){
            window.classList.remove(className);
        };

        me.setPosition = function(left,top,zIndex){
            me.left = left;
            me.top = top;
            window.style.transform = "translate(" + left + "px," + top + "px)";
        };

        me.setSize = function(width,height,fitOnScreen){
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
            window.style.width = width + "px";
            window.style.height = height + "px";
        };

        me.setIndex = function(zIndex){
            me.zIndex = zIndex+1;
            window.style.zIndex = me.zIndex;
        };

        me.moveToTop = function(){
            var zIndex = desktop.getTopZindex();
            if (zIndex>me.zIndex){
                me.setIndex(zIndex+1);
            }
        };

        me.activate = function(soft){
            window.classList.remove("inactive");
            window.classList.remove("inactivecontent");
            if (!soft){
                me.moveToTop();
                desktop.setFocusElement(me);
            }
        };

        me.deActivate = function(soft){
            window.classList.add("inactive");

            icons.forEach(function(icon){
                if (icon) icon.deActivate();
            });
        };

        me.activateContent = function(soft){
            window.classList.remove("inactivecontent");
        };

        me.deActivateContent = function(soft){
            // TODO: why was this needed again?
            //window.classList.add("inactivecontent");
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

        // send a message to the inner frame of the window
        me.sendMessage = async function(message,data){
            if (me.messageTarget){
                var messageData;
                console.log("messagedata",data);
                
                if (data){
                    if (data.type === "icon"){
                        // TODO
                        console.error("Rework!")
                    }

                    if (data.type === "file"){
                        messageData = {
                            filename: data.name,
                            path: data.path,
                            attachment: data.attachment, // TODO: do we still use attachment?
                            url: data.url
                        };
                        if (data.binary){
                            messageData.data = data.binary.buffer;
                        }
                        
                        // TODO: only load when no HTTP is available
                        // and only when data is not loaded yet

                        if (!messageData.url && !data.data){
                            messageData.data = await fileSystem.readFile(data);
                            // make sure it's an arraybuffer
                            if (messageData.data.buffer)  messageData.data = messageData.data.buffer;
                        }
                     }


                    if (!messageData){
                        // we can't send functions or circular structures to another frame;
                        messageData = {};
                        if (data.path) messageData.path = data.path;
                        
                        // TODO: deprecated
                        if (data.linkedFile) messageData.path = fileSystem.getDownloadUrl(data.linkedFile);
                        
                        if (data.url) messageData.url = data.url;
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
                console.error("Can't send message: no target defined");
            }
        };


        me.element = window;
        me.dragHandle = borderLess ? window : windowBar;
        me.resizeHandle = sizer;
        config.left = config.left||200;
        config.top = config.top||200;
        me.setPosition(config.left,config.top);
        config.width = config.width||240;
        config.height = config.height||200;
        me.setSize(config.width,config.height);
        ui.enableDrag(me);
        ui.enableResize(me);
        ui.enableSelection(me,inner);
        me.setDropTarget(window);


        window.addEventListener("mouseenter",function(){
            if (!mouse.isDown){
                me.activateContent(true);
            }
        });
        inner.addEventListener("mousemove",function(){
            if (!mouse.isDown){
                me.activateContent(true);
            }
        });
        window.addEventListener("mousedown",function(e){
            if (e.target.classList.contains("window") || e.target.classList.contains("inner")){
                me.getSelectedIcons().forEach(function(item){
                    item.deActivate();
                });
            }
        });
        window.addEventListener("click",function(){
            me.activate(true);
        });
        inner.addEventListener("click",function(){
            me.activate(true);
        });
    }



    return me;
};

export default AmiWindow;