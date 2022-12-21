var Amiga = function(){
    var me = {};

    var sae;
    var cfg;
    var inf;

    var initDone;
    var bootDisk;

    me.init = function(model,url){
        console.log("Set Amiga model to " + model);
        initDone = false;
        if (url) bootDisk=url;

        sae = new ScriptedAmigaEmulator();
        inf = sae.getInfo();
        cfg = sae.getConfig();

        loadKickStart("kick13.rom",function(){
            initDone = true;
            if (bootDisk) me.bootDisk(bootDisk);
        });
    }

    me.bootDisk = function(url){
        if (initDone){
            console.log("Booting disk " + url);
            loadDisk(url,function(){
                start();
            });
        }else{
            console.log("Not ready to boot yet, waiting for kickstart");
            bootDisk = url;
        }
    }

    function loadDisk(url,next){
        getBinaryFileAsString(url,function(data){
            if (data){
                floppyInsertFromData(0,data,"boot.adf");
                if (next) next();
            }else{

            }
        });
    }

    function loadKickStart(url,next){
        var rom = url;
        var extended = "";
        //var rom = "aros-rom.bin";
        //var extended = "aros-ext.bin";
        getBinaryFileAsString("plugins/uae/data/" + rom,function(data){
            if (data){
                cfg.memory.rom.name = rom;
                cfg.memory.rom.data = data; /* typeof 'String' or 'Uint8Array' */
                cfg.memory.rom.size = data.length; /* size in bytes */
                cfg.memory.rom.crc32 = crc32(data); /* pre-calculate crc32 for a faster start */
                //setRomName();

                if (extended){
                    getBinaryFileAsString("data/" + rom,function(extdata){
                        if (extdata){
                            cfg.memory.extRom.name = extended;
                            cfg.memory.extRom.data = extdata;
                            cfg.memory.extRom.size = extdata.length;
                            cfg.memory.extRom.crc32 = crc32(extdata);

                            extRomInfo = new SAEO_RomInfo();
                            var err = sae.getRomInfo(extRomInfo, cfg.memory.extRom);
                            if (err == SAEE_None) {
                                extRomEncrypted = extRomInfo.cloanto;
                                if (!(extRomInfo.type & SAEC_RomType_ALL_EXT))
                                    alert("A 'Extended'-ROM is required, but you selected a/an '"+getRomType(extRomInfo)+"'-ROM.");
                            } else {
                                extRomInfo = null;
                                if (err != SAEE_Memory_RomUnknown) {
                                    if (err == SAEE_Memory_RomKey || err == SAEE_Memory_RomDecode) {
                                        extRomEncrypted = true;
                                        //setKeyName();
                                        if (err == SAEE_Memory_RomDecode)
                                            alert(saee2text(err));
                                    }
                                }
                            }
                            //setExtName();
                            if (next) next();
                        }
                    });
                }else{
                    if (next) next();
                }


            }
        });
    }

    function start() {
        if (setConfig()) {
            var err = sae.start();
            if (err == SAEE_None) {
                /* ... */
            } else
                alert(saee2text(err));
        }
    }

    function setConfig() {
        var model = SAEC_Model_A500;
        var modelSubConfig = 0;
        sae.setModel(model, modelSubConfig);

        cfg.chipset.ntsc = false;
        cfg.memory.z2FastSize = 2 << 20; // Give 2mb zorro2 fast-ram

        /* Do we have rom-data? */
        if (cfg.memory.rom.size == 0) {
            alert(saee2text(SAEE_Memory_NoKickstartRom));
            return false;
        }

        cfg.floppy.speed = SAEC_Config_Floppy_Speed_Turbo; /* Set speed to turbo. This is not always compatible */

        cfg.video.id = "myVideo"; /* Set the id-name of the desired output-div or output-canvas */

        cfg.video.hresolution = SAEC_Config_Video_HResolution_HiRes;
        cfg.video.vresolution = SAEC_Config_Video_VResolution_Double;
        cfg.video.size_win.width = SAEC_Video_DEF_AMIGA_WIDTH << 1; /* 720 */
        cfg.video.size_win.height = SAEC_Video_DEF_AMIGA_HEIGHT << 1; /* 568 */

        cfg.serial.enabled = false;
        cfg.parallel.enabled = false;

        cfg.debug.level = SAEC_Config_Debug_Level_Log;

        return true;
    }

    function floppyInsertFromData(n,data,name) {
        var file = cfg.floppy.drive[n].file;
        file.name = name; /* filename */
        file.data = data; /* typeof 'String' or 'Uint8Array' */
        file.size = data.length; /* size in bytes */
        file.crc32 = crc32(data); /* pre-calculate crc32 for a faster start */
    }

    // Apparently SUAE expects binaries a String? weird. -> TODO investigate and change to arraybuffer
    function getBinaryFileAsString(url,next){
        var req = new XMLHttpRequest();
        req.open("GET", url);
        req.overrideMimeType("text\/plain; charset=x-user-defined"); /* we want binary data */
        req.onload = function (event) {
            var content = req.responseText;
            if (content) {
                if (next) next(content);
            } else {
                console.error("unable to load", url);
                if (next) next(false);
            }
        };
        req.send(null);
    }

    const crc32Table = (function() {
        var table = new Uint32Array(256);
        var n, c, k;

        for (n = 0; n < 256; n++) {
            c = n;
            for (k = 0; k < 8; k++)
                c = ((c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)) >>> 0;
            table[n] = c;
        }
        return table;
    })();

    function crc32(data) {
        var length = data.length;
        var offset = 0;
        var crc = 0xffffffff;

        while (length-- > 0)
            crc = crc32Table[(crc ^ data.charCodeAt(offset++)) & 0xff] ^ (crc >>> 8);

        return (crc ^ 0xffffffff) >>> 0;
    }



    return me;
}();