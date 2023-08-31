// wrapper for indexedDB
// TODO: fallback to localStorage if indexedDB is not available

let Storage = function(){
    let me = {};
    let db;

    const request = window.indexedDB.open("amibase", 1);
    request.onerror = function(event) {
        console.log("Error opening db");
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

        settings.transaction.oncomplete = function(event) {
            let settingsStore = db.transaction("settings", "readwrite").objectStore("settings");
        }
    }

    me.get = function(key){
        return new Promise(function(next){
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