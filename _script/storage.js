// wrapper for indexedDB
// TODO: fallback to localStorage if indexedDB is not available

let Storage = function(){
    let me = {};

    me.get = function(key){
        return new Promise(async (next)=>{
            let db = await openDb();
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
        openDb().then(db=>{
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
        })
    }

    me.setObject = function(key,value){
        openDb().then(db=>{
            let transaction = db.transaction(["files"], "readwrite");
            transaction.onerror = (event) => {
                console.error("Transaction error",event.target.error);
            };

            const objectStore = transaction.objectStore("files");

            // put the object in the object store
            const request = objectStore.put({ path: key, value: value });
            request.onerror = (event) => {
                console.error("Storage setObject failed",event.target.error);
            }
        })
    }

    me.getObject = function(key){
        return new Promise(async (next)=>{
            let db = await openDb();
            let transaction = db.transaction(["files"]);
            transaction.onerror = (event) => {
                console.error("Transaction error",event.target.error);
            }
            const objectStore = transaction.objectStore("files");
            const getRequest = objectStore.get(key);
            getRequest.onsuccess = (event) => {
                let result = event.target.result;
                if (result && result.value) result = result.value;
                next(result);
            }
            getRequest.onerror = (event) => {
                console.error("Storage getObject failed",event.target.error);
                next();
            }
        });
    }

    me.removeObject = function(key){
        openDb().then(db=>{
            let transaction = db.transaction(["files"], "readwrite");
            transaction.onerror = (event) => {
                console.error("Transaction error",event.target.error);
            };

            const objectStore = transaction.objectStore("files");
            const request = objectStore.delete(key);
            request.onerror = (event) => {
                console.error("Storage removeObject failed",event.target.error);
            }
        })
    }

    function openDb(){
        return new Promise(function(next){
            let request = window.indexedDB.open("amibase", 1);
            request.onerror = function(event) {
                console.error("Error opening db",event.target.error.name);
                if (event.target.error.name === "VersionError"){
                    console.error("VersionError",event.target.error.name);
                    window.indexedDB.deleteDatabase("amibase");
                    request = window.indexedDB.open("amibase", 1);
                }else{
                    next(undefined);
                }
            }
            request.onsuccess = function(event) {
                next(event.target.result);
            }

            request.onupgradeneeded = (event) => {
                let db = event.target.result;
                let settings = db.createObjectStore("settings", { keyPath: "key" });
                let files = db.createObjectStore("files", { keyPath: "path" });
                settings.createIndex("key", "key", { unique: true });
                files.createIndex("path", "path", { unique: true });
            }
        });
    }

    return me;

}();

export default Storage;