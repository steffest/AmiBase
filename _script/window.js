var AmiWindow = function(config){
    if (typeof config === "string") config={
        caption: config
    };

    var me = {
        type: config.type || "window",
        id: config.id || uuid(),
        zIndex: 0,
    };

    config.caption = config.caption||config.label;

    var icons = [];
    var menu;
    var selectBox;
    var borderLess = (typeof config.border === "boolean" && !config.border);
    var gridWidth= 70;
    var gridHeight= 70;

    var window = $div("window",me.id);
    window.style.zIndex = me.zIndex;
    var caption = $div("caption","",config.caption);
    var windowBar =  $div("bar","",caption);
    var inner = $div("inner innerwindow");
    var sizer = $div("sizer");
    var close = $div("close");
    selectBox = $div("selectBox");

    windowBar.appendChild(close);
    if (!borderLess) window.appendChild(windowBar);
    window.appendChild(inner);
    if (!borderLess) window.appendChild(sizer);
    inner.appendChild(selectBox);

    if (borderLess){
        window.classList.add("borderless");
    }

    close.onclick = function(){
        me.close();
    };

    me.getInner = function(){
        return inner;
    };

    me.clear = function(){
        inner.innerHTML = "";
        icons=[];
    };

    me.close = function(){
        Desktop.removeWindow(me);
    };

    me.createIcon = function(config){
        var icon = AmiIcon(config);
        return me.addIcon(icon);
    };

    me.removeIcon = function(icon){
        var index = icons.findIndex(function(item){return item.id === icon.id});
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
                icon.setPosition(left,top);
                left += gridWidth;
                if (left>w){
                    top+=gridHeight;
                    left = 10 + (config.paddingLeft || 0);
                }
            })
        }else{
            icons.forEach(function(icon){
                icon.setPosition(left,top);
                top += gridHeight;
                if (left>w){
                    top+=gridHeight;
                    left = 10 + (config.paddingLeft || 0);
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
            if (icon.isActive()) result.push(icon);
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
        UI.enableDrop(target,function(droppedItems,deltaX,deltaY){
            droppedItems.forEach(function(item){
                var left = item.left + deltaX;
                var top = item.top + deltaY;
                var doMove = false;
                if (item.parent.id === me.id){
                    // move inside parent
                    doMove = true;
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
                            FileSystem.moveFile(item,oldPath,config.path)
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
                var dw = Desktop.width-100;
                var dh = Desktop.height-100;
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
            var zIndex = Desktop.getTopZindex();
            if (zIndex>me.zIndex){
                me.setIndex(zIndex+1);
            }
        };

        me.activate = function(soft){
            window.classList.remove("inactive");
            window.classList.remove("inactivecontent");
            if (!soft){
                me.moveToTop();
                Desktop.setFocusElement(me);
            }
        };

        me.deActivate = function(soft){
            window.classList.add("inactive");

            icons.forEach(function(icon){
                icon.deActivate();
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
            if (apply) MainMenu.setMenu(menu);
        };

        me.getMenu = function(){
            return menu;
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
        me.sendMessage = function(message,data){
            if (me.messageTarget){
                var messageData;
                var doSend = true;
                console.log("messagedata",data);
                if (data){
                    if (data.type === "icon"){
                        doSend=false;
                        data.getAttachment(function(attachment){
                            if (attachment){
                                messageData = {
                                    filename: attachment.file.name,
                                    data: attachment.file.buffer
                                };
                            }
                            send();
                        });
                    }
                    if (data.type === "file" && data.file){
                        messageData = {
                            filename: data.file.name,
                            data: data.file.buffer
                        };
                    }

                    if (!messageData){
                        // we can't send functions or circular structures to another frame;
                        messageData = {};
                        if (data.path) messageData.path = data.path;
                        if (data.linkedFile) messageData.path = FileSystem.getDownloadUrl(data.linkedFile);
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

                function send(){
                    me.messageTarget.postMessage({
                        message: message,
                        data: messageData
                    },me.messageOrigin);
                }

                if (doSend) send();
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
        UI.enableDrag(me);
        UI.enableResize(me);
        UI.enableSelection(me,inner);
        me.setDropTarget(window);


        window.addEventListener("mouseenter",function(){
            if (!Mouse.isDown){
                me.activateContent(true);
            }
        });
        inner.addEventListener("mousemove",function(){
            if (!Mouse.isDown){
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