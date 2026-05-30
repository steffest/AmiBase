import desktop from "../ui/desktop.js";
import fileSystem from "./filesystem.js";
import system from "./system.js";
import Dialog from "../ui/dialog.js";
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
            {label:"Eject", action: function(){
                if (me.filesystemName === "rad" || me.handler === "rad") {
                    Dialog.show({
                        title: "Remove RAD Drive",
                        message: "What do you want to do with the drive's files?",
                        buttons: [
                            { label: "Cancel", value: "cancel" },
                            { label: "Remove Drive", value: "remove" },
                            { label: "Remove drive and data", value: "remove_data", primary: true }
                        ],
                        onClose: (value) => {
                            if (value === "remove" || value === "remove_data") {
                                if (value === "remove_data") {
                                    fileSystem.deleteStorage(me);
                                }
                                fileSystem.unmount(me);
                                icon.parent.removeIcon(icon);
                            }
                        }
                    });
                } else {
                    fileSystem.unmount(me);
                    icon.parent.removeIcon(icon);
                }
            }},
        ];
        return actions;

    }

    return me;
}

export default AmiDrive