import $ from "../../../_script/util/dom.js";
import SelectBox from "../../../_script/ui/selectBox.js";
import fileSystem from "../../_script/system/filesystem.js";
import amiIcon from "../../_script/ui/icon.js";
import system from "../../_script/system/system.js";
import popupMenu from "../../_script/ui/popupMenu.js";
import Modal from "../../_script/ui/modal.js";
import desktop from "../../_script/ui/desktop.js";

let FileManager = function(){
    var me = {};
    var sideBar;
    var infoBar;
    var mainPanel;
    var amiWindow;
    let amiBase;
    var container;
    let viewMode = "icons";
    let currentFolder;
    let currentFile;

    me.init = function(containerWindow,context){
        amiWindow = containerWindow;
        amiWindow.setSize(600,400);

        let menu = [
            {label: "File Manager",items:[
                    {label: "Refresh",id:"fm-refresh",action:()=>me.refresh()},
                    {label: "Clean Up",action:()=>amiWindow.cleanUp()},
                    {label: "Upload File",action:()=>amiBase.uploadFile(me)},
                    {label: "New Drawer",action:()=>{
                        let newName = "My Content";
                        amiBase.createDirectory(currentFolder.path,newName).then(result=>{
                            me.refresh();
                        })
                    }},
                    {label: "New File",action:()=>{
                        let newName = "new.txt";
                        amiBase.writeFile(currentFolder.path + "/" + newName,"").then(result=>{
                            me.refresh();
                        });
                    }},
                    {label: "Close",id:"fm-close",action:()=>amiWindow.close()}
                ]}
        ];
        containerWindow.setMenu(menu,true);



        let toolBar = $(".panel.toolbar",
            toolButton("file","Show as preview",()=>{
                currentFolder.viewMode = viewMode = "preview";
                me.openFolder(currentFolder);
            }),
            toolButton("icons","Show as icons",()=>{
                currentFolder.viewMode = viewMode = "icons";
                me.openFolder(currentFolder);
            }),
            toolButton("list","Show as list",()=>{
                currentFolder.viewMode = viewMode = "list";
                me.openFolder(currentFolder);
            },8),
            toolButton("info","Show Info Panel",()=>{
                infoBar.classList.toggle("hidden");
                setUI();
                displayFileInfo();
            }),
            toolButton("sidebar","Show Navigation Panel",()=>{
                sideBar.classList.toggle("hidden");
                setUI();
            })
        );


        sideBar=$(".panel.full",{style:{width:"200px", right: "unset"}});
        infoBar=$(".infobar.hidden");
        mainPanel=$(".panel.full.transparent.list.overflow",{
            onClick:()=>{
                containerWindow.getSelectedIcons().forEach(function(item){
                    item.deActivate();
                });
                amiWindow.activate();
            },
            onDrag: (touchData)=>selectBox.update(touchData),
            onUp: ()=>selectBox.remove()
        });
        container = $(".content.panel.full.filemanager",toolBar,sideBar,infoBar,mainPanel);

        toolBar.style.height = '30px';
        toolBar.style.bottom = "unset";

        mainPanel.style.top = toolBar.style.height;
        sideBar.style.top = toolBar.style.height;
        infoBar.style.top = toolBar.style.height;

        let selectBox = SelectBox({
            parent: mainPanel,
            onSelect:(x,y,w,h)=>{
                let icons = containerWindow.getIcons();
                icons.forEach(function(icon){
                    if (icon.left>x && icon.left<x+w && icon.top>y && icon.top<y+h){
                        if (!icon.isActive()){
                            icon.activate(true);
                            icon.moveToTop();
                        }
                    }else{
                        icon.deActivate(true);
                    }
                });
            }
        });

        amiWindow.cleanUp = function(){
            var left= 10 ;
            var top= 20;
            let grid = amiWindow.getGridSize();
            let gridWidth = grid.width;
            let gridHeight = grid.height;

            var w = mainPanel.offsetWidth - gridWidth;

            let icons = amiWindow.getIcons();
            icons.forEach(function(icon){
                if (icon){
                    icon.setPosition(left,top);
                    left += gridWidth;
                    if (left>w){
                        top+=gridHeight;
                        left = 10;
                    }
                }
            })
        }

        amiWindow.setContent(container);
        //amiWindow.enableSelection(mainPanel);
        if (context) amiBase = context;
        setUI();
        listMounts();
    }

    me.openFile = async function(file){
        if (file && file.filetype && file.filetype.mountFileSystem){

            if (!file.binary){
                file.binary = await fileSystem.readFile(file,true);
            }
            console.error(file.binary)

            let drive = {
                type: "drive",
                name: file.name,
                volume: file.filetype.mountFileSystem.volume,
                handler: file.filetype.mountFileSystem.plugin,
                binary:file.binary
            }
            fileSystem.mount(drive).then(()=>{
                me.openFolder(drive);
                listMounts();
            });
        }else{
            console.error("Cannot open file, no filesystem",file);
        }
    }

    me.openFolder = async function(folder){
        console.log("openFolder",folder);
        if (typeof folder === "string") folder={path:folder};
        currentFolder = folder;

        mainPanel.innerHTML = "";
        let loader = $(".loader.centered.fade");
        mainPanel.appendChild(loader);
        setTimeout(()=>loader.classList.remove("fade"),50);
        amiWindow.clearIcons();
        amiWindow.setCaption(folder.name || folder.path);
        let list = folder.getContent ? await folder.getContent() : await amiBase.getDirectory(folder,true);
        viewMode = currentFolder.viewMode || viewMode;
        if (!list) return;

        let itemRenderer;
        switch (viewMode){
            case "icons":
                amiWindow.setGridSize(70,70);
                itemRenderer = function(object){
                    let icon = amiIcon(object);
                    icon.onDown(()=>{
                        currentFile = object;
                        displayFileInfo();
                    })
                    amiWindow.addIcon(icon,mainPanel);
                }
                break;
            case "preview":
                amiWindow.setGridSize(110,120);
                itemRenderer = function(object){
                    let icon = amiIcon(object);
                    icon.onDown(()=>{
                        currentFile = object;
                        displayFileInfo();
                    })
                    icon.setSize(100,100);
                    let image = $(".preview");

                    if (object.getPreview){
                        object.getPreview().then(preview=>{
                            console.error("preview",preview)
                            if (preview) image.appendChild(preview);
                            icon.setImage(image);
                        })
                    }else{
                        image.classList.add("default");
                        icon.setImage(image);
                    }
                    amiWindow.addIcon(icon,mainPanel);
                }
                break;
            default:
                itemRenderer = function(object){
                    let item = $(".listitem." + object.type,{
                        onClick:()=>{
                            currentFile = object;
                            item.classList.add("selected");
                            displayFileInfo();
                            selectItem(item);
                        },
                        onDoubleClick:()=>{
                            if (object.type === "folder"){
                                me.openFolder(object);
                            }else{
                                object.open()
                            }
                        },
                        onDragStart:()=>{
                            let pos = item.getBoundingClientRect();
                            return [amiWindow.createDragItem({
                                object:object,
                                label:object.name,
                                icon:object.type,
                                left:pos.left,
                                top:pos.top,
                            })];
                        },
                        onContext:(e)=>{
                            selectItem(item);
                            let x = e.clientX;
                            let y = e.clientY;
                            let items = object.getActions();
                            items.push({
                                label:"Info",
                                action: function(){
                                    system.inspectFile(object);
                                }
                            });

                            popupMenu.show({
                                items: items,
                                target: me,
                                x: x,
                                y: y,
                                onAction:(menuItem)=>{
                                    if (menuItem.label === "Rename"){
                                        item.innerHTML = "";
                                        let input = $("input",{value:object.name});
                                        let modal = Modal({
                                            content:input,
                                            onClose:(isOk)=>{
                                                let newName = isOk?input.value:object.name;
                                                if (newName !== object.name){
                                                    fileSystem.rename(object.path,newName);
                                                }
                                                item.innerHTML = newName;
                                                item.classList.add("draggable");
                                            },
                                            autoCloseOnBlur:true
                                        });

                                        item.appendChild(modal);
                                        item.classList.remove("draggable");
                                        input.focus();
                                    }
                                    console.error("onAction",item);
                                }
                            })
                        },
                        globalDrag:true
                    },object.name);
                    mainPanel.appendChild(item);
                }
        }

        mainPanel.innerHTML = "";
        if (viewMode === "list" && currentFolder.path.indexOf("/")>0){
           let parent = fileSystem.getParentPath(currentFolder.path);
              let item = $(".listitem.folder",{onClick:()=>me.openFolder(parent)}, "..");
                mainPanel.appendChild(item);
        }

        list.forEach(object => itemRenderer(object))
        if (viewMode !== "list") amiWindow.cleanUp();

        displayFolderInfo();
    }

    me.dropFile = function(file){
        console.log("drop file to filemanager",file);

        if ((file.type === "icon" || file.type === "dragitem") && file.object){

            if (file.object.type === "file"){
                amiBase.copyFile(file.object,currentFolder.path).then(result=>{
                    if (result) me.refresh();
                })
            }
        }
    }

    me.uploadFile = function(file){
        console.log("upload file",file);
        file.path = currentFolder.path + "/" + file.name;
        let notification = {
            label:"Uploading",
            text:file.name
        }
        notification.id = desktop.showNotification(notification);

        amiBase.writeFile(file,file.binary,true,(progress)=>{
            console.error("progress",progress);
            if (progress.computable) notification.progress = progress.loaded/progress.total;
            notification.progressText = formatSize(progress.loaded) + " of " + formatSize(progress.total);
            desktop.showNotification(notification);
        }).then(result=>{
            if (result) me.refresh();
            desktop.hideNotification(notification);
        });

        /*

        let path = target.getConfig().path;
                    file.path = path + file.name;
                    target.createIcon(file);
                    target.cleanUp();
                    fileSystem.writeFile(file,file.binary,true);
         */

    }

    me.hideSideBar = function(){
        sideBar.classList.add("hidden");
        setUI();
    }

    me.refresh = function(){
        me.openFolder(currentFolder);
    }

    function listMounts(){
        sideBar.innerHTML = "";
        var mounts = amiBase.getMounts();
        Object.keys(mounts).forEach(key => {
            var mount = mounts[key];
            sideBar.appendChild($(".button",{onClick:()=>me.openFolder(key + ":")},mount.name + " (" + key + ")"));
        })
    }

    async function displayFileInfo(){
        if (infoBar.classList.contains("hidden") || !currentFile) return;
        infoBar.innerHTML = "";

        if (currentFile.getPreview){
            let preview = await currentFile.getPreview();
            if (preview) infoBar.appendChild($(".preview",preview));
        }

        let info = await amiBase.getObjectInfo(currentFile);
        console.error(info);
        infoBar.appendChild($("h4",info.name));

        if (info.type === "file"){
            infoBar.appendChild($(".info",info.filetype));
            if (info.imageSize) infoBar.appendChild($(".info",info.imageSize + " px"));
            if (typeof info.size === "number") infoBar.appendChild($(".info",formatSize(info.size)));
            if (info.modified) infoBar.appendChild($(".info",$("i","Last Modified"),formatDate(info.modified)));

        }else{
            for (let key in info){
                if (key === "name") continue;
                infoBar.appendChild($("div",key + ": " + info[key]));
            }
        }


        infoBar.appendChild($(".divider"));
        if (currentFile.filetype && currentFile.filetype.actions && currentFile.filetype.actions.length){
            currentFile.filetype.actions.forEach(action=>{
                infoBar.appendChild($(".action",{onClick:()=>currentFile.open(action.plugin)}, action.label));
            });
        }else{
            infoBar.appendChild($(".action",{onClick:()=>currentFile.open()}, "Open"));
        }


    }

    function displayFolderInfo(){
        if (infoBar.classList.contains("hidden") || !currentFolder) return;
        infoBar.innerHTML = "";

        let name = currentFolder.name ||  currentFolder.path;
        name = name.split("/").pop();
        infoBar.appendChild($("h4",name));
        infoBar.appendChild($(".info",name.endsWith(":")?"Drive":"Drawer"));

    }


    let toolRight = 1;
    function toolButton(icon,hint,onClick,offset){
        let button = $(".button.tool.light",{
            onClick:onClick,
            style:{
                right:toolRight + "px",
            },
            title:hint
        },$(".icon",{
            style:{
                backgroundImage:"url(plugins/filemanager/icons/"+icon+".png)"
            }
        }));
        toolRight += 22 + (offset || 0);
        return button;
    }

    function setUI(){
        let left = 0;
        if (!sideBar.classList.contains("hidden")){
            left += 200;
        }
        if (!infoBar.classList.contains("hidden")){
            infoBar.style.left = left + "px";
            left += 120;
        }

        mainPanel.style.left = left + "px";
    }

    function formatSize(byte){
        if (byte<1024) return byte + " bytes";
        if (byte<1024*1024) return Math.round(byte/1024) + " KB";
        if (byte<1024*1024*1024) return Math.round(byte/1024/1024) + " MB";
        return Math.round(byte/1024/1024/1024) + " GB";
    }

    function formatDate(nr){
        let date = new Date(nr);
        return date.getDate() + "/" + (date.getMonth()+1) + "/" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes();
    }

    function selectItem(item){
        // TODO multi select
        let selected = mainPanel.querySelectorAll(".selected");
        selected.forEach(item=>item.classList.remove("selected"));
        if (item){
            item.classList.add("selected");
        }
    }

    return me;
};

export default FileManager;

