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

        desktop.loadContent(settings.initialContent);

        //var i = Desktop.createIcon({label: "Notepad", type:"program",url:'plugin:notepad'});
        //Desktop.createIcon({label: "Bassoon", type:"program",url:'plugin:bassoon'});
        // Desktop.createIcon({label: "UAE", type:"program",url:'frame:uae'});
        //Desktop.createIcon({label: "PostMessage", type:"program",url:'frame:frame'});

        //Desktop.createIcon({label: "TheGrid.mp3", type:"file",url:"content/files/TheGrid.mp3",handler:"mediaplayer"});
        //Desktop.createIcon({label: "Soma.FM", type:"file",url:"https://ice1.somafm.com/secretagent-128-mp3",handler:"mediaplayer"});


        //Desktop.createIcon({label: "Piskel", type:"url",url:'https://www.piskelapp.com/p/agxzfnBpc2tlbC1hcHByEwsSBlBpc2tlbBiAgKDrjfv0CAw/edit'});
        //Desktop.createIcon({label: "Quake", type:"url",url:'http://www.quakejs.com/'});
        desktop.cleanUp();
        initDone = true;

        //FileSystem.mount("Home","DH0","laozi");
    };

    window.addEventListener("DOMContentLoaded",me.init);

    return me;
}();