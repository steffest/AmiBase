var Notepad = 'yep';

var notepad_plugin_init = function(containerWindow){
    var currentFile;
    console.error(containerWindow);
    var container = containerWindow.getInner();
    container.innerHTML += '<br>Active';

    var textarea = document.createElement("textarea");
    textarea.value = "";
    textarea.style.width = "100%";
    textarea.style.height = "100%";
    container.innerHTML = "";
    container.appendChild(textarea);


    var menu = [
        {label: "Notepad",items:[{label: "About"}]},
        {label: "File",items:[
            {label: "Open",action:()=>open()},
            {label: "Save",action:()=>save()}
            ]}
    ];

    containerWindow.setMenu(menu,true);

    function open(){

    }

    function save(){
        var content = textarea.value;
        FileSystem.saveFile(currentFile.path,content);
    }


    Applications.registerApplicationActions("notepad",{
        "openfile":async function(file){
            console.error("notepad open file");
            currentFile = file;
            if (file.file){
                console.log("handle binary data");
                var content = String.fromCharCode.apply(null, new Uint8Array(file.file.buffer));
                textarea.value = content;
            }else if(file.path){
                var content = await FileSystem.readFile(file);
                if (typeof content !== "string") content  = String.fromCharCode.apply(null, new Uint8Array(content));
                textarea.value = content;
            }else if(file.url){
                console.log("load from url" , file.url);
                if (file.label) containerWindow.setCaption(file.label);
                var content = await FetchService.get(file.url);
                textarea.value=content;
            }else{
                console.warn("unknown structure",attachment);
            }
        }
    });

    if (containerWindow.onload) containerWindow.onload(containerWindow);


};