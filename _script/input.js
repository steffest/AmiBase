import ui from "./ui/ui.js";
var Input = function(){
    var me = {};

    me.init = function(){
        document.body.addEventListener("keydown",function(e){
            setMetaKeys(e);
            let modal = ui.getModal();
            if (modal){
                if (e.code === "Escape"){
                    modal.close();
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (e.code === "Enter"){
                    modal.commit();
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
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