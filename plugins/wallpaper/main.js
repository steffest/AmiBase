import desktop from "../../_script/ui/desktop.js";
var WallPaper = function(){
    let me = {};

    me.init = function(containerWindow,context){
        var container = containerWindow.getInner();
        var list = container.querySelector("#wallpaper_list");

        if(!!list.querySelector(".thumb")) return;

        var options = {
            scale: getOption("scale") || "stretch",
            screen:getOption("screen") || "full",
            color:"#000000",
            backgroundImage: ""
        };

        console.warn(options);

        var wallPapers = [
            "content/wallpaper/none_thumb.png",
            "content/wallpaper/a500_thumb.jpg",
            "content/wallpaper/a500-tilt_thumb.jpg",
            "content/wallpaper/amigsys_gradient_thumb.jpg",
            "content/wallpaper/tick_thumb.jpg",
            "content/wallpaper/tick2_thumb.jpg",
            "content/wallpaper/tick_amigasys_thumb.jpg",
            "content/wallpaper/base1.jpg",
            "content/wallpaper/base_metal2.jpg",
            "content/wallpaper/mainboard_thumb.jpg",
            "content/wallpaper/fluid_thumb.jpg",
            "content/wallpaper/triangle_thumb.jpg"
        ]

        if (!list.querySelector(".thumb")){
            wallPapers.forEach(function(url){
                list.appendChild(generateTile(url))
            })
        }

        setOptionButtons("scale");
        setOptionButtons("screen");

        var colorSelect = container.querySelector(".colorSelect");
        var colorValue = container.querySelector(".colorValue");

        if (colorSelect && colorValue){
            colorSelect.onchange = function(){
                colorValue.value = colorSelect.value;
                options.color = colorSelect.value;
                setWallPaper();
            }
            colorValue.onchange = function(){
                colorSelect.value = colorValue.value;
                options.color = colorValue.value;
                setWallPaper();
            }
            options.color = colorValue.value;
        }

        var reset = container.querySelector(".optionreset");
        if (reset) reset.onclick = function(){
            desktop.setBackground("reset");
            var selected = list.querySelector(".selected");
            if (selected) selected.classList.remove("selected");
        }


        //Applications.registerApplicationActions("wallpaper",{

        //});

        if (containerWindow.onload) containerWindow.onload(containerWindow);

        function generateTile(url){
            var item = document.createElement("div");
            item.className = "thumb"
            item.style.backgroundImage = "url('"+url+"')";
            item.onclick = function(){
                //debugger;
                var selected = list.querySelector(".selected");
                if (selected) selected.classList.remove("selected");
                item.classList.add("selected")
                options.backgroundImage = url === "content/wallpaper/none_thumb.png" ? "none" : url.split("_thumb").join("");
                setWallPaper();
            }

            return item;
        }


        function setOptionButtons(name){
            var elm = container.querySelector(".option" + name);
            if (elm){
                var buttons = elm.querySelectorAll(".option");
                for (var i = 0, max = buttons.length; i<max; i++){
                    buttons[i].onclick = function(){
                        for (var i = 0, max = buttons.length; i<max; i++){
                            buttons[i].classList.remove("selected");
                        }
                        this.classList.add("selected");
                        options[name] = this.innerText.toLowerCase();
                        setWallPaper();
                    }
                }
            }
        }

        function getOption(name){
            var elm = container.querySelector(".option" + name);
            if (elm){
                var button = elm.querySelector(".selected");
                if (button) return button.innerText.toLowerCase();
            }
        }

        function setWallPaper(){
            console.error(options);
            desktop.setBackground(options);
        }
    }
    return me;
};

export default WallPaper();