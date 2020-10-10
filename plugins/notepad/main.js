var Notepad = 'yep';

var notepad_plugin_init = function(containerWindow){
    console.error(containerWindow);
    var container = containerWindow.getInner();
    container.innerHTML += '<br>Active';

    var textarea = document.createElement("textarea");
    textarea.value = "";
    textarea.style.width = "100%";
    textarea.style.height = "100%";
    container.innerHTML = "";
    container.appendChild(textarea);


    Applications.registerApplicationActions("notepad",{
        "openfile":async function(attachment){
            console.error("notepad open file");

            if (attachment.file){
                console.log("handle binary data");
                var content = String.fromCharCode.apply(null, new Uint8Array(attachment.file.buffer));
                textarea.value = content;
            }else if(attachment.path){
                textarea.value = await FileSystem.readFile(attachment.path);
            }else if(attachment.url){
                console.log("load from url" , attachment.url);
                if (attachment.label) containerWindow.setCaption(attachment.label);
                var content = await FetchService.get(attachment.url);
                textarea.value=content;
            }else{
                console.warn("unknown structure",attachment);
            }
        }
    });

    if (containerWindow.onload) containerWindow.onload(containerWindow);


};