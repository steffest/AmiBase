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

    var window = $div("window",me.id);
    window.style.zIndex = me.zIndex;
    var caption = $div("caption","",config.caption);
    var windowBar =  $div("bar","",caption);
    var inner = $div("inner innerwindow");
    var sizer = $div("sizer");
    var close = $div("close");
    selectBox = $div("selectBox");

    windowBar.appendChild(close);
    window.appendChild(windowBar);
    window.appendChild(inner);
    window.appendChild(sizer);
    inner.appendChild(selectBox);

    close.onclick = function(){
        Desktop.removeWindow(me);
    };

    me.getInner = function(){
        return inner;
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

    me.cleanUp = function(){
        var left= 10 + (config.paddingLeft || 0);
        var top= 20 + (config.paddingTop || 0);

        icons.forEach(function(icon){
            icon.setPosition(left,top);
            top += 70;
        })

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
                if (item.parent.id === me.id){
                    // move inside parent

                }else{
                    // drop in other window
                    console.log("moving item to new parent");
                    var oldPos = item.element.getBoundingClientRect();
                    item.parent.removeIcon(item);
                    me.addIcon(item);
                    var newPos = item.element.getBoundingClientRect();

                    // get new coordinates offset relative to new parent;
                    var cX = newPos.left-oldPos.left;
                    var cY = newPos.top-oldPos.top;
                    left -= cX;
                    top -= cY;
                }

                if (left<0) left=0;
                if (top<0) top=0;

                item.setPosition(left,top);
            });
        });
    };



    if (config.type !== "desktop"){

        me.getCaption = function(){
            return caption.innerText;
        };

        me.setCaption = function(text){
            caption.innerHTML = text;
        };

        me.setPosition = function(left,top,zIndex){
            me.left = left;
            me.top = top;
            window.style.transform = "translate(" + left + "px," + top + "px)";
        };

        me.setSize = function(width,height){
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
            window.classList.add("inactivecontent");
        };

        me.setContent = function(content){
            inner.innerHTML="";
            me.appendContent(content);
        };

        me.setMenu = function(_menu){
            console.error(_menu);
            menu = _menu
        };

        me.getMenu = function(){
            return menu;
        };

        me.appendContent = function(content){
            if (typeof content === "string"){
                inner.innerHTML= content;
            }else{
                inner.appendChild(content);
            }
        };


        me.element = window;
        me.dragHandle = windowBar;
        me.resizeHandle = sizer;
        me.setPosition(200,200);
        if(config.width && config.height){
            me.setSize(config.width,config.height);
        }
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