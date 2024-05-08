import system from "./system/system.js";
import desktop from "./ui/desktop.js";
import input from "./input.js";
import ui from "./ui/ui.js";
import settings from "./settings.js";
import user from "./user.js";
import network from "./system/network.js";

var Main=function(){
    var me = {};
    var initDone;

    if (window.location.href.indexOf("amibase")>=0 && window.location.protocol==="http:"){
        window.location.href = window.location.href.replace("http:","https:");
    }

    me.init = async function(){

        await system.loadEnvironment();
        await desktop.loadTheme(await user.getTheme());
        input.init();
        desktop.init();
        ui.init();

        await user.init();
        console.log("user",user);
        desktop.loadContent(settings.initialContent,settings.mounts,"desktop:");
        desktop.cleanUp();
        network.init();
        initDone = true;


    };

    window.addEventListener("DOMContentLoaded",me.init);

    return me;
}();