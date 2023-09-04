// wrapper for indexedDB
// TODO: fallback to localStorage if indexedDB is not available

let Storage = function(){
    let me = {};
    let db;

    let request = window.indexedDB.open("amibase", 1);
    request.onerror = function(event) {
        console.error("Error opening db",event.target.error.name);
        if (event.target.error.name === "VersionError"){
            console.error("VersionError",event.target.error.name);
            window.indexedDB.deleteDatabase("amibase");
            request = window.indexedDB.open("amibase", 1);
        }
    }
    request.onsuccess = function(event) {
        db = event.target.result;
    }

    request.onupgradeneeded = (event) => {
        let db = event.target.result;
        let settings = db.createObjectStore("settings", { keyPath: "key" });
        let files = db.createObjectStore("files", { keyPath: "path" });
        settings.createIndex("key", "key", { unique: true });
        files.createIndex("path", "path", { unique: true });
    }

    me.get = function(key){
        return new Promise(function(next, reject){
            if (!db) return next();
            let transaction = db.transaction(["settings"]);
            transaction.onerror = (event) => {
                console.error("Transaction error",event.target.error);
            }
            const objectStore = transaction.objectStore("settings");
            const getRequest = objectStore.get(key);
            getRequest.onsuccess = (event) => {
                let result = event.target.result;
                if (result && result.value) result = result.value;
                next(result);
            }
            getRequest.onerror = (event) => {
                console.error("Storage get failed",event.target.error);
                next();
            }
        });
    }

    me.set = function(key,value){
        if (!db) return;
        let transaction = db.transaction(["settings"], "readwrite");
        transaction.onerror = (event) => {
            console.error("Transaction error",event.target.error);
        };

        const objectStore = transaction.objectStore("settings");
        const getRequest = objectStore.get(key);
        getRequest.onsuccess = (event) => {
            const requestUpdate = objectStore.put({ key: key, value: value });
            requestUpdate.onerror = (event) => {
                console.error("Storage update failed",event.target.error);
            };
        }
        getRequest.onerror = (event) => {
            const request = objectStore.add({ key: key, value: value });
            request.onerror = (event) => {
                console.error("Storage add failed",event.target.error);
            }
        }
    }

    return me;

}();

export default Storage;