var Security = function(){
    var me = {};

    let iv;
    let salt = "only amiga makes it possible";
    let cryptoKey;

    var registeredWindows=[];

    /*
    Whenever we launch a new program in a frame, we record the url
    When a program (running inside a frame) wants to access AmiBase related features,
    It has to register itself with the exact same url as launched
     */
    var allowedUrls=[];

    me.registerUrl = function(url,_window){
        if (url.indexOf("://")<0){
            var basePath = window.location.href;
            var p = window.location.href.lastIndexOf("/");
            if (p>=0)  basePath =  basePath.substr(0,p+1);
            url = basePath + url;
        }
        console.log("registering url " + url);

        /*let w = registeredWindows.find(function(item){return item.id === _window.id});
        if (w){
            w.urls = w.urls || [];
            w.urls.push(url);
            return;
        }*/

        registeredWindows.unshift({
            id: _window.id,
            url: url,
            window: _window,
            registeredTime: new Date().getTime()
        })
    };

    me.registerWindow = function(url){
       console.log("registering window ", url);
       var w = registeredWindows.find(function(item){return item.url === url});
       if (window){
           return w;
       }else{
           console.error("window for " + url + " not found");
       }
    };

    me.getWindow = function(windowId){
        var w = registeredWindows.find(function(item){return item.id === windowId});
        if (w){
            return w.window;
        }else{
            console.error("window for id " + windowId + " not found");
        }
    };

    me.hasAccess = function(id){

    };

    me.encrypt = async function(text){
        if (!window.crypto || !window.crypto.subtle){
            console.error("crypto not supported");
            return text;
        }

        if (!cryptoKey){
            console.error("user key not ready");
            return text;
        }

        if (typeof text === "object") text = "json:" + JSON.stringify(text);

        let iv = window.crypto.getRandomValues(new Uint8Array(16));
        let encrypted = await window.crypto.subtle.encrypt(
            {
                name: "AES-CBC",
                iv: iv
            },
            cryptoKey,
            new TextEncoder().encode(text)
        );
        return{
            iv: iv,
            encrypted: encrypted
        }
    }

    me.decrypt = async function(text,iv){
        if (!window.crypto || !window.crypto.subtle){
            console.error("crypto not supported");
            return text;
        }

        if (!cryptoKey){
            console.error("user key not ready");
            return text;
        }

        let decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-CBC",
                iv: iv
            },
            cryptoKey,
            text
        );
        let decryptedValue = new TextDecoder().decode(decrypted);
        if (decryptedValue.indexOf("json:")===0){
            try{
                decryptedValue = JSON.parse(decryptedValue.substr(5));
            }catch (e) {}
        }
        return decryptedValue;
    }

    me.setUserPass = function(pass){
        if (!window.crypto || !window.crypto.subtle){
            console.error("crypto not supported");
            return;
        }

        generateKey(pass).then(function(){
            console.log("user key ready");
        });
    }

    me.sha256 = async function(text){
        let buffer = new TextEncoder("utf-8").encode(text);
        let hash = await window.crypto.subtle.digest("SHA-256", buffer);

        // Convert ArrayBuffer to hex string
        let result = '';
        let view = new DataView(hash);
        for (let i = 0; i < hash.byteLength; i += 4) {
            result += ('00000000' + view.getUint32(i).toString(16)).slice(-8);
        }
        return result;
    }

    async function generateKey(pass){
        window.crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(pass),
            {name: "PBKDF2"},
            false,
            ["deriveKey"])
            .then(function(key){
                window.crypto.subtle.deriveKey({
                        "name": "PBKDF2",
                        "salt": new TextEncoder().encode(salt),
                        "iterations": 1000,
                        "hash": "SHA-256"
                    },
                    key,
                    { "name": "AES-CBC", "length": 256},
                    true,
                    [ "encrypt", "decrypt" ])
                    .then(function(derivedKey){
                        cryptoKey = derivedKey;
                    });
            });
    }

    return me;
};

export default Security();