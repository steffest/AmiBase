import system from "./system/system.js";
import desktop from "./ui/desktop.js";
import input from "./input.js";
import ui from "./ui/ui.js";
import settings from "./settings.js";
import user from "./user.js";

var Main=function(){
    var me = {};
    var initDone;

    me.init = async function(){
        await system.loadEnvironment();
        await desktop.loadTheme(user.getTheme());
        input.init();
        desktop.init();
        ui.init();


        if (settings.mount){
            desktop.loadContent(settings.mount);
        }else{
            desktop.loadContent(settings.initialContent);
        }

        desktop.cleanUp();
        initDone = true;

    };

    window.addEventListener("DOMContentLoaded",me.init);

    return me;
}();