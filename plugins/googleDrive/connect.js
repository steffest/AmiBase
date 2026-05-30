export function getToken(clientId){
    return new Promise(next=>{
        if (!clientId){
            next("");
            return;
        }

        let redirectUri = "https://www.amibase.com/token/";
        if (window.location.href.indexOf("://localhost") >= 0){
            redirectUri = "http://localhost:" + window.location.port + "/AmiBase/token/index.html";
        }

        let scope = encodeURIComponent("https://www.googleapis.com/auth/drive");
        let authUrl = "https://accounts.google.com/o/oauth2/v2/auth"
            + "?client_id=" + encodeURIComponent(clientId)
            + "&redirect_uri=" + encodeURIComponent(redirectUri)
            + "&response_type=token"
            + "&scope=" + scope
            + "&include_granted_scopes=true"
            + "&prompt=consent";

        localStorage.removeItem("exchangeToken");
        window.open(authUrl, "auth", "popup,width=500,height=700");

        let poller = setInterval(()=>{
            let token = localStorage.getItem("exchangeToken");
            if (token){
                clearInterval(poller);
                localStorage.removeItem("exchangeToken");
                if (token.indexOf("error") >= 0) token = "";
                next(token);
            }
        },500);
    });
}

