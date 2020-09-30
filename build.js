// this is optional - only used to concat js.
// I bloody hate build tools ...

// expects uglify to be installed globally
// npm install uglify-es -g

var fs = require("fs");
const { exec } = require("child_process");

var scripts = [
        '_script/util/dom.js',
        '_script/util/eventBus.js',
        '_script/util/fetchService.js',
        '_script/enum.js',
        '_script/settings.js',
        '_script/window.js',
        '_script/system.js',
        '_script/input.js',
        '_script/ui.js',
        '_script/main.js',
        '_script/desktop.js',
        '_script/icon.js',
        '_script/mousepointer.js',
        '_script/mainmenu.js',
        '_script/security.js',
        '_script/user.js',
        '_script/applications.js'
];

var output = scripts.map((f)=>{
    return fs.readFileSync(f).toString();
}).join(';');

fs.writeFileSync('build/bundle.js', output);

exec("uglifyjs build/bundle.js -c -m -o build/min.js", (error, stdout, stderr) => {
        if (error) {
                console.log(`error: ${error.message}`);
                return;
        }
        if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
        }
        console.log(`stdout: ${stdout}`);
});