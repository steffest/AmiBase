import system from "./system.js";
import fileSystem from "./filesystem.js";
import desktop from "../ui/desktop.js";
let AmiFile = function(config){
    let me = {
        type:"file"
    };

    if (typeof config === "string"){
        let name=config;
        if (name.indexOf("/")>=0) name = name.split("/").pop();
        config = {
            name: name,
            url: config
        };
    }

    me.isAmiFile = true;

    if (config.url && config.url.indexOf(":")<0){
        var link = document.createElement("a");
        link.href = config.url;
        config.url = link.href;
    }
    if (!me.path) me.path = config.url;

    me.open = function(plugin){
        system.openFile(me,plugin);
    }

    me.getIcon = function(){
        return system.getIcon(me);
    }

    me.getPreview = function(){
       return system.getPreview(me);
    }

    me.getActions = function(icon){
        let actions = [];
        if (me.filetype && me.filetype.actions && me.filetype.actions.length){
            me.filetype.actions.forEach(action=>{
                actions.push({
                    label: action.label,
                    action: function(){
                        system.openFile(me,action.plugin,action.label);
                    }
                })
            });
        }else{
            actions.push({
                label:"Open",
                action: function(){
                    system.openFile(me);
                }
            });
        }

        actions.push(
            {
                label:"Open With",
                action: function(){
                    desktop.openWith(me);
                }
            },
            {
                label:"Download",
                action: function(){
                    system.downloadFile(me);
                }
            },
            {
                label:"Rename"
            },
            {
                label:"Delete",
                action: function(){
                    fileSystem.deleteFile(me);
                    icon.parent.removeIcon(icon);
                }
            });

        return actions;

    }

    return me;
}

export default AmiFile;