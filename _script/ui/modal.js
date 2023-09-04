import $ from "../util/dom.js";
import ui from "../ui/ui.js";
let Modal = function(config){
    let me = {};
    let container = $(".modal.handle");
    if (config.content) container.appendChild(config.content);

    me.close = function(ok){
        ui.setModal(null);
        container.parentNode.removeChild(container);
        if (config.onClose) config.onClose(ok);

    }

    me.commit = function(){
        if (config.onOk) config.onOk();
        me.close(true);
    }

    me.blur = function(){
        if (config.autoCloseOnBlur) me.close(true);
    }

    ui.setModal(me);
    return container;



 return me;
}

export default Modal;