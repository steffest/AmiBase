var AmiIcon = function(config){
    var me = {
        type:"icon",
        id: uuid(),
        zIndex: 0
    };

    var icon = $div("icon " + (Settings.useDelayedDrag?"delayed":""));
    var img = $div("image " + cleanString(config.label));
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
    UI.enableDrag(me,true);

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

    me.hide = function(){
        icon.classList.add("hidden");
    };
    me.show = function(){
        icon.classList.remove("hidden");
        icon.classList.remove("ghost");
    };
    me.ghost = function(){
        icon.classList.add("ghost");
    };
    me.clone = function(){
        // returns a clone with absolute position coordinates relative to the desktop
        var clone = icon.cloneNode(true);
        var pos =  icon.getBoundingClientRect();
        clone.style.left = pos.left + "px";
        clone.style.top = pos.top + "px";
        clone.style.transform = "";
        return clone;
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