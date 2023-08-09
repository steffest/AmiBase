import settings from "./settings.js";
let User = function(){
    var me = {};

    me.init = function(){

    }

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

    me.getAmiSettings = function(){
        return me.getSetting("settings") || {};
    }

    me.setAmiSettings = function(settings){
        me.storeSetting("settings",settings);
    }

    me.getTheme = function(){
        var theme = me.getSetting("theme") || settings.defaultTheme;
        if (settings.themes && settings.themes.length){
            var exists = false;
            settings.themes.forEach(function(_theme){
                if (_theme.name === theme) exists = true;
            });
            if (!exists) theme = settings.defaultTheme || settings.themes[0];
        }
        return theme;
    };


    return me;
};

export default User();