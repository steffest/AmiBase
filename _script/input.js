var Input = function(){
    var me = {};

    me.init = function(){
        document.body.addEventListener("keydown",function(e){
            setMetaKeys(e);
        });

        document.body.addEventListener("keyup",function(e){
            setMetaKeys(e);
        });
    };

    function setMetaKeys(e){
        Input.isShiftDown = !! e.shiftKey;
        Input.isAltDown = !! e.altKey;
        Input.isCtrlDown = !! e.ctrlKey;
        Input.isMetaDown = !! e.metaKey;
    }

    return me;
}();