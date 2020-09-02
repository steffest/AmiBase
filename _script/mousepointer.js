var Mouse = function(){
    var me = {};

    var useCustomMousePointer = Settings.useCustomMousePointer;
    var mousePointer;

    me.init = function () {
        if (useCustomMousePointer){
            mousePointer = $div("","mousepointer");
            document.body.appendChild(mousePointer);
            document.body.classList.add("custompointer");

            document.body.addEventListener("mouseleave",function(){
                me.hide();
            });
        }else{
            document.body.classList.add("defaultpointer");
        }
    };

    me.update = function(e){
        if (!useCustomMousePointer) return;
        mousePointer.style.display = "block";
        mousePointer.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)";
    };

    me.hide = function(){
        mousePointer.style.display = "none";
    };

    return me;
}();