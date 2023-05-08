var monaco_plugin_init = function(app){
    console.error("monaco here",app);

    window.app = app;

    Applications.registerApplicationActions("monaco",{
        "openfile": handleFile
    });

    function handleFile(attachment){
        console.log("monaco open file");
        console.log(attachment);
    }

    function openFile(){
        console.log("monaco open file");
        Applications.amiBridge().system.requestFile().then(function(file){
            console.log("file",file);
            Applications.amiBridge().fileSystem.readFile(file.path).then(function(file){
                console.log("file",file);
                window.monaco.setValue(file);
            });
        });
    }


    app.setSize(730,600);

    app.setMenu([
        {label: "Monaco Editor",items:[{label: "about"}]},
        {label: "File",items:[
                {label: "Open" , action:openFile}
            ]},
    ],true);



    app.onClose = function(){

    }

    if (app.onload) app.onload(app);

    let inner = app.getInner();
    let container = document.createElement("div");
    container.style.width = "100%";
    container.style.height = "100%";
    inner.innerHTML = "";
    inner.appendChild(container);

    require.config({ paths: { vs: './plugins/monaco/node_modules/monaco-editor/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        monaco.editor.setTheme('vs-dark');
        var editor = monaco.editor.create(container, {
            value: ['function x() {', '\tconsole.log("Hello world!");', '}'].join('\n'),
            language: 'javascript',
            automaticLayout: true
        });

        window.monaco = editor;
    });



};