let DosBox = ()=>{
    let me = {
        name:"dosbox",
    };

    me.init = function(containerWindow,context){
        console.log("dos init");
        return new Promise((next)=>{
            context.system.loadScript("plugins/dos/js-dos.js").then(()=>{
                console.log("js-dos loaded");

                Dos(document.getElementById("jsdos"), {
                    wdosboxUrl: "plugins/dos/wdosbox.js",
                    cycles: 1000,
                    autolock: false,
                }).ready(function (fs, main) {
                    fs.extract("plugins/dos/raydem.zip").then(function () {
                        main(["-c", "raydem.bat"]).then(function (ci) {
                            window.ci = ci;
                        });
                    });
                });

            });
            next();
        });
    }

    return me;
}

export default DosBox;
