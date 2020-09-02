var Main=function(){
    var me = {};

    me.init = function(){
        Input.init();
        Desktop.init();
        UI.init();

        var w = Desktop.createWindow("test");
        var i = Desktop.createIcon({label: "Notepad", type:"program",url:'plugin:notepad'});
        Desktop.createIcon({label: "Bassoon", type:"program",url:'plugin:bassoon'});
        Desktop.createIcon({label: "UAE", type:"program",url:'frame:uae'});
        Desktop.createIcon({label: "PostMessage", type:"program",url:'frame:frame'});
        //Desktop.createIcon({label: "Quake", type:"url",url:'http://www.quakejs.com/'});
        Desktop.cleanUp();
    };

    return me;
}();