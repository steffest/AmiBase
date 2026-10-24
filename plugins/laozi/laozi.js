import fileSystem from "../../_script/system/filesystem.js";
import desktop from "../../_script/ui/desktop.js";
import $ from "../../_script/util/dom.js";
import BinaryStream from "../binaryStream/binaryStream.js";
import {createLaoziFs} from "./serverFs.js?v=3";

function requestKey(config,endpoint){
    return new Promise(resolve=>{
        const window = desktop.createWindow("Connect: " + (config.label || "Laozi v2"));
        window.setSize(440,250);
        let input;
        window.onClose = ()=>{input.value = ""; resolve(null);};
        const submit = ()=>{
            const key = input.value.trim();
            input.value = "";
            resolve(key);
            window.close();
        };
        window.setContent($(".content.full.addmount",
            $("p",endpoint),
            $("p","Enter your access key. It will be remembered in this browser until you eject the drive."),
            $(".form",$("label","Access key"),input = $("input",{type:"password",autocomplete:"off",onkeydown:event=>{if(event.key === "Enter") submit();}})),
            $(".buttons.panel.bottom",$(".button.inline",{onClick:submit},"Connect"),$(".button.inline",{onClick:()=>window.close()},"Cancel"))
        ));
        input.focus();
    });
}

const handler = createLaoziFs({requestKey,toBinary:buffer=>BinaryStream(buffer,true)});
// UI callers expect failed mutations to return false; never leave their promises pending.
const fallbacks = {getDirectory:()=>({directories:[],files:[]}),getInfo:()=>({}),readFile:()=>undefined,getUrl:()=>undefined};
for (const name of ["getDirectory","getInfo","readFile","getUrl","writeFile","createDirectory","deleteFile","deleteDirectory","deleteFolder","moveFile","renameFile","getUniqueName"]){
    const operation = handler[name];
    handler[name] = async function(...args){
        try{return await operation(...args);}
        catch(error){
            // Missing metadata sidecars are normal, not user-facing failures.
            if (!(name === "readFile" && error.status === 404 && String(args[0]).endsWith(".aminfo"))) desktop.showError(error.message || "Laozi request failed.");
            return fallbacks[name] ? fallbacks[name]() : false;
        }
    };
}
fileSystem.register("laozi",handler);
export default handler;
