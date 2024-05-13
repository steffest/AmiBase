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
        let canEdit = !filesystem.isReadOnly(target);

        function renderProperty(name,value,key){
            if (!value) return;

            let editBox = $(".value.cel",value);
            let label = $(".label.cel.relative",name);
            if (key && canEdit){
                $(".iconbutton.left.edit",{parent:label,onClick:()=>{
                    let input = $("input",{value:value});
                    let newValue = value;
                    input.oninput = (e)=>{
                        newValue = e.target.value;
                    }
                    input.onkeydown = (e)=>{
                        if (e.key === "Enter"){
                            target[key] = newValue;
                            editBox.innerText = newValue;
                            filesystem.writeMeta(target).then(result=>{
                                console.error("writeMeta",result);
                            })
                        }
                        if (e.key === "Escape"){
                            editBox.innerHTML = "";
                            editBox.innerText = value;
                        }
                    }
                    editBox.innerHTML = "";
                    editBox.appendChild(input);
                    setTimeout(()=>{
                        input.focus();
                        },50);
                    }});
            }

            $(".property.panel.light",{parent:panel},
                label,
                editBox,
            );
        }


        renderProperty("Name",target.name || target.label);
        if (target.name && target.label) renderProperty("Label",target.label);
        renderProperty("Type",target.type);
        renderProperty("Icon",target.icon || "default","icon");
        renderProperty("Icon Active",target.icon2 || target.iconActive);
        renderProperty("Path",target.path);
        renderProperty("URL",target.url);

        var actions;

        if (target.type === "file" || target.type === "link"){
            let mount = filesystem.getMount(target);
            let filetype = target.filetype || await system.detectFileType(target);

            renderProperty("ReadOnly","" + (!canEdit));
            if (target.mimeType) renderProperty("MimeType",target.mimeType);
            renderProperty("Mount",mount.name);
            renderProperty("FileSystem",mount.filesystem);
            renderProperty("Filetype",filetype.name);
            if (target.binary) renderProperty("Binary",target.binary.length + " bytes");

            if (target.type === "file"){
                actions = await getFileActions(filetype);
                console.error(actions);
            }else{
                actions = [
                    {
                        label:"Edit",
                        plugin:"linkeditor"
                    }
                ];
            }

        }



        renderProperty("Handler",target.handler || "default","handler");


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