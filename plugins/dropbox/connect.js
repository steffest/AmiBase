export function getToken(){
    return new Promise((next)=>{
        let client_id = "ttx9sdz1rbzocgs";

        // TODO also support without www
        let redirectUri = "https://www.amibase.com/token/";

        if (window.location.href.indexOf("://localhost")>=0){
            redirectUri = "http://localhost:"  + window.location.port +  "/AmiBase/token/index.html";
        }
        let url = "https://www.dropbox.com/oauth2/authorize?client_id=" + client_id + "&response_type=token&redirect_uri=" + redirectUri;

        localStorage.removeItem("exchangeToken");

        window.open(url,"auth","popup,width=500,height=600");

        let poller = setInterval(()=>{
            console.log("polling");
            let token = localStorage.getItem("exchangeToken");
            if (token){
                clearInterval(poller);
                localStorage.removeItem("exchangeToken");
                if (token.indexOf("error")>=0)token="";
                next(token);
            }
        },500);
    })
}