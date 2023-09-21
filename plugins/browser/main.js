
let Browser = ()=>{
    let me = {
        name:"browser",
        version:"0.0.1"
    };
    let zoom = 1;

    me.init = (containerWindow,context)=>{
        var container = containerWindow.getInner();

        var input = container.querySelector("#browser_url");
        var frame = container.querySelector("#browser_frame");

        input.onkeypress = function(e){
            if (e.code === "Enter" || e.keyCode === 13){
                var url = input.value;
                frame.src = url;
            }
        }

        var menu = [
            {label: "Browser",items:[
                {label: "Zoom Out",action:()=>{
                        zoom = Math.max(0.1,zoom-0.1);
                        setZoom();
                }},
                    {label: "Zoom In",action:()=>{
                            zoom = Math.min(2,zoom+0.1);
                            setZoom();
                        }}
                ]},
            {label: "Bookmarks",items:[
                    {label: "Google",action:()=>{frame.src = "https://www.google.com/webhp?igu=1";}},
                ]}

        ];

        containerWindow.setMenu(menu,true);


        function setZoom(){
            frame.style.transform = "scale(" + zoom + ")";
            frame.style.transformOrigin = "0 0";
            frame.style.width = (100/zoom) + "%";
            frame.style.height = (100/zoom) + "%";
        }
    }

    return me;
}

export default Browser;