import scriptLoader from "../util/scriptLoader.js";

var version = "?20220509";
(async () => {
    await scriptLoader(
        [[
                '_script/util/dom.js' + version,
                '_script/util/eventBus.js' + version,
                '_script/util/fetchService.js' + version,
                '_script/enum.js' + version,
                '_script/settings.js' + version,
                '_script/ui/window.js' + version
            ],
            [
                '_script/system/system.js' + version,
                '_script/system/filesystem.js' + version,
                '_script/system/file.js' + version,
                '_script/system/folder.js' + version,
                '_script/system/drive.js' + version,
                '_script/input.js' + version,
                '_script/ui/ui.js' + version,
                '_script/main.js' + version,
                '_script/ui/desktop.js' + version,
                '_script/ui/icon.js' + version,
                '_script/ui/mousepointer.js' + version,
                '_script/ui/mainmenu.js' + version,
                '_script/ui/popupMenu.js' + version,
                '_script/security.js' + version,
                '_script/user.js' + version,
                '_script/applications.js' + version,
            ]]);


    Main.init();
})();

