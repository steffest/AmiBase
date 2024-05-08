import $ from "../../_script/util/dom.js";
import system from "../../_script/system/system.js";
import Security from "../../_script/security.js";
import Input from "../../_script/input.js";
import Network from "../../_script/system/network.js";
let Arcade = ()=>{
    let me = {
        name:"arcade",
        version:"0.0.1"
    };

    let amiBase = {};
    let amiWindow;
    let contentBaseUrl = "https://www.amibase.com/plugins/arcade/content/";
    let iFrame;
    let screen;
    let button,button2,button3,button4;
    let ball;
    let keyState = {};
    let selectedGame = 0;
    let list,details,title,description,mainimage;


    let KEY = {
        SPACE:{key: " ", code: "Space", keyCode: 32},
        LEFT:{key: "ArrowLeft", code: "ArrowLeft", keyCode: 37},
        RIGHT:{key: "ArrowRight", code: "ArrowRight", keyCode: 39},
        DOWN:{key: "ArrowDown", code: "ArrowDown", keyCode: 40},
        UP:{key: "ArrowUp", code: "ArrowUp", keyCode: 38},
        SHIFT:{key: "Shift", code: "ShiftRight", keyCode: 16},
        ALT:{key: "Alt", code: "AltRight", keyCode: 18},
        ENTER:{key: "Enter", code: "Enter", keyCode: 13},
        A:{key: "a", code: "KeyA", keyCode: 65},
        D:{key: "d", code: "KeyD", keyCode: 68},
        E:{key: "e", code: "KeyE", keyCode: 69},
        V:{key: "v", code: "KeyV", keyCode: 86},
        X:{key: "x", code: "KeyX", keyCode: 88},
        Z:{key: "z", code: "KeyZ", keyCode: 90},

    }

    let disks = [
        {type: "amiga500", title: "Super Cars 2", url: "amiga/SuperCarsII_Disk1.adf", icon: "amiga/supercars2.png"},
        {type: "amiga500", title: "Scorpio", disk: "amiga/Scorpio.adf", icon: "amiga/scorpio.png"},
        {type: "amiga500", title: "Turrican II", disk: "amiga/TurricanII-a.adf", icon: "amiga/turricanII.png"},
        {type: "dos", title: "Pacman", url:"dos/pacman.zip", command:"PAC-MAN.EXE", icon: "dos/pacman.png", actionKey: KEY.SPACE},
        {type: "amiga500", title: "BattleSquadron", disk: "amiga/BattleSquadron.adf", icon: "amiga/battlesquadron.jpg"},
        {type: "dos", title: "Jazz Jackrabbit", url:"dos/Jazz Jackrabbit (1994)(Epic Megagames Inc).zip", command:"Jazz.exe", icon: "dos/jazz-jackrabbit.jpg", actionKey: KEY.SPACE, actionKey2: KEY.ALT, actionKey3: KEY.ALT},
        {type: "dos", title: "Jungle Book", url:"dos/Jungle Book.zip", command:"jungle.exe", icon: "dos/junglebook.png", actionKey: KEY.SPACE},
        {type: "n64", title: "Mario Kart 64", url:"https://amibase.com/apps/n64/MarioKart64.z64", icon: "n64/mariokart.png", actionKey: KEY.D,actionKey2: KEY.A,actionKey3: KEY.E,actionKey4: KEY.ENTER},
        {type: "snes", title: "Turtles 4", url:"https://amibase.com/apps/snes/Teenage Mutant Ninja Turtles 4 - Turtles in Time (U)(4858).smc", icon: "snes/turtles.png", actionKey: KEY.ENTER},
        {type: "arcade", title: "Robocop", url:"https://amibase.com/apps/mame/robocop.zip", icon: "mame/robocop.png", actionKey: KEY.X,actionKey2: KEY.ENTER,actionKey3: KEY.Z,actionKey4: KEY.V},
    ]
    let actionKey = KEY.SHIFT;
    let actionKey2 = KEY.ALT;
    let actionKey3 = KEY.ENTER;
    let actionKey4 = KEY.SPACE;



    me.init = function(containerWindow,context){
        return new Promise((next)=>{
            amiWindow = containerWindow;
            if (context) amiBase = context;
            setupUI();
            GamePad.init();
            Input.registerKeyHandler(amiWindow.id,keyHandler);
            amiWindow.onClose = me.onClose;
            next();

            Network.register("key",(message)=>{
                let key = message.key;
                let down = message.down;
                let action = down?sendKeyDown:sendKeyUp;
                if (key === "left") {
                    key="ArrowLeft";
                    action(KEY.LEFT);
                }
                if (key === "right"){
                    key="ArrowRight";
                    action(KEY.RIGHT);
                }
                if (key === "up"){
                    key="ArrowUp";
                    action(KEY.UP);
                }
                if (key === "down"){
                    key="ArrowDown";
                    action(KEY.DOWN);
                }
                keyHandler({key:key},down);
            })
        });
    }

    me.onClose = function(){
        Input.releaseKeyHandler(amiWindow.id);
    }

    me.relay = function(message){
        //console.error("relay",message);

        if (ball){
            if (!ball.classList.contains("active")){
                let x = 0;
                let y = 0;
                if (message.key === "ArrowLeft") keyState.left = message.down;
                if (message.key === "ArrowRight") keyState.right = message.down;
                if (message.key === "ArrowUp") keyState.up = message.down;
                if (message.key === "ArrowDown") keyState.down = message.down;

                if (keyState.left) x -= 16;
                if (keyState.right) x += 16;
                if (keyState.up) y -= 12;
                if (keyState.down) y += 20;

                ball.style.transform = "translate(" + x + "px," + y + "px)";
            }
        }

        if (message.key === "Shift" || message.code === "Space"){
            if (button) button.classList.toggle("down",message.down);
        }

    }

    function keyHandler(key,state){
        if (key.key === "ArrowLeft") keyState.left = state;
        if (key.key === "ArrowRight") keyState.right = state;
        if (key.key === "ArrowUp"){
            if (!iFrame && state && !keyState.up) selectGame(-1);
            keyState.up = state;

        }
        if (key.key === "ArrowDown"){
            if (!iFrame && state && !keyState.down) selectGame(1);
            keyState.down = state;
        }

        if (key.key === "Enter" || key.code === "Space"){
            if (button) button.classList.toggle("down",state);
            if (!iFrame && state) launchInternal(disks[selectedGame]);
        }

        let x = 0;
        let y = 0;
        if (keyState.left) x -= 16;
        if (keyState.right) x += 16;
        if (keyState.up) y -= 12;
        if (keyState.down) y += 20;


        if (!ball.classList.contains("active")){
            ball.style.transform = "translate(" + x + "px," + y + "px)";
        }
    }


    function setupUI(){
        amiWindow.removeBorder();
        amiWindow.setSize(609,609);
        amiWindow.setMinSize(420,460);


        let sizer = amiWindow.resizeHandle;
        sizer.classList.add("preventdefaultdrag","handle","custom");
        let sizerStyle = {
            display: "block",
            right: "90px",
            bottom: "62px",
            'border-width': "16px"
        }
        Object.assign(sizer.style,sizerStyle);

        let container = amiWindow.getInner();
        container.innerHTML = "";

        let main = $(".arcade",
            {parent: container,style:{opacity:0}},
            $(".slice.topleft",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_01.png)"}}),
            $(".slice.top",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_02.png)"}},$(".flynn",{style:{backgroundImage:"url(plugins/arcade/_img/flynn.png)"}})),
            $(".slice.topright",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_03.png)"}},
                $(".squarebutton.close.preventdefaultdrag",{style:{backgroundImage:"url(plugins/arcade/_img/close.png)"},onClick:()=>amiWindow.close()}),
                $(".squarebutton.max.preventdefaultdrag",{style:{backgroundImage:"url(plugins/arcade/_img/maximize.png)"},onClick:amiWindow.maximize}),
                $(".squarebutton.fullscreen.preventdefaultdrag",{style:{backgroundImage:"url(plugins/arcade/_img/full.png)"},onClick:()=>{
                        if (iFrame){
                            iFrame.requestFullscreen();
                        }
                    }}),
                ),
            $(".slice.left",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_04.png)"}}),
            screen = $(".slice.center",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_05.png)"}}),
            $(".slice.right",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_06.png)"}}),
            $(".slice.bottomleft",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_07.png)"}}),
            $(".slice.bottom",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_08.png)"}},

                button = $(".arcadebutton.preventdefaultdrag",{
                    onDown:()=>{
                        button.classList.add("down");
                        sendKeyDown(actionKey);
                    },
                    onUp:()=>{
                        button.classList.remove("down");
                        sendKeyUp(actionKey);
                    },
                    style:{backgroundImage:"url(plugins/arcade/_img/button.png)"}
                }),

                button2 = $(".arcadebutton.preventdefaultdrag.button2",{
                    onDown:()=>{
                        button2.classList.add("down");
                        sendKeyDown(actionKey2);
                    },
                    onUp:()=>{
                        button2.classList.remove("down");
                        sendKeyUp(actionKey2);
                    },
                    style:{backgroundImage:"url(plugins/arcade/_img/button.png)"}
                }),

                button3 = $(".arcadebutton.preventdefaultdrag.button3",{
                    onDown:()=>{
                        button3.classList.add("down");
                        sendKeyDown(actionKey3);
                    },
                    onUp:()=>{
                        button3.classList.remove("down");
                        sendKeyUp(actionKey3);
                    },
                    style:{backgroundImage:"url(plugins/arcade/_img/button.png)"}
                }),

                button4 = $(".arcadebutton.preventdefaultdrag.button4",{
                    onDown:()=>{
                        button4.classList.add("down");
                        sendKeyDown(actionKey4);
                    },
                    onUp:()=>{
                        button4.classList.remove("down");
                        sendKeyUp(actionKey4);
                    },
                    style:{backgroundImage:"url(plugins/arcade/_img/button.png)"}
                }),

                $(".arcadebase",{
                    style:{backgroundImage:"url(plugins/arcade/_img/joystick_base.png)"}
                }),


                ball = $(".arcadeball.preventdefaultdrag",{
                    style:{backgroundImage:"url(plugins/arcade/_img/joystick_ball.png)"},
                    onDrag: (e)=>{
                        ball.classList.add("active");
                        let x = e.deltaX;
                        let y = e.deltaY;
                        if (x > 16) x = 16;
                        if (x < -16) x = -16;
                        if (y > 20) y = 20;
                        if (y < -12) y = -12;

                        if (x<-12){
                            if (!keyState.left) sendKeyDown(KEY.LEFT);
                            keyState.left = true;
                        }

                        if (x>12){
                            if (!keyState.right) sendKeyDown(KEY.RIGHT);
                            keyState.right = true;
                        }

                        if (x>=-12 && x<=12){
                            if (keyState.left) sendKeyUp(KEY.LEFT);
                            if (keyState.right) sendKeyUp(KEY.RIGHT);
                            keyState.left = false;
                            keyState.right = false;
                        }

                        if (y<-10){
                            if (!keyState.up){
                                sendKeyDown(KEY.UP);
                                if (!iFrame) selectGame(-1);
                            }
                            keyState.up = true;
                        }
                        if (y>12){
                            if (!keyState.down){
                                sendKeyDown(KEY.DOWN);
                                if (!iFrame) selectGame(1);
                            }
                            keyState.down = true;
                        }
                        if (y>=-10 && y<=12){
                            if (keyState.up) sendKeyUp(KEY.UP);
                            if (keyState.down) sendKeyUp(KEY.DOWN);
                            keyState.up = false;
                            keyState.down = false;
                        }

                        ball.style.transform = "translate(" + x + "px," + y + "px)";
                    },
                    onUp: ()=>{
                        ball.classList.remove("active");
                        ball.style.transform = "translate(0,0)";
                    }
                    }),

                ),
            $(".slice.bottomright",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_09.png)"}}),
        )




        buildGameList();


        setTimeout(()=>{
            main.style.opacity = 1;
            // reAttach Sizer
            amiWindow.element.appendChild(sizer);
        },20);


    }

    function buildGameList(){
        screen.innerHTML = "";

        let gamelist = $(".gamelist.full"
            ,details = $(".details.full",
                mainimage=$(".mainimage.full"),
                $(".overlay.full"),
                title=$(".title"),
                description=$(".description"))
            ,$(".backround")
            ,list = $(".list.preventdefaultdrag",{style:{backgroundImage:"url(plugins/arcade/_img/list-back.png)"}}),
            $(".screenoverlay.full",{style:{backgroundImage:"url(plugins/arcade/_img/screen.png)"}})
        );
        screen.appendChild(gamelist);


        disks.forEach((disk,index)=>{
            let item = $(".arcadeitem.preventdefaultdrag",{
                style: {
                    backgroundImage: "url(" + contentBaseUrl + disk.icon + ")",
                    top: (20 + index * 70) + "px"
                },
                onDown: ()=>launchInternal(disk)
            },$("label",disk.title));
            list.appendChild(item);
        });

        list.appendChild($(".filler",{
            style:{
                position: "absolute",
                top: (20 + disks.length * 70) + "px",
                height: "70px",
                width: "100%",
            }}));

        selectGame(0);
    }

    function selectGame(dir){
        selectedGame += dir;
        if (selectedGame < 0) selectedGame = disks.length-1;
        if (selectedGame >= disks.length) selectedGame = 0;
        let items = document.querySelectorAll(".arcadeitem");
        items.forEach((item,i)=>{
            item.classList.toggle("selected",i===selectedGame);
        });
        let selected = items[selectedGame];
        if (selected){
            let list = document.querySelector(".list");
            list.scrollTop = (selectedGame * 70) - list.clientHeight/2 + 35;
        }
        showDetails();
    }

    function showDetails(){
        let game = disks[selectedGame];
        title.innerHTML = game.title;
        description.innerHTML = game.type || "";
        mainimage.classList.add("loading");
        mainimage.style.backgroundImage = "url(" + contentBaseUrl + game.icon + ")";
        setTimeout(()=>{
            mainimage.classList.remove("loading");
        },50);

    }

    function launch(game){
        console.error("launch");
        if (game.type === "dos"){
            system.launchProgram("plugin:dos").then(w=>{
                w.sendMessage("openFile",{url: game.url, action:game.command});
            })
        }else{
            system.launchProgram("plugin:vamiga").then(w=>{
                w.sendMessage("openFile",{url: contentBaseUrl + game.disk});
            })
        }
    }

    function launchInternal(game){
        screen.innerHTML = "";
        let url = "";
        if (game.type === "dos"){
            url = "https://amibase.com/apps/dos2/";
        }
        if (game.type === "n64"){
            url = "https://amibase.com/apps/n64/";
        }
        if (game.type === "snes"){
            url = "https://amibase.com/apps/snes/";
        }
        if (game.type === "arcade"){
            url = "https://amibase.com/apps/mame/";
        }
        if (game.type === "amiga500"){
            //url = "https://www.amibase.com/apps/vAmigaWeb/";
            url = "https://www.stef.be/amiga/ScriptedAmigaEmulator/dev.html";
            game.url = contentBaseUrl + game.disk;
        }
        actionKey = game.actionKey || KEY.SHIFT;
        actionKey2 = game.actionKey2 || KEY.ALT;
        actionKey3 = game.actionKey3 || KEY.ENTER;
        actionKey4 = game.actionKey4 || KEY.SPACE;

        if (url){
            let gameUrl = game.url;
            if (gameUrl.indexOf("://")===-1) gameUrl = contentBaseUrl + gameUrl;
            url += "?url=" + encodeURIComponent(gameUrl);
            url += "&command=" + encodeURIComponent(game.command);
            url += "&window=" + amiWindow.id;

            // registerURL so we receive the messages from the iframe
            Security.registerUrl(url,amiWindow);

            if (!iFrame){
                iFrame = $("iframe",{src:url,style:{width:"100%",height:"100%"}});
                screen.appendChild(iFrame);
                Input.setKeyBoardRelayTarget(iFrame.contentWindow);
            }
        }
    }

    function sendKeyDown(key){
        key.down = true;
        key.command = "key";
        if (iFrame) iFrame.contentWindow.postMessage(key,"*");
    }

    function sendKeyUp(key){
        key.down = false;
        key.command = "key";
        if (iFrame) iFrame.contentWindow.postMessage(key,"*");
    }


    var GamePad = function(){
        var me = {};
        var hasGamepad = false;
        var logged = false;
        var gamepadElm;
        var isPolling = false;

        var keyLeft = 37;
        var keyUp = 38;
        var keyRight = 39;
        var keyDown = 40;
        var keyAction1 = 17;
        var keyAction2 = 18;
        var keyAction3 = 19;
        var keyAction4 = 20;
        var keyEscape = 27;
        var threshold = 0.6;

        window.gamePadState = window.gamePadState  || {};

        me.init = function(){
            if (navigator.getGamepads){
                hasGamepad = true;
                gamepadElm = document.getElementById("gamepad");
                if (gamepadElm) gamepadElm.innerHTML = '<br>Your browser supports <span>gamepads</span> - connect one to play!';
                console.log("GamePad API supported");
            }else{
                console.error("GamePad API not supported")
            }
        };

        me.getStatus = function(){
            if (hasGamepad){
                var gamepad = navigator.getGamepads()[0];
                if(gamepad){
                    if (!logged){
                        logged = true;
                        if (gamepadElm) gamepadElm.innerHTML = '<br><span>Gamepad connected: ' +  gamepad.id + '</span>';
                    }
                    var axes = gamepad.axes;
                    var buttons = gamepad.buttons;

                    function isPressed(index){
                        return (buttons[index] && buttons[index].pressed)
                    }

                    window.gamePadState[keyLeft] = (axes[0] <= -threshold || axes[2] <= -threshold || isPressed(14) ) ? 1 : 0;
                    window.gamePadState[keyUp] = (axes[1] <= -threshold || axes[5] <= -threshold || isPressed(12)) ? 1 : 0;
                    window.gamePadState[keyRight] = (axes[0] >=  threshold || axes[2] >= threshold || isPressed(15)) ? 1 : 0;
                    window.gamePadState[keyDown] = (axes[1] >= threshold || axes[5] >= threshold || isPressed(13)) ? 1 : 0;

                    window.gamePadState[keyAction1] = isPressed(0)  ||  isPressed(4) ||  isPressed(6);
                    window.gamePadState[keyAction2] = isPressed(1);
                    window.gamePadState[keyAction3] = isPressed(2);
                    window.gamePadState[keyAction4] = isPressed(3);
                    window.gamePadState[keyEscape] = isPressed(5) || isPressed(7);
                }
            }
        };

        me.startPolling = function(){
            if (isPolling) return;
            if (hasGamepad){
                requestAnimationFrame(updateStatus);
            }
        }

        function updateStatus(){
            let prevStatus = Object.assign({},window.gamePadState);


            me.getStatus();
            let x = 0;
            let y = 0;


            if (prevStatus[keyLeft] !== window.gamePadState[keyLeft]){
                if (window.gamePadState[keyLeft]) {
                    sendKeyDown(KEY.LEFT);
                }else{
                    sendKeyUp(KEY.LEFT);
                }
            }
            if (prevStatus[keyRight] !== window.gamePadState[keyRight]){
                if (window.gamePadState[keyRight]) {
                    sendKeyDown(KEY.RIGHT);
                }else{
                    sendKeyUp(KEY.RIGHT);
                }
            }

            if (prevStatus[keyUp] !== window.gamePadState[keyUp]){
                if (window.gamePadState[keyUp]) {
                    sendKeyDown(KEY.UP);
                    if (!iFrame) selectGame(-1);
                }else{
                    sendKeyUp(KEY.UP);
                }
            }

            if (prevStatus[keyDown] !== window.gamePadState[keyDown]){
                if (window.gamePadState[keyDown]) {
                    sendKeyDown(KEY.DOWN);
                    if (!iFrame) selectGame(1);
                }else{
                    sendKeyUp(KEY.DOWN);
                }
            }

            if (window.gamePadState[keyLeft]) x -= 16;
            if (window.gamePadState[keyRight]) x += 16;
            if (window.gamePadState[keyUp]) y -= 12;
            if (window.gamePadState[keyDown]) y += 20;


            if (!ball.classList.contains("active")){
                ball.style.transform = "translate(" + x + "px," + y + "px)";
            }


            if (prevStatus[keyAction1] !== window.gamePadState[keyAction1]){
                if (window.gamePadState[keyAction1]) {
                    sendKeyDown(actionKey);
                    button.classList.add("down");
                    if (!iFrame) launchInternal(disks[selectedGame]);
                }else{
                    sendKeyUp(actionKey);
                    button.classList.remove("down");
                }
            }

            if (prevStatus[keyAction2] !== window.gamePadState[keyAction2]){
                if (window.gamePadState[keyAction2]) {
                    sendKeyDown(actionKey2);
                    button2.classList.add("down");
                }else{
                    sendKeyUp(actionKey2);
                    button2.classList.remove("down");
                }
            }

            if (prevStatus[keyAction3] !== window.gamePadState[keyAction3]){
                if (window.gamePadState[keyAction3]) {
                    sendKeyDown(actionKey3);
                    button3.classList.add("down");
                }else{
                    sendKeyUp(actionKey3);
                    button3.classList.remove("down");
                }
            }

            if (prevStatus[keyAction4] !== window.gamePadState[keyAction4]){
                if (window.gamePadState[keyAction4]) {
                    sendKeyDown(actionKey4);
                    button4.classList.add("down");
                }else{
                    sendKeyUp(actionKey4);
                    button4.classList.remove("down");
                }
            }


            requestAnimationFrame(updateStatus);
        }


        return me;
    }();

    window.addEventListener("gamepadconnected", (e) => {
        console.log(
            "Gamepad connected at index %d: %s. %d buttons, %d axes.",
            e.gamepad.index,
            e.gamepad.id,
            e.gamepad.buttons.length,
            e.gamepad.axes.length,
        );
        GamePad.startPolling();
    });


    window.addEventListener("gamepaddisconnected", (e) => {
        console.log(
            "Gamepad disconnected from index %d: %s",
            e.gamepad.index,
            e.gamepad.id,
        );
    });


    return me;
}

export default Arcade;






