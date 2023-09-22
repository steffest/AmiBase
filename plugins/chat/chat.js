import network from '../../_script/system/network.js';

let Chat = ()=>{
    let me = {};
    let messageList;

    me.init = (w,context)=>{
        console.error("Chat init",w,context);

        network.register("chat",handleMessage);

        w.setSize(300,400);
        w.setCaption("Chat");

        let chatBox = document.createElement("div");
        chatBox.className = "chatbox";
        messageList = document.createElement("div");
        messageList.className = "messages";

        let input = document.createElement("input");
        input.onkeydown = function(e){
            if (e.keyCode === 13){
                console.error("send message",input.value);
                network.send({command:"chat",message:input.value});
                input.value = "";
            }
        }

        chatBox.appendChild(messageList);
        chatBox.appendChild(input);
        w.setContent(chatBox);

    }

    function handleMessage(data){
        let message=data.message;
        let from = data.displayName || data.from;

        if (messageList){
            let msg = document.createElement("div");
            msg.className = "message";
            let fromElm = document.createElement("i");
            fromElm.innerText = from;
            let textElm = document.createElement("div");
            textElm.innerText = message;
            msg.appendChild(fromElm);
            msg.appendChild(textElm);
            messageList.appendChild(msg);
            messageList.scrollTop = messageList.scrollHeight;
        }
    }

    return me;

};

export default Chat();