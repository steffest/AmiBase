import desktop from "../../_script/ui/desktop.js";
import system from "../../_script/system/system.js";
import {$div} from "../../_script/util/dom.js";
import filesystem from "../../_script/system/filesystem.js";
let Inspector = function(){
    var me = {};
    
    me.inspect = async function(target){
        var w = desktop.createWindow({
            label:"info"
        });
        w.setSize(500,200);
        w.setContent(await generateInfo(target));

    };

    async function generateInfo(target){
        console.error(target);

        var info = ["Type: " + target.type];
        if (target.icon){
            info.push("Icon: " + target.icon);
        }else{
            info.push("Using default icon");
        }

        if (target.icon2){
            info.push("Icon Active: " + target.icon2);
        }

        var filetype;
        var actions;
        if (target.type === "file"){
            info.push("Path: " + target.path);
            info.push("ReadOnly: " + filesystem.isReadOnly(target));
            let mount = filesystem.getMount(target);;
            if (target.mimeType)  info.push("MimeType: " + target.mimeType);
            info.push("Mount: " + mount.name);
            info.push("FileSystem: " + mount.filesystem);
            filetype = target.filetype || await system.detectFileType(target);
            info.push("Filetype: " + filetype.name);
            actions = await getFileActions(filetype);
        }

        if (target.handler){
            info.push("Handler: " + target.handler);
        }
        
        var panel = $div("infopanel","",info.join("<br>"));

        if (actions){
            panel.appendChild($div("","","Actions"));

            actions.forEach(action=>{
                var command = action.label;
                if (action.plugin) command += " (" + action.plugin + ")";
                
                var button = $div("btn","","<u>" + command + "</u>");
                button.onclick = function(){
                    system.openFile(target,action.plugin,action.label);
                }
                panel.appendChild(button);
            })
        }
        return panel;
    }
    
    async function getFileActions(info){
        if (info.actions){
            // already resolved
            return info.actions;
        }else{
            var filetype = await system.detectFileType(info);
            return filetype.actions || [];
        }
    }


    return me;
};

export default Inspector();