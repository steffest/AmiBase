var AmiIcon = function(config){
    var me = {
        type:"icon",
        id: uuid(),
        zIndex: 0
    };

    var icon = $div("icon");
    var img = $div("image");
    var label = $div("label","","<span>" + config.label + "</span>");
    me.iconType = config.type;

    icon.appendChild(img);
    icon.appendChild(label);

    me.setPosition = function(left,top,zIndex){
        me.left = left;
        me.top = top;
        icon.style.transform = "translate(" + left + "px," + top + "px)";
    };

    me.element = icon;
    me.setPosition(50,50);
    UI.enableDrag(me);

    me.setIndex = function(zIndex){
        me.zIndex = zIndex+1;
        icon.style.zIndex = me.zIndex;
    };

    me.moveToTop = function(){
        var zIndex = Desktop.getTopZindex();
        if (zIndex>me.zIndex){
            me.setIndex(zIndex+1);
        }
    };

    me.activate = function(soft){
        if (!soft){
            me.moveToTop();
            Desktop.setFocusElement(me);
        }
        icon.classList.add("active");
    };

    me.deActivate = function(soft){
        icon.classList.remove("active");
    };

    me.isActive = function(){
        return  icon.classList.contains("active");
    };

    //icon.onmousedown = function(){
    //    me.activate();
    //};

    icon.ondblclick = function(){
        if (me.iconType === "drawer"){
            Desktop.openDrawer({caption:config.label,url:config.url});
        }
        if (me.iconType === "program"){
            Desktop.launchProgram({url:config.url});
        }
        if (me.iconType === "url"){
            Desktop.launchUrl({url:config.url});
        }
    };

    return me;
};