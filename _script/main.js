var Main=function(){
    var me = {};

    me.init = function(){
        Input.init();
        Desktop.init();
        UI.init();

        var w = Desktop.createWindow("test");
        w.createIcon({label: "Bassoon", type:"program",url:'plugin:bassoon'});
        w.createIcon({label: "Test"});
        w.cleanUp();



        var i = Desktop.createIcon({label: "Notepad", type:"program",url:'plugin:notepad'});
        Desktop.createIcon({label: "Bassoon", type:"program",url:'plugin:bassoon'});
        Desktop.createIcon({label: "UAE", type:"program",url:'frame:uae'});
        Desktop.createIcon({label: "PostMessage", type:"program",url:'frame:frame'});
        Desktop.createIcon({label: "Google Docs", type:"url",url:'https://docs.google.com/document/d/1B6sE_GXjK89-NIvVIOURpYvhk3oqN4ppYkn6PUX-ZGE/edit'});
        //Desktop.createIcon({label: "Quake", type:"url",url:'http://www.quakejs.com/'});
        Desktop.cleanUp();
    };

    return me;
}();