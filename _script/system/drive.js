import desktop from "../ui/desktop.js";
import fileSystem from "./filesystem.js";
import system from "./system.js";
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
    me.getActions = function(icon){
        let actions = [
            {label:"Open", action: function(){system.exploreFolder(me)}},
            {label:"Rename"},
            {label:"Eject", action: function(){fileSystem.unmount(me); icon.parent.removeIcon(icon)}},
        ];
        return actions;

    }

    return me;
}

export default AmiDrive