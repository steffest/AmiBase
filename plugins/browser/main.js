var browser_plugin_init = function(containerWindow){
    var container = containerWindow.getInner();
    
    var input = container.querySelector("#browser_url");
    var frame = container.querySelector("#browser_frame");
    
    input.onkeypress = function(e){
        if (e.code === "Enter" || e.keyCode === 13){
            var url = input.value;
            frame.src = url;
        }
    }
    
    if (containerWindow.onload) containerWindow.onload(containerWindow);
};