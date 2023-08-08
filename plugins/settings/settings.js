let Settings = ()=>{
    let me = {}
    let amiBase;
    let edit;

    me.init = (amiWindow,host)=>{
        amiWindow.setContent(createUI());

        var menu = [
            {label: "Settings",items:[{label: "About"}]},
            {label: "File",items:[
                    {label: "Save",action:()=>save()}
                ]}
        ];
        amiWindow.setMenu(menu,true);

        if (host){
            amiBase = host;
        }

        amiWindow.setSize(584,400);
        if (amiWindow.onload) amiWindow.onload(amiWindow);
    }

    let createUI = function(){
        let content = localStorage.getItem("settings");
        // content = '{"mount":[]}';
        try {
            content = JSON.stringify(JSON.parse(content),null,2);
        }catch (e){
            console.error(e);
            content = '{"mount":[]}';
        }

        edit = document.createElement("textarea");
        edit.value = content;
        let container = document.createElement("div");
        container.className = "editor";
        container.appendChild(edit);
        return container;
    }


    async function save(){
        let content = edit.value;
        localStorage.setItem("settings",content);
        console.error("ok - please reload");
    }

    // example


    /*

    {
  "mount": [
    {
      "type": "filesystem",
      "label": "Home",
      "volume": "DH",
      "handler": "laozi",
      "url": "https://www.stef.be/foto/api"
    }
  ]
}
     */

    return me;
}

export default Settings();