import desktop from "../../../_script/ui/desktop.js";
import fileSystem from "../../../_script/system/filesystem.js";
import $ from "../../../_script/util/dom.js";

let FileRequester = function(){
    let me = {};
    let sideBar,mainPanel,bottomBar,okButton,cancelButton,input,parent,container,currentType,currentFile,currentFolder,next;

    me.open = function(type){

        currentType=type||"open";
        if (typeof currentType === "object"){
            currentFile = currentType.path;
            currentType = currentType.type || "save";
        }

        return new Promise(resolve=>{
            next = resolve;
            parent = desktop.createWindow("request File");
            parent.setSize(600,400);

            let bottomBarHeight = "30px";
            container = $(".content.panel.full",
                sideBar=$(".panel.full",{style:{width:"200px", right: "unset"}}),
                mainPanel=$(".panel.light.list.overflow.full",{style:{marginLeft:"200px"}}),
                bottomBar=$(".panel.bottom.full.hidden.nooverflow",
                    cancelButton = $(".button.inline",{onClick:()=>parent.close(),style:{width:'94px'}},"Cancel"),
                    okButton = $(".button.inline",{onClick:onOk,style:{width:'94px'}},"Save File"),
                    input = $("input.absolute",{type:"text",placeholder:"File Name",style:{left: "200px", top: "2px", width: "397px"}})
                ),
            );

            if (currentType === "save"){
                mainPanel.style.bottom = sideBar.style.bottom = bottomBar.style.height = bottomBarHeight;
                bottomBar.style.top = "unset";
                bottomBar.classList.remove("hidden");
                if (currentFile){
                    let name = currentFile.split("/").pop();
                    let folder = currentFile.split("/").slice(0,-1).join("/");
                    if (!folder && currentFile.indexOf(":")>0){
                        folder = currentFile.split(":").shift() + ":";
                        name = currentFile.split(":").pop();
                    }
                    input.value = name;
                    if (folder) listDir(folder);
                }
            }
            parent.setContent(container);
            listMounts();
        })
    }

    function listMounts(){
        let mounts = fileSystem.getMounts();
        Object.keys(mounts).forEach(key => {
            var mount = mounts[key];
            sideBar.appendChild($(".button",{onClick:()=>listDir(key + ":")},mount.name + " (" + key + ")"));
        })
    }

    async function listDir(folder){
        if (typeof folder === "string") folder={path:folder};
        currentFolder = folder.path;
        var mount = fileSystem.getMount(folder.path);
        mainPanel.innerHTML = "";

        var list = await fileSystem.getDirectory(folder,true);
        if (list){
            list.forEach(object => {
                if (object.type === "folder"){
                    mainPanel.appendChild($(".listitem.folder",{onClick:()=>{listDir(object)}},object.name));
                }

                if (object.type === "file"){
                    mainPanel.appendChild($(".listitem.file",{onClick:()=>{
                            selectFile(object)
                    }},object.name));

                }
            })
        }

    }

    function selectFile(file){
        input.value = file.name;
        console.log(currentType);
        if (currentType === "open"){
            parent.close();
            next(file);}
    }

    function onOk(){
        let path = currentFolder;
        if (!path.endsWith("/")) path += "/";
        path += input.value
        next({path: path});
        parent.close();
    }

    return me;
};

export default FileRequester();

