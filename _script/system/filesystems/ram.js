import system from "../system.js";

/*
    This is the in-memory filesystem where e.g. uploaded files are stored.
    Normally all binery content should be already present in the file object
 */
let RAM = ()=>{
    let me = {}

    me.readFile = async function(file,binary){
        if (binary){
            return file.binary.buffer;
        }else{
            return file.binary.toString();
        }
    }

    return me;
}

export default RAM();