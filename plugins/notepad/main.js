/*
    Reference application for creating a new amiBase application plugin.
    a plugin is a trusted application that runs in the same context as amiBase.
    It can access all the methods and DOM of amiBase.

    This is a simple notepad application that allows to open, edit and save text files.
    It shows the basics of
        - creating a new amiBase application plugin
        - adding a menu to the main amiBase window
        - populating the amiBase window with a UI;
        - using the fileSystem to open and save files
        - using the system to request a file
 */

let Notepad = ()=>{
    let me = {
        name:"notepad",
        version:"0.0.1"
    };

    let textarea;
    let amiBase = {};
    let currentFile;
    let amiWindow;

    // this function is called by amiBase when the plugin is loaded
    me.init = function(containerWindow,context){
        return new Promise((next)=>{
            amiWindow = containerWindow;
            if (context) amiBase = context;
            if (!textarea) setupUI();

            var menu = [
                {label: "Notepad",items:[{label: "About",action:()=>alert("Notepad v" + me.version)}]},
                {label: "File",items:[
                        {label: "Open",id:"np-open",action:()=>open()},
                        {label: "Save",id:"np-save",action:()=>save()},
                        {label: "Save As",id:"np-save-as",action:()=>saveAs()}
                    ]}
            ];

            containerWindow.setMenu(menu,true);
            next();
        });
    }

    // all functions that you attach to the returned "me" object are directly available to amiBase
    me.openFile = async function(file){
        currentFile = file;
        if (amiBase){
            let content = await amiBase.readFile(file);
            textarea.value = content;
            amiWindow.setCaption(file.name);

            // disable save if file is read only
            let readOnly = await amiBase.isReadOnly(file);
            amiWindow.setMenuItem("np-save","",!readOnly);
            amiWindow.setMenuItem("np-save-as","",!readOnly);
        }
    }

    me.dropFile = async function(file){
        if (file.type === "icon" && file.object){
            me.openFile(file.object);
        }
    }

    async function open(){
        let file = await amiBase.requestFileOpen();
        if (file) me.openFile(file);
    }

    function save(){
        let content = textarea.value;
        amiBase.writeFile(currentFile,content);
    }

    async function saveAs(){
        console.error(currentFile);
        let file = await amiBase.requestFileSave(currentFile.path);
        if (file && file.path){
            console.log("saving to " + file.path);
            let content = textarea.value;
            amiBase.writeFile(file,content);
        }
    }

    function setupUI(){
        textarea = document.createElement("textarea");
        textarea.value = "";
        textarea.style.width = "100%";
        textarea.style.height = "100%";

        let container = amiWindow.getInner();
        container.innerHTML = "";
        container.appendChild(textarea);
    }


    return me;
}

export default Notepad; // don't call the function, just export it, as we allow for multiple instances
