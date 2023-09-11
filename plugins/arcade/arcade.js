import $ from "../../_script/util/dom.js";
import system from "../../_script/system/system.js";
import Security from "../../_script/security.js";
import Input from "../../_script/input.js";
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
    let button;
    let ball;
    let keyState = {};


    let KEY = {
        SPACE:{
            key: " ",
            code: "Space",
            keyCode: 32
        },
        LEFT:{
            key: "ArrowLeft",
            code: "ArrowLeft",
            keyCode: 37
        },
        RIGHT:{
            key: "ArrowRight",
            code: "ArrowRight",
            keyCode: 39
        },
        DOWN:{
            key: "ArrowDown",
            code: "ArrowDown",
            keyCode: 40
        },
        UP:{
            key: "ArrowUp",
            code: "ArrowUp",
            keyCode: 38
        },
        SHIFT:{
            key: "Shift",
            code: "ShiftRight",
            keyCode: 16
        }
    }

    let disks = [
        {type: "amiga500", title: "Super Cars 2", url: "amiga/SuperCarsII_Disk1.adf", icon: "amiga/supercars2.png"},
        {type: "amiga500", title: "Scorpio", disk: "amiga/Scorpio.adf", icon: "amiga/scorpio.png"},
        {type: "amiga500", title: "Turrican II", disk: "amiga/TurricanII-a.adf", icon: "amiga/turricanII.png"},
        {type: "dos", title: "Pacman", url:"dos/pacman.zip", command:"PAC-MAN.EXE", icon: "dos/pacman.png", actionKey: KEY.SPACE},
    ]
    let actionKey = KEY.SHIFT;


    me.init = function(containerWindow,context){
        return new Promise((next)=>{
            amiWindow = containerWindow;
            if (context) amiBase = context;
            setupUI();
            GamePad.init();
            next();
        });
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


    function setupUI(){
        amiWindow.removeBorder();
        amiWindow.setSize(540,580);
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

        $(".arcade",
            {parent: container,},
            $(".slice.topleft",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_01.png)"}}),
            $(".slice.top",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_02.png)"}}),
            $(".slice.topright",{style:{backgroundImage:"url(plugins/arcade/_img/slices/arcade_03.png)"}}),
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
                            if (!keyState.up) sendKeyDown(KEY.UP);
                            keyState.up = true;
                        }
                        if (y>12){
                            if (!keyState.down) sendKeyDown(KEY.DOWN);
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






        disks.forEach(disk=>{
            let item = $(".arcadeitem.preventdefaultdrag",{
                style: {backgroundImage: "url(" + contentBaseUrl + disk.icon + ")"},
                onDown: ()=>launchInternal(disk)
            },$("label",disk.title));
            screen.appendChild(item);
        });
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
            url = "https://amibase.com/apps/dos/";
        }
        if (game.type === "amiga500"){
            //url = "https://www.amibase.com/apps/vAmigaWeb/";
            url = "https://www.stef.be/amiga/ScriptedAmigaEmulator/dev.html";
            game.url = contentBaseUrl + game.disk;
        }
        actionKey = game.actionKey || KEY.SHIFT;
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
        var keyShoot = 17;
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

                    window.gamePadState[keyShoot] = isPressed(0) ||  isPressed(1) ||  isPressed(4) ||  isPressed(6);
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
                }else{
                    sendKeyUp(KEY.UP);
                }
            }

            if (prevStatus[keyDown] !== window.gamePadState[keyDown]){
                if (window.gamePadState[keyDown]) {
                    sendKeyDown(KEY.DOWN);
                }else{
                    sendKeyUp(KEY.DOWN);
                }
            }

            if (prevStatus[keyShoot] !== window.gamePadState[keyShoot]){
                if (window.gamePadState[keyShoot]) {
                    sendKeyDown(actionKey);
                }else{
                    sendKeyUp(actionKey);
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






