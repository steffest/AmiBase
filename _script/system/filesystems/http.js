import system from "../system.js";
import fetchService from "../../util/fetchService.js";

let Http = ()=>{
    let me = {}

    me.readFile = async function(file,binary){
        let path = file.path;
        if (binary){
            let BinaryStream = await system.loadLibrary("binaryStream.js");
            let content = await fetchService.arrayBuffer(path);
            return BinaryStream(content,true);
        }else{
            return fetchService.get(path);
        }
    }

    return me;
}

export default Http();