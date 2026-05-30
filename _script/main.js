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

        let hasEnvironment = await system.loadEnvironment();
        if (!hasEnvironment){
            showSplash();
            return;
        }

        await desktop.loadTheme(await user.getTheme());
        input.init();
        desktop.init();
        ui.init();

        await user.init();
        console.log("user",user);
        desktop.loadContent(settings.initialContent,settings.mounts,"desktop:");
        desktop.cleanUp();
        await network.init();
        network.connectFromUrlInvite();
        initDone = true;
    };

    function showSplash(){
        document.body.innerHTML = "";
        document.body.style.margin = "0";
        document.body.style.background = "#fff";
        document.body.style.height = "100vh";
        document.body.style.display = "grid";
        document.body.style.placeItems = "center";

        let splash = document.createElement("div");
        splash.textContent = "Amibase";
        splash.style.color = "#d8d8d8";
        splash.style.fontFamily = "Arial, Helvetica, sans-serif";
        splash.style.fontSize = "72px";
        splash.style.fontWeight = "100";
        splash.style.lineHeight = "1";
        document.body.appendChild(splash);
    }

    window.Main = me;
    window.addEventListener("DOMContentLoaded",me.init);

    return me;
}();
