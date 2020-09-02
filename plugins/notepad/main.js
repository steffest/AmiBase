console.log("from main script file in plugin");
var Notepad = 'yep';

var notepad_plugin_init = function(containerWindow){
    console.error(containerWindow);
    var container = containerWindow.getInner();
    container.innerHTML += '<br>Active';

    var textarea = document.createElement("textarea");
    textarea.value = "Edit me";
    textarea.style.width = "100%";
    textarea.style.height = "100%";
    container.innerHTML = "";
    container.appendChild(textarea);


};