
let HtmlAudio = ()=>{
    let me = {
        name:"htmlAudio"
    };

    let amiBase = {};
    let currentFile;
    let currentWindow;

    function setup(){

    }

    me.init = function(containerWindow,context){
        var container = containerWindow.getInner();
        container.innerHTML = 'Html Audio';
        currentWindow = containerWindow;

        var menu = [
            {label: "Html Audio",items:[{label: "About"}]},
            {label: "File",items:[
                    {label: "Open",id:"np-open",action:()=>open()}
                ]}
        ];

        containerWindow.setMenu(menu,true);


        if (context && context.registerApplicationActions){
            amiBase = context;
            context.registerApplicationActions("htmlAudio",{
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


    async function openFile(file){
        console.error("html Audio open file");
        currentFile = file;
        console.error(file);


        let audio = document.createElement("audio");
        audio.controls = "controls";
        audio.src = file.url;

        let container = currentWindow.getInner();
        //container.innerHTML = "";
        container.appendChild(audio);

        audio.play();

    }

    return me;
}

export default HtmlAudio();