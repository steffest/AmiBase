let Hex = ()=>{
    let me = {}

    let hexView;
    let asciiView;
    let gutter;
    let amiBase;

    me.init = (amiWindow,host)=>{
        amiWindow.setContent(createUI());

        var menu = [
            {label: "Hex",items:[{label: "About"}]},
            {label: "File",items:[
                    {label: "Open",action:()=>open()}
                ]}
        ];
        amiWindow.setMenu(menu,true);

        if (host){
            amiBase = host;
            amiBase.registerApplicationActions("hex",{
                "openfile":openFile
            });
        }

        amiWindow.setSize(584,400);
        if (amiWindow.onload) amiWindow.onload(amiWindow);
    }

    let createUI = function(){
        hexView = document.createElement("textarea");
        hexView.classList.add("hex");
        asciiView = document.createElement("textarea");
        asciiView.classList.add("ascii");
        gutter = document.createElement("div");
        gutter.classList.add("gutter");
        let container = document.createElement("div");
        container.className = "hexeditor";
        container.appendChild(gutter);
        container.appendChild(hexView);
        container.appendChild(asciiView);
        return container;
    }

    let renderContent = content=>{
        //var byteArray = new Uint8Array(content);
        // content is a BinaryStream

        let s = "";
        let a = "";
        gutter.innerHTML = "00 ";

        let max = Math.min(content.length,368);
        content.goto(0);
        for (var i = 1; i<= max; i++){
            var eol = "";
            if (i%16 === 0){
                eol = "\n";
                if (i<max) gutter.innerHTML += formatHex(i) + " ";
            }
            var b = content.readUbyte();
            s += formatHex(b) + (eol||" ");
            if (b===10) b=32;
            if (b===13) b=32;
            a += String.fromCharCode(b) + eol;
        }

        hexView.value = s;
        asciiView.value = a;
    }

    function formatHex(nr){
        let result = nr.toString(16).toUpperCase();
        if (result.length<2) result = "0" + result;
        if (result.length>2){
            console.error(nr,result);
        }
        return result;
    }

    async function open(){
        let file = await amiBase.system.requestFile();
        if (file){
            openFile(file);
        }
    }

    async function openFile(file){
        let content = await amiBase.fileSystem.readFile(file,true);
        renderContent(content);
        let readOnly = await amiBase.fileSystem.isReadOnly(file);
    }

    return me;
}

export default Hex();