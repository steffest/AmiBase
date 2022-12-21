var dos_plugin_init = function(app){
    console.log("dos here");

    //Applications.registerApplicationActions("dos",{
    //    "openfile": handleFile,
    //    "dropfile": handleDropFile
    //});

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

    if (app.onload) app.onload(app);

};