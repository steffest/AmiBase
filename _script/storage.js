let Storage = function(){
    let me = {};
    let db;

    const request = window.indexedDB.open("amibase", 1);
    request.onerror = function(event) {
        console.log("Why didn't you allow my web app to use IndexedDB?!");
    }
    request.onsuccess = function(event) {
        db = event.target.result;
        console.log("db",db);
    }

    request.onupgradeneeded = (event) => {
        let db = event.target.result;
        let settings = db.createObjectStore("settings", { keyPath: "key" });
        let files = db.createObjectStore("files", { keyPath: "path" });
        settings.createIndex("key", "key", { unique: true });
        files.createIndex("path", "path", { unique: true });


        settings.transaction.oncomplete = function(event) {
            let settingsStore = db.transaction("settings", "readwrite").objectStore("settings");
            settingsStore.add({ key: "settings", value: "{test:true}" });
        }
    }

    me.get = function(key){
        return new Promise(function(next){
            console.log("get",key);
            let transaction = db.transaction(["settings"]);
            transaction.onerror = (event) => {
                console.error("Get Error!",event.target.error);
            }
            const objectStore = transaction.objectStore("settings");
            const getRequest = objectStore.get(key);
            getRequest.onsuccess = (event) => {
                let result = event.target.result;
                if (result && result.value) result = result.value;
                console.log("Get successful!",result);
                next(result);
            }
            getRequest.onerror = (event) => {
                console.error("Get failed!",event.target.error);
                next();
            }
        });
    }

    me.set = function(key,value){
        console.log("set",key,value);

        let transaction = db.transaction(["settings"], "readwrite");

        transaction.onerror = (event) => {
           console.error("Error!",event.target.error);
        };

        const objectStore = transaction.objectStore("settings");
        const getRequest = objectStore.get(key);
        getRequest.onsuccess = (event) => {
            const requestUpdate = objectStore.put({ key: key, value: value });
            requestUpdate.onerror = (event) => {
                console.error("Update failed!",event.target.error);
            };
        }
        getRequest.onerror = (event) => {
            console.error("Get failed!",event.target.error);
            const request = objectStore.add({ key: key, value: value });
            request.onerror = (event) => {
                console.error("Add failed!",event.target.error);
            }
        }
    }

    return me;

}();

export default Storage;