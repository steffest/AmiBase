import settings from "./settings.js";
import Security from "./security.js";
import Storage  from "./storage.js";
let User = function(){
    var me = {};

    let userKey = "test";
    Security.setUserPass(userKey);

    me.init = async function(){
        let localSettings = await me.getAmiSettings();
        console.log("localSettings",localSettings);
        if (localSettings){
            for (let key in localSettings){
                settings[key] = localSettings[key];
            }
        }
    }

    me.storeSetting = function(key,value,encrypted){
        if (encrypted){
            Security.encrypt(value).then(function(data){
                Storage.set(key + "_enc",data);
            });
        }else{
            Storage.set(key,value);
        }
    };

    me.getSetting = function(key){
        var value = localStorage.getItem(key);
        if (value && value.indexOf("json:"===0)){
            try{value = JSON.parse(value.substr(5));}catch (e) {}
        }
        return value;
    };

    me.decryptSetting = function(key){
        return new Promise(async function(next){
            let data = await Storage.get(key + "_enc");
            console.error(data);
            if (data && data.encrypted && data.iv){
                Security.decrypt(data.encrypted,data.iv).then(function(data){
                    console.error("ok",data);
                    next(data);
                }).catch(function(e){
                    console.error(e);
                    next({});
                })
            }else{
                next({});
            }
        })
    }

    me.getAmiSettings = async function(){
        let settings = await me.decryptSetting("settings");
        if (!settings) settings = {};
        return settings;
    }

    me.setAmiSettings = function(settings){
        me.storeSetting("settings",settings,true);
    }

    me.getTheme = function(){
        let theme = me.getSetting("theme") || settings.defaultTheme;
        console.error(theme,settings.themes);
        if (settings.themes && settings.themes.length){
            let exists = false;
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