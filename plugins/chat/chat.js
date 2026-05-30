import network from '../../_script/system/network.js';

let Chat = ()=>{
    let me = {};
    let messageList;
    let peerSelect;
    let unSubPeers;
    let pendingTargetPeer = "*";

    me.init = (w,context)=>{
        console.error("Chat init",w,context);

        network.register("chat",handleMessage);

        w.setSize(300,400);
        w.setCaption("Chat");

        let chatBox = document.createElement("div");
        chatBox.className = "chatbox";
        messageList = document.createElement("div");
        messageList.className = "messages";

        let actions = document.createElement("div");
        actions.className = "actions";
        peerSelect = document.createElement("select");
        peerSelect.className = "target";
        actions.appendChild(peerSelect);

        let connectButton = document.createElement("button");
        connectButton.innerText = "Connections";
        connectButton.onclick = ()=>network.openManagerWindow();
        actions.appendChild(connectButton);

        let input = document.createElement("input");
        input.onkeydown = function(e){
            if (e.keyCode === 13){
                const message = (input.value || "").trim();
                if (!message) return;
                let target = peerSelect ? peerSelect.value : "*";
                if (!target) target = "*";
                const sent = network.sendChat(message, target);
                if (sent) {
                    appendMessage({
                        message: message,
                        from: "me",
                        displayName: "You",
                        to: target,
                    });
                    input.value = "";
                }
            }
        }

        chatBox.appendChild(actions);
        chatBox.appendChild(messageList);
        chatBox.appendChild(input);
        w.setContent(chatBox);
        renderPeerOptions();
        unSubPeers = network.on("peers.changed",renderPeerOptions);
        w.onClose = ()=>{
            if (unSubPeers) unSubPeers();
            network.unregister("chat");
        };

    }


    function handleMessage(data){
        appendMessage(data);
    }

    function appendMessage(data){
        if (!messageList || !data) return;
        let message = data.message || "";
        let from = data.displayName || data.from || "peer";
        let to = data.to || "*";
        let msg = document.createElement("div");
        msg.className = "message";
        let fromElm = document.createElement("i");
        fromElm.innerText = to === "*" ? from : `${from} -> ${to}`;
        let textElm = document.createElement("div");
        textElm.innerText = message;
        msg.appendChild(fromElm);
        msg.appendChild(textElm);
        messageList.appendChild(msg);
        messageList.scrollTop = messageList.scrollHeight;
    }

    function renderPeerOptions(){
        if (!peerSelect) return;
        const peers = network.getPeers ? network.getPeers() : [];
        const previous = pendingTargetPeer || peerSelect.value || "*";
        peerSelect.innerHTML = "";

        const all = document.createElement("option");
        all.value = "*";
        all.innerText = "All connected peers";
        peerSelect.appendChild(all);

        peers.forEach((peer)=>{
            if (!peer.dataOpen && !peer.connected) return;
            const option = document.createElement("option");
            option.value = peer.peerToken;
            option.innerText = peer.peerName || peer.peerToken;
            peerSelect.appendChild(option);
        });
        peerSelect.value = previous;
        if (peerSelect.value !== previous) peerSelect.value = "*";
        pendingTargetPeer = peerSelect.value;
    }

    me.startChatWith = function(data){
        const peerToken = data && data.peerToken ? data.peerToken : "*";
        pendingTargetPeer = peerToken;
        renderPeerOptions();
    }

    return me;

};

export default Chat();