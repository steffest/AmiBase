var Main=function(){
    var me = {};
    var initDone;

    me.init = async function(){
        await System.loadEnvironment();
        await Desktop.loadTheme(User.getTheme());
        Input.init();
        Desktop.init();
        UI.init();

        //var w = Desktop.createWindow("test");
        //w.createIcon({label: "Bassoon", type:"program",url:'plugin:bassoon'});
        //w.createIcon({label: "Test"});
        //w.cleanUp();

        Desktop.loadContent(Settings.initialContent);

        //var i = Desktop.createIcon({label: "Notepad", type:"program",url:'plugin:notepad'});
        //Desktop.createIcon({label: "Bassoon", type:"program",url:'plugin:bassoon'});
        // Desktop.createIcon({label: "UAE", type:"program",url:'frame:uae'});
        //Desktop.createIcon({label: "PostMessage", type:"program",url:'frame:frame'});

        //Desktop.createIcon({label: "TheGrid.mp3", type:"file",url:"content/files/TheGrid.mp3",handler:"mediaplayer"});
        //Desktop.createIcon({label: "Soma.FM", type:"file",url:"https://ice1.somafm.com/secretagent-128-mp3",handler:"mediaplayer"});


        //Desktop.createIcon({label: "Piskel", type:"url",url:'https://www.piskelapp.com/p/agxzfnBpc2tlbC1hcHByEwsSBlBpc2tlbBiAgKDrjfv0CAw/edit'});
        //Desktop.createIcon({label: "Quake", type:"url",url:'http://www.quakejs.com/'});
        Desktop.cleanUp();
        initDone = true;

        //FileSystem.mount("Home","DH0","laozi");
    };

    return me;
}();