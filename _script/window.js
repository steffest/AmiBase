var AmiWindow = function(config){
    var me = {
        type:"window",
        id: uuid(),
        zIndex: 0,
    };

    var icons = [];
    var menu;

    var window = $div("window");
    window.style.zIndex = me.zIndex;
    var caption = $div("caption","",config.caption);
    var windowBar =  $div("bar","",caption);
    var inner = $div("inner innerwindow droptarget");
    var sizer = $div("sizer");
    var close = $div("close");

    windowBar.appendChild(close);
    window.appendChild(windowBar);
    window.appendChild(inner);
    window.appendChild(sizer);

    close.onclick = function(){
        window.remove();
    };


    inner.ondrop = function(sourceElement,dragElement){
        console.error(sourceElement);
        console.error(sourceElement.path);

        inner.appendChild(sourceElement);
        var pos = getElementPosition(inner);
        var offsetX = dragElement.offsetLeft - pos.left;
        var offsetY = dragElement.offsetTop - pos.top;
        sourceElement.style.left = offsetX + "px";
        sourceElement.style.top = offsetY + "px";

        console.log("Moving icon " + sourceElement.path + " to " + path);
        //me.moveFile(sourceElement.path,path);

    };

    me.getInner = function(){
        return inner;
    };

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


    me.createIcon = function(config){
        if (typeof config === "string") config={
            label: config
        };

        var icon = AmiIcon(config);
        inner.appendChild(icon.element);
        icons.push(icon);
        return icon;
    };

    me.element = window;
    me.dragHandle = windowBar;
    me.resizeHandle = sizer;
    me.setPosition(200,200);
    UI.enableDrag(me);
    UI.enableResize(me);

    return me;
};