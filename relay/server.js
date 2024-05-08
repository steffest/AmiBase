const http = require('http');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;
const port = process.env.PORT || 6001;

const httpsServer = http.createServer((req, res) => {res.end("Nothing here, this is a websocket relay server")});
httpsServer.listen(port);

const wss = new WebSocketServer({ server: httpsServer });

wss.on('connection', function (ws) {
    ws.on('message', function (buffer) {
       wss.broadcast(buffer.toString());
    });

    ws.on('error', () => ws.terminate());
});

wss.broadcast = function (data) {
    this.clients.forEach(function (client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
};

console.log('Server running.');
