import desktop from "../ui/desktop.js";
import fileSystem from "./filesystem.js";
let AmiDrive = function(config){
    var me = {
        type:"drive"
    };

    // pre mount?
    me.open = async function(){
        if (!me.mounted) await fileSystem.mount(me);
        desktop.openDrive(me);
    }

    me.getContent = function(){
        return new Promise(next=>{
            fileSystem.getDirectory(me.volume + ":",true).then(next);
        });

    }

    return me;
}

export default AmiDrive