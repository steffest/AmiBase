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
        me.isShiftDown = !! e.shiftKey;
        me.isAltDown = !! e.altKey;
        me.isCtrlDown = !! e.ctrlKey;
        me.isMetaDown = !! e.metaKey;
    }

    return me;
};

export default Input();