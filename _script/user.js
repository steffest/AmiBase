import settings from "./settings.js";
import Security from "./security.js";
import Storage  from "./storage.js";
let User = function(){
    var me = {};

    let userKey = "test";
    Security.setUserPass(userKey);

    me.init = async function(){
        let localSettings = await me.getAmiSettings();
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

    me.getSetting = async function(key,encrypted){
        if (encrypted) key+="_enc";
        let data = await Storage.get(key);

        if (data && data.encrypted && data.iv){
            try{
                data = await Security.decrypt(data.encrypted,data.iv);
            }catch (e) {
                console.error(e);
                data = {};
            }
        }
        return data;
    };

    me.getAmiSettings = async function(){
        let settings = await me.getSetting("settings",true);
        if (!settings) settings = {};
        return settings;
    }

    me.setAmiSettings = function(settings){
        me.storeSetting("settings",settings,true);
    }

    me.getTheme = async function(){
        let theme = await me.getSetting("theme") || settings.defaultTheme;
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