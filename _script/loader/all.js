import scriptLoader from "../util/scriptLoader.js";

(async () => {
    await scriptLoader(
        [[
                '_script/util/dom.js',
                '_script/util/eventBus.js',
                '_script/util/fetchService.js',
                '_script/enum.js',
                '_script/settings.js',
                '_script/window.js'
            ],
            [
                '_script/system.js',
                '_script/filesystem.js',
                '_script/input.js',
                '_script/ui.js',
                '_script/main.js',
                '_script/desktop.js',
                '_script/icon.js',
                '_script/mousepointer.js',
                '_script/mainmenu.js',
                '_script/security.js',
                '_script/user.js',
                '_script/applications.js',
            ]]);


    Main.init();
})();

