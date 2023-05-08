
let Notepad = ()=>{
    let me = {
        name:"notepad"
    };

    // TODO: multiple instances ...

    let textarea;
    let amiBase = {};
    let currentFile;
    let currentWindow;

    function setup(){
        textarea = document.createElement("textarea");
        textarea.value = "";
        textarea.style.width = "100%";
        textarea.style.height = "100%";
    }

    me.init = function(containerWindow,context){
        var container = containerWindow.getInner();
        container.innerHTML += '<br>Active';

        if (!textarea) setup();

        container.innerHTML = "";
        container.appendChild(textarea);
        currentWindow = containerWindow;

        var menu = [
            {label: "Notepad",items:[{label: "About"}]},
            {label: "File",items:[
                    {label: "Open",id:"np-open",action:()=>open()},
                    {label: "Save",id:"np-save",action:()=>save()}
                ]}
        ];

        containerWindow.setMenu(menu,true);


        if (context && context.registerApplicationActions){
            amiBase = context;
            context.registerApplicationActions("notepad",{
                "openfile":openFile
            });
        }

        if (containerWindow.onload) containerWindow.onload(containerWindow);

    }

    async function open(){
        let file = await amiBase.system.requestFile();
        if (file){
            openFile(file);
        }
    }

    function save(){
        let content = textarea.value;
        amiBase.fileSystem.writeFile(currentFile.path,content);
    }

    async function openFile(file){
        console.error("notepad open file");
        currentFile = file;
        let content = await amiBase.fileSystem.readFile(file);
        if (typeof content !== "string") content  = String.fromCharCode.apply(null, new Uint8Array(content));
        textarea.value = content;

        let readOnly = await amiBase.fileSystem.isReadOnly(file);
        currentWindow.setMenuItem("np-save","",!readOnly);
    }

    return me;
}

export default Notepad();