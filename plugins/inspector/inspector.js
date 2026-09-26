import desktop from "../../_script/ui/desktop.js";
import system from "../../_script/system/system.js";
import $,{$div} from "../../_script/util/dom.js";
import filesystem from "../../_script/system/filesystem.js";
import iconLibrary from "../../_script/ui/iconLibrary.js";
let Inspector = function(){
    var me = {};


    me.inspect = async function(target,icon){
        var w = desktop.createWindow({
            label:"info"
        });
        w.setSize(320,300);
        let refresh = async function(){
            w.setContent(await generateInfo(target,refresh,icon));
        };
        await refresh();
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

    async function generateInfo(target,refresh,icon){
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
                            filesystem.writeMeta(target);
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

        async function renderIconProperty(target,refresh,icon){
            let preview = $div("glyph");
            preview.style.width = "32px";
            preview.style.height = "32px";
            preview.style.display = "inline-block";
            preview.style.verticalAlign = "middle";
            let previewWrap = $(".icon",{style:{position:"relative",display:"inline-block"}},preview);

            if (target.icon){
                let url = await resolveIconPreviewUrl(target.icon);
                preview.style.backgroundImage = "url('" + url + "')";
                preview.style.backgroundSize = "cover";
                preview.style.backgroundPosition = "center center";
            }else{
                preview.classList.add(target.iconClass || "defaultfile");
            }

            let editBox = $(".value.cel",previewWrap);
            if (canEdit){
                $(".button.inline",{parent:editBox,style:{marginLeft:"8px"},onClick:()=>openIconPicker(target,refresh,icon)},"Change...");
            }

            $(".property.panel.light",{parent:panel},
                $(".label.cel.relative","Icon"),
                editBox,
            );
        }


        renderProperty("Name",target.name || target.label);
        if (target.name && target.label) renderProperty("Label",target.label);
        renderProperty("Type",target.type);
        await renderIconProperty(target,refresh,icon);
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
            if (target.binary) {
                renderProperty("Size", formatSize(target.binary.length));
            } else {
                let fileInfo = await filesystem.getFileProperties(target);
                if (fileInfo && fileInfo.file) {
                    if (typeof fileInfo.file.size !== "undefined" && fileInfo.file.size !== null) {
                        renderProperty("Size", formatSize(fileInfo.file.size));
                    }
                    if (fileInfo.file.modified) {
                        let mod = fileInfo.file.modified;
                        if (typeof mod === "number") {
                            // If UNIX timestamp in seconds, convert to milliseconds
                            if (mod < 10000000000) mod = mod * 1000;
                            mod = new Date(mod).toLocaleString();
                        }
                        renderProperty("Modified", mod);
                    }
                }
            }

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
    
    async function resolveIconPreviewUrl(icon){
        let mounts = filesystem.getMounts();
        let volume = filesystem.getVolume(icon);
        if (volume && mounts[volume]) return await filesystem.getDisplayUrl(icon);
        return icon;
    }

    async function openIconPicker(target,refresh,icon){
        let win = desktop.createWindow({label:"choose icon"});
        win.setSize(360,420);

        async function apply(changes){
            target.icon = changes.icon;
            target.iconClass = changes.iconClass;
            await filesystem.writeMeta(target);
            if (icon) icon.refreshIcon();
            win.close();
            refresh();
        }

        let searchInput = $("input",{type:"text",placeholder:"Search icons...",style:{width:"100%"}});
        let grid = $(".panel.light.full",{style:{position:"absolute",left:"0",right:"0",top:"36px",bottom:"40px",overflow:"auto",padding:"6px"}});
        let openImageButton = $(".button.inline",{style:{width:"120px"},onClick:async ()=>{
            let file = await system.requestFileOpen(null,"image");
            if (file && file.path) apply({icon:file.path,iconClass:""});
        }},"Open image...");
        let resetButton = $(".button.inline",{style:{width:"120px"},onClick:()=>apply({icon:"",iconClass:""})},"Reset");
        let bottomBar = $(".panel.full",{style:{top:"unset",height:"40px",padding:"4px 8px"}},openImageButton,resetButton);

        function renderGrid(filter){
            grid.innerHTML = "";
            iconLibrary
                .filter(name=>!filter || name.indexOf(filter.toLowerCase())>=0)
                .forEach(name=>{
                    let glyph = $div("glyph " + name);
                    let tile = $(".icon",{
                        style:{position:"relative",display:"inline-block",width:"48px",height:"48px",margin:"4px",cursor:"pointer"},
                        onClick:()=>apply({icon:"",iconClass:name})
                    },glyph);
                    grid.appendChild(tile);
                });
        }
        searchInput.oninput = (e)=>renderGrid(e.target.value);
        renderGrid("");

        win.setContent($(".content.panel.full",searchInput,grid,bottomBar));
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

    function formatSize(byte){
        if (typeof byte !== "number") return byte;
        if (byte<1024) return byte + " bytes";
        if (byte<1024*1024) return Math.round(byte/1024) + " KB";
        if (byte<1024*1024*1024) return Math.round(byte/1024/1024) + " MB";
        return Math.round(byte/1024/1024/1024) + " GB";
    }

    return me;
};

export default Inspector();