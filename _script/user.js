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
        var theme = me.getSetting("theme") || Settings.defaultTheme;
        if (Settings.themes && Settings.themes.length){
            var exists = false;
            Settings.themes.forEach(function(_theme){
                if (_theme.name === theme) exists = true;
            });
            if (!exists) theme = Settings.defaultTheme || Settings.themes[0];
        }
        return theme;
    };


    return me;
}();