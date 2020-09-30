var User = function(){
    var me = {};

    me.storeSetting = function(key,value){
        if (typeof value === "object") value = "json:" + JSON.stringify(value);
        localStorage.setItem(key,value);
    };

    me.getSetting = function(key){
        var value = localStorage.getItem(key);
        if (value && value.indexOf("json:"===0)){
            try{value = JSON.parse(value.substr(5));}catch (e) {}
        }
        return value;
    };

    me.getTheme = function(){
        return me.getSetting("theme") || Settings.defaultTheme;
    };


    return me;
}();