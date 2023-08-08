import system from "../system.js";

/*
    This is the in-memory filesystem where e.g. uploaded files are stored.
    Normally all binary content should be already present in the file object
 */
let RAM = ()=>{
    let me = {}
    let items = [];

    me.readFile = async function(file,binary){
        if (!file.binary){
            // file was passed as filename only
            file = items.find(a=>a.path === file.path);
        }
        if (binary){
            return file.binary;
        }else{
            return file.binary.toString();
        }
    }

    me.addFile = function(file){
        items.push(file);
    }

    me.getDirectory = async function(folder,_next){
        var path = folder.path;

        return new Promise((resolve,reject) => {
            var next = _next || resolve;
            var directories = [];
            var files = [];
            //data.result.directories.forEach(dir=>{
            //    directories.push({name:dir})
            //});
            items.forEach(file=>{
                files.push({name:file.name});
            });

            next({
                directories: directories,
                files:files
            });
        });
    };

    return me;
}

export default RAM();