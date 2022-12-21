let Hex = ()=>{
    let me = {}

    let hex

    me.init = (amiWindow,amiBase)=>{
        if (amiBase){
            amiBase.registerApplicationActions("hex",{
                "openfile":async file=>{
                    console.error("hex open file");
                    let content = await amiBase.fileSystem.readFile(file,true);
                    renderContent(content);
                    let readOnly = await amiBase.fileSystem.isReadOnly(file);
                }
            });
        }

        if (amiWindow.onload) amiWindow.onload(amiWindow);
    }

    let renderContent = content=>{
        console.log(content);
    }

    return me;
}

export default Hex();