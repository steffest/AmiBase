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
        Desktop.createIcon({label: "Google Docs", type:"url",url:'https://docs.google.com/document/d/1F00_QG2_06jTGPv1K67g_1QgiixdfhDyhlQJxVwwrWY/edit'});
        Desktop.createIcon({label: "Google SpreadSheet", type:"url",url:'https://docs.google.com/spreadsheets/d/1JZIeLTLouXFoJ_ZuGywWQHsF0xbPdpBOnaZljzL5SRM/edit'});
        Desktop.createIcon({label: "Piskel", type:"url",url:'https://www.piskelapp.com/p/agxzfnBpc2tlbC1hcHByEwsSBlBpc2tlbBiAgKDrjfv0CAw/edit'});
        //Desktop.createIcon({label: "Quake", type:"url",url:'http://www.quakejs.com/'});
        Desktop.cleanUp();
    };

    return me;
}();