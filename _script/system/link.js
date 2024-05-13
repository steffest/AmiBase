import desktop from "../ui/desktop.js";
import system from "./system.js";
import fileSystem from "./filesystem.js";

let amiLink = function(){
    let me = {
        type:"link"
    };

    me.open = function(){
        if (me.handler){
            system.launchProgram(me.handler);
        }else{
            if (me.url && me.url.indexOf("plugin:") === 0){
                system.launchProgram(me.url);
            }else{
                desktop.launchUrl(me);
            }
        }
    }

    me.getActions = function(icon){
        let actions = [
            {label:"Open", action: function(){me.open()}},
            {label:"Edit", action: function(){
                    system.openFile(me,"linkeditor");
            }},
            {label:"Delete", action: function(){
                fileSystem.deleteFile(me);
                icon.parent.removeIcon(icon)}
            },
        ];
        return actions;

    }
    return me;
}

export default amiLink;