import desktop from "../../_script/ui/desktop.js";
import system from "../../_script/system/system.js";
import $ from "../../_script/util/dom.js";
import filesystem from "../../_script/system/filesystem.js";
let Inspector = function(){
    var me = {};
    
    me.inspect = async function(target){
        var w = desktop.createWindow({
            label:"info"
        });
        w.setSize(320,300);
        w.setContent(await generateInfo(target));
    };

    me.getInfo = async function(target){
        return new Promise(async function(next){
            let result = {
                name: target.name || target.label
            };

            if (target.isAmiFile){
                result.type = "file";
                let fileType = target.filetype || await system.detectFileType(target);
                if (fileType){
                    result.filetype = fileType.name || "Unknown";
                }

                let fileInfo = await filesystem.getFileProperties(target);
                if (fileInfo){
                    if (fileInfo.file){
                        result.size = fileInfo.file.size;
                        result.modified = fileInfo.file.modified;
                    }
                    if (fileInfo.exif){
                        if (fileInfo.exif.ImageSize){
                            result.imageSize = fileInfo.exif.ImageSize;
                        }
                    }
                }
                console.error(fileInfo);
            }


            console.error(target);


            next(result);
        });
    }

    async function generateInfo(target){
        console.error(target);

        let panel;
        let element = $(".content",panel = $(".panel.full"));

        function renderProperty(name,value){
            $(".property.panel.light",{parent:panel},$(".label.cel",name),$(".value.cel.capitalize",value));
        }

        renderProperty("Name",target.name || target.label);
        renderProperty("Type",target.type);
        renderProperty("Icon",target.icon || "default");


        if (target.icon2){
            renderProperty("Icon Active",target.icon2);
        }

        var actions;

        if (target.type === "file"){
            let mount = filesystem.getMount(target);
            let filetype = target.filetype || await system.detectFileType(target);

            renderProperty("Path",target.path);
            renderProperty("ReadOnly","" + filesystem.isReadOnly(target));
            if (target.mimeType) renderProperty("MimeType",target.mimeType);
            renderProperty("Mount",mount.name);
            renderProperty("FileSystem",mount.filesystem);
            renderProperty("Filetype",filetype.name);
            if (target.binary) renderProperty("Binary",target.binary.length + " bytes");

            actions = await getFileActions(filetype);

        }

        if (target.type === "folder"){
            renderProperty("Path",target.path);
        }

        if (target.type === "drive"){
            renderProperty("Path",target.path);
        }

        if (target.handler){
            renderProperty("Handler",target.handler);
        }


        if (actions){
            let actionPanel = $(".value.cel");
            $(".property.panel.light",{parent:panel},$(".label.cel","Actions"),actionPanel);

            actions.forEach(action=>{
                var command = action.label;
                if (action.plugin) command += " (" + action.plugin + ")";
                $(".button",{parent:actionPanel,onClick:()=>system.openFile(target,action.plugin,action.label)},command);

            })
        }
        return element;
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