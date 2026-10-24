const http = require('http');
const WebSocket = require('ws');
const port = process.env.PORT || 6001;

const httpsServer = http.createServer((req, res) => {res.end("Nothing here, this is a websocket relay server")});
httpsServer.listen(port, process.env.HOST || '0.0.0.0');

const wss = new WebSocket.Server({ noServer: true });
const clientsById = new Map();
const inviteCodes = new Map(); // code -> { signalId, expiresAt }
const INVITE_TTL_MS = 5 * 60 * 1000;

function cleanCode(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function purgeExpiredInvites() {
    const now = Date.now();
    inviteCodes.forEach((entry, code) => {
        if (!entry || !entry.expiresAt || entry.expiresAt <= now) inviteCodes.delete(code);
    });
}

function removeInvitesForSignal(signalId) {
    if (!signalId) return;
    inviteCodes.forEach((entry, code) => {
        if (entry && entry.signalId === signalId) inviteCodes.delete(code);
    });
}

function generateInviteCode() {
    purgeExpiredInvites();
    for (let i = 0; i < 50; i += 1) {
        const nr = Math.floor(Math.random() * 1000000);
        const code = String(nr).padStart(6, "0");
        if (!inviteCodes.has(code)) return code;
    }
    return "";
}

wss.on('connection', function (ws) {
    ws._signalId = "";
    ws._token = "";
    ws._name = "";
    ws._discoverable = true;

    ws.on('message', function (buffer) {
        const text = buffer.toString();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch (e) {}

        if (data && data.t === "hello") {
            const id = typeof data.id === "string" ? data.id : "";
            if (!id) return;
            const existing = clientsById.get(id);
            if (existing && existing !== ws) {
                try { existing.close(); } catch (e) {}
            }

            ws._signalId = id;
            ws._token = typeof data.token === "string" ? data.token : "";
            ws._name = typeof data.name === "string" ? data.name : "";
            ws._discoverable = data.discoverable !== false;
            clientsById.set(id, ws);

            ws.send(JSON.stringify({ t: "helloAck", ts: Date.now() }));
            broadcastPeers();
            return;
        }

        if (data && data.t === "signal") {
            const to = typeof data.to === "string" ? data.to : "";
            const from = typeof data.from === "string" ? data.from : ws._signalId;
            if (!to || !from || !data.payload) return;
            const dst = clientsById.get(to);
            if (!dst || dst.readyState !== WebSocket.OPEN) {
                ws.send(JSON.stringify({ t: "signalError", to, error: "peer_offline", ts: Date.now() }));
                return;
            }
            dst.send(JSON.stringify({
                t: "signal",
                from,
                to,
                payload: data.payload,
                ts: Date.now()
            }));
            return;
        }

        if (data && data.t === "invite.create") {
            const requestId = typeof data.requestId === "string" ? data.requestId : "";
            if (!ws._signalId) {
                ws.send(JSON.stringify({ t: "invite.error", requestId, error: "not_registered", ts: Date.now() }));
                return;
            }
            const code = generateInviteCode();
            if (!code) {
                ws.send(JSON.stringify({ t: "invite.error", requestId, error: "invite_pool_exhausted", ts: Date.now() }));
                return;
            }
            const expiresAt = Date.now() + INVITE_TTL_MS;
            inviteCodes.set(code, { signalId: ws._signalId, expiresAt });
            ws.send(
                JSON.stringify({
                    t: "invite.created",
                    requestId,
                    code,
                    expiresAt,
                    signalId: ws._signalId,
                    ts: Date.now(),
                })
            );
            return;
        }

        if (data && data.t === "invite.resolve") {
            const requestId = typeof data.requestId === "string" ? data.requestId : "";
            const code = cleanCode(data.code);
            if (!code || code.length !== 6) {
                ws.send(JSON.stringify({ t: "invite.error", requestId, error: "invalid_code", ts: Date.now() }));
                return;
            }
            purgeExpiredInvites();
            const invite = inviteCodes.get(code);
            if (!invite) {
                ws.send(JSON.stringify({ t: "invite.error", requestId, error: "code_not_found", ts: Date.now() }));
                return;
            }
            const target = clientsById.get(invite.signalId);
            if (!target || target.readyState !== WebSocket.OPEN) {
                inviteCodes.delete(code);
                ws.send(JSON.stringify({ t: "invite.error", requestId, error: "origin_offline", ts: Date.now() }));
                return;
            }
            ws.send(
                JSON.stringify({
                    t: "invite.resolved",
                    requestId,
                    code,
                    signalId: invite.signalId,
                    expiresAt: invite.expiresAt,
                    ts: Date.now(),
                })
            );
            return;
        }

        if (data && data.t === "token.check") {
            const requestId = typeof data.requestId === "string" ? data.requestId : "";
            const token = String(data.token || "").trim();
            const currentToken = String(data.currentToken || "").trim();
            if (!token) {
                ws.send(JSON.stringify({ t: "token.error", requestId, error: "invalid_token", ts: Date.now() }));
                return;
            }

            let inUse = false;
            clientsById.forEach((client) => {
                if (inUse) return;
                if (!client || client === ws || client.readyState !== WebSocket.OPEN) return;
                if (!client._token) return;
                if (client._token === token && client._token !== currentToken) inUse = true;
            });

            ws.send(
                JSON.stringify({
                    t: "token.checked",
                    requestId,
                    token,
                    unique: !inUse,
                    ts: Date.now(),
                })
            );
            return;
        }

        // Backwards compatibility: relay unknown payloads to all clients.
        wss.broadcast(text);
    });

    ws.on('close', () => {
        if (ws._signalId && clientsById.get(ws._signalId) === ws) {
            clientsById.delete(ws._signalId);
            removeInvitesForSignal(ws._signalId);
            broadcastPeers();
        }
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

function broadcastPeers() {
    const peers = [];
    clientsById.forEach((client, id) => {
        if (!client || client._discoverable === false) return;
        peers.push({
            id,
            token: client._token || "",
            name: client._name || "",
            discoverable: client._discoverable !== false,
        });
    });
    const msg = JSON.stringify({ t: "peers", peers, ts: Date.now() });
    wss.broadcast(msg);
}

httpsServer.on("upgrade", (request, socket, head) => {
    const url = request.url || "/";
    if (url !== "/" && url !== "/ws") {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
    });
});

console.log('Server running.');

setInterval(purgeExpiredInvites, 30000);
