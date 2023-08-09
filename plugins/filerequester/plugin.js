import desktop from "../../../_script/ui/desktop.js";
import fileSystem from "../../../_script/system/filesystem.js";
import {$div} from "../../../_script/util/dom.js";

let FileRequester = function(app){
    var me = {};
    var sideBar;
    var mainpanel;
    var parent;
    var container;
    let onSelect;

    me.open = function(){

        return new Promise(resolve=>{
            onSelect = resolve;
            parent = desktop.createWindow("request File");
            parent.setSize(600,400);
            container = $div("filerequester");
            parent.setContent(container);
            sideBar = undefined;
            mainpanel = undefined;

            listMounts()
        })
    }

    function listMounts(){
        if (!sideBar){
            sideBar = $div("mountsidebar");
            container.appendChild(sideBar)
        }

        var mounts = fileSystem.getMounts();
        Object.keys(mounts).forEach(key => {
            var mount = mounts[key];
            var btn = $div("listitem","",mount.name + " (" + key + ")");
            btn.onclick = function(){
                listDir(key + ":");
            }
            sideBar.appendChild(btn);
        })
    }

    async function listDir(folder){
        if (typeof folder === "string") folder={path:folder};
        var mount = fileSystem.getMount(folder.path);
        if (!mainpanel){
            mainpanel = $div("filerequestermainpanel");
            container.appendChild(mainpanel)
        }
        mainpanel.innerHTML = "";

        var list = await fileSystem.getDirectory(folder,true);
        if (list){
            list.forEach(object => {
                if (object.type === "folder"){
                    var btn = $div("listitem dir","",object.name);
                    btn.onclick = function(){
                        listDir(object);
                    }
                    mainpanel.appendChild(btn);
                }

                if (object.type === "file"){
                    var item = $div("listitem file","",object.name);
                    item.onclick = function(){
                        if (typeof onSelect === "function"){
                            parent.close();
                            onSelect(object);
                        }
                    }
                    mainpanel.appendChild(item);
                }
            })
        }

    }

    return me;
};

export default FileRequester();

