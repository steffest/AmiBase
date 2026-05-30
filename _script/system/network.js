import user from "../user.js";
import desktop from "../ui/desktop.js";
import system from "./system.js";
import fileSystem from "./filesystem.js";
import {
    DEFAULT_RELAY_DOMAIN,
    ICE_SERVERS,
    SIGNAL_STATUS,
    STORAGE_KEYS,
    REMOTE_FS_REQUEST_TIMEOUT,
    EVENT_LOG_LIMIT,
    REMOTE_FS_MAX_PACKET_CHARS,
    now,
    randomToken,
    shortId,
    safeJson,
    escapeHtml,
    bytesToBase64,
    base64ToBytes,
    binaryToBase64,
    encodeToken,
    decodeToken,
} from "./network/shared.js";
import { waitForIceGathering, addIceCandidates } from "./network/rtc.js";
import { createRemoteFsHelpers } from "./network/remoteFs.js";

let iceServers = ICE_SERVERS;

let Network = () => {
    let me = {};

    let registeredApps = {};
    let listeners = {};
    let managerWindow = null;
    let initDone = false;

    let relayDomain = DEFAULT_RELAY_DOMAIN;
    let networkEnabled = true;
    let networkFileAccessEnabled = true;
    let networkAllowDiscoveryEnabled = true;
    let networkChatAccessEnabled = true;
    let networkTrustedAccessEnabled = true;
    let networkDriveAccess = [];
    let localSignalId = "";
    let signalSocket = null;
    let signalUrl = "";
    let signalStatus = SIGNAL_STATUS.DISCONNECTED;
    let signalRetryMs = 600;
    let signalRetryTimer = null;
    let signalPathIndex = 0;
    let discoveredPeers = [];
    let pendingRelayRequests = new Map();

    let identity = {
        clientToken: "",
        displayName: "",
        chatDisplayName: "",
        createdAt: Date.now(),
    };

    let peers = new Map();
    let pendingOutgoing = new Map();
    let trickleSessions = new Map();
    let knownPeers = new Map();
    let reconnectCooldown = new Map();
    let sharedFilesByPeer = new Map(); // peerToken -> [fileEntry]
    let peerDesktopIcons = new Map(); // peerToken -> desktop icon
    let peerWindows = new Map(); // peerToken -> { window, render }
    let pcToPeerToken = new WeakMap();
    let dcToPeerToken = new WeakMap();
    let boundPeerConnections = new WeakSet();
    let boundDataChannels = new WeakSet();
    let pendingRemoteFsRequests = new Map();
    let incomingRemoteFsChunks = new Map();
    let eventHistory = [];
    const remoteFs = createRemoteFsHelpers({ fileSystem, base64ToBytes, binaryToBase64 });

    function getPeerDisplayName(peerToken) {
        const peer = peers.get(peerToken);
        if (peer && peer.peerName) return peer.peerName;
        const known = knownPeers.get(peerToken);
        if (known && known.name) return known.name;
        return `Client ${shortId(peerToken)}`;
    }


    function snapshotEventDetail(detail) {
        if (typeof detail === "undefined") return null;
        if (detail === null) return null;
        if (typeof detail === "string" || typeof detail === "number" || typeof detail === "boolean") return detail;
        try {
            return JSON.parse(JSON.stringify(detail));
        } catch (_e) {
            return String(detail);
        }
    }

    function appendEventHistory(event, detail) {
        const entry = {
            ts: now(),
            event: String(event || ""),
            detail: snapshotEventDetail(detail),
        };
        eventHistory.push(entry);
        if (eventHistory.length > EVENT_LOG_LIMIT) {
            eventHistory = eventHistory.slice(eventHistory.length - EVENT_LOG_LIMIT);
        }
        return entry;
    }

    function emit(event, detail) {
        const entry = appendEventHistory(event, detail);
        let entries = listeners[event] || [];
        entries.forEach((handler) => {
            try {
                handler(detail);
            } catch (e) {
                console.error("Network listener error", e);
            }
        });
        let wildcardEntries = listeners["*"] || [];
        wildcardEntries.forEach((handler) => {
            try {
                handler(entry);
            } catch (e) {
                console.error("Network wildcard listener error", e);
            }
        });
    }

    function persistIdentity() {
        user.storeSetting(STORAGE_KEYS.IDENTITY, identity, false);
    }

    function normalizeDriveAccessConfig(items) {
        if (!Array.isArray(items)) return [];
        return items
            .map((item) => ({
                volume: String((item && item.volume) || "").trim().toLowerCase(),
                read: item ? item.read !== false : true,
                write: item ? item.write !== false : true,
                password: String((item && item.password) || ""),
            }))
            .filter((item) => !!item.volume);
    }

    function isDiscoveryAllowed() {
        return !!(networkFileAccessEnabled && networkAllowDiscoveryEnabled);
    }

    function announceIdentityToSignaling() {
        if (!signalSocket || signalSocket.readyState !== WebSocket.OPEN) return;
        signalSocket.send(
            JSON.stringify({
                t: "hello",
                id: localSignalId,
                token: identity.clientToken,
                name: identity.displayName || "",
                discoverable: isDiscoveryAllowed(),
                ts: now(),
            })
        );
    }

    function announceIdentityToPeers() {
        peers.forEach((peer) => {
            if (peer && peer.dc && peer.dc.readyState === "open") {
                sendHello(peer.peerToken);
            }
        });
    }

    function on(event, handler) {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
        return () => {
            listeners[event] = (listeners[event] || []).filter((item) => item !== handler);
        };
    }

    function setSignalStatus(status, detail) {
        signalStatus = status;
        emit("status", { status, detail: detail || "" });
        emit("connection.dot", {
            connected: peers.size > 0,
            signaling: status,
        });
    }

    function saveKnownPeersSoon() {
        const payload = Array.from(knownPeers.values()).map((peer) => ({
            token: peer.token || "",
            name: peer.name || "",
            lastConnectedAt: peer.lastConnectedAt || 0,
            lastSignalId: peer.lastSignalId || "",
        }));
        user.storeSetting(STORAGE_KEYS.KNOWN_PEERS, payload, false);
    }

    function saveSharedFilesSoon() {
        const payload = {};
        sharedFilesByPeer.forEach((items, peerToken) => {
            payload[peerToken] = (items || []).map((item) => ({
                id: item.id,
                name: item.name,
                mimeType: item.mimeType || "application/octet-stream",
                size: item.size || 0,
                dataBase64: item.dataBase64 || "",
                ts: item.ts || now(),
                direction: item.direction || "in",
                fromToken: item.fromToken || "",
                fromName: item.fromName || "",
            }));
        });
        user.storeSetting(STORAGE_KEYS.PEER_FILES, payload, false);
    }

    function addSharedFile(peerToken, item) {
        if (!peerToken || !item) return;
        const list = sharedFilesByPeer.get(peerToken) || [];
        list.unshift(item);
        sharedFilesByPeer.set(peerToken, list.slice(0, 200));
        saveSharedFilesSoon();
        const peerWindow = peerWindows.get(peerToken);
        if (peerWindow && peerWindow.window && peerWindow.window.sendMessage) {
            peerWindow.window.sendMessage("refresh");
        }
    }

    function rememberPeer(peerToken, peerName, signalId) {
        if (!peerToken) return;
        knownPeers.set(peerToken, {
            token: peerToken,
            name: peerName || (knownPeers.get(peerToken) || {}).name || "",
            lastConnectedAt: now(),
            lastSignalId: signalId || (knownPeers.get(peerToken) || {}).lastSignalId || "",
        });
        saveKnownPeersSoon();
    }

    function forgetPeer(peerToken) {
        if (!peerToken) return;
        const removed = knownPeers.delete(peerToken);
        reconnectCooldown.delete(peerToken);
        if (removed) saveKnownPeersSoon();
    }

    function forgetPeersBySignalId(signalId) {
        const cleanSignalId = String(signalId || "");
        if (!cleanSignalId) return;
        let removed = false;
        knownPeers.forEach((peer, token) => {
            if (!peer || peer.lastSignalId !== cleanSignalId) return;
            knownPeers.delete(token);
            reconnectCooldown.delete(token);
            removed = true;
        });
        if (removed) saveKnownPeersSoon();
    }

    function getOpenDataChannelCount() {
        let count = 0;
        peers.forEach((peer) => {
            if (peer.dc && peer.dc.readyState === "open") count += 1;
        });
        return count;
    }

    function peersSnapshot() {
        return Array.from(peers.values()).map((peer) => ({
            peerToken: peer.peerToken,
            peerName: peer.peerName || "",
            signalId: peer.signalId || "",
            connectionState: peer.connectionState || "new",
            dataOpen: !!peer.dataOpen,
            connected: !!peer.connected,
            lastEventAt: peer.lastEventAt || now(),
        }));
    }

    function notifyPeersChanged() {
        const snapshot = peersSnapshot();
        emit("peers.changed", snapshot);
        emit("connection.dot", {
            connected: getOpenDataChannelCount() > 0,
            signaling: signalStatus,
        });
        syncPeerDesktopIcons(snapshot);
        snapshot.forEach((peer) => {
            const peerWindow = peerWindows.get(peer.peerToken);
            if (peerWindow && peerWindow.window && peerWindow.window.sendMessage) {
                peerWindow.window.sendMessage("refresh");
            }
        });
    }

    function makePeerIconObject(peerToken) {
        return {
            type: "network",
            name: `Peer ${shortId(peerToken)}`,
            label: getPeerDisplayName(peerToken),
            path: `ram:peer-${peerToken}.peer`,
            open: () => openPeerWindow(peerToken),
            getActions: () => [
                {
                    label: "Open",
                    action: () => openPeerWindow(peerToken),
                },
                {
                    label: "Chat",
                    action: () => openChatWithPeer(peerToken),
                },
            ],
        };
    }

    function syncPeerDesktopIcons(snapshot) {
        let addedNewIcon = false;
        const connectedTokens = new Set(
            (snapshot || [])
                .filter((peer) => peer && (peer.connected || peer.dataOpen))
                .map((peer) => peer.peerToken)
        );

        connectedTokens.forEach((peerToken) => {
            const peerPath = `ram:peer-${peerToken}.peer`;
            const desktopIcons = desktop.getIcons ? desktop.getIcons() : [];
            const matches = desktopIcons.filter((item) => item && item.object && item.object.path === peerPath);

            let icon = peerDesktopIcons.get(peerToken) || matches[0];
            if (!icon) {
                icon = desktop.addObject(makePeerIconObject(peerToken));
                if (icon) addedNewIcon = true;
            }
            if (icon) {
                peerDesktopIcons.set(peerToken, icon);
            }

            // If duplicates already exist, keep only one.
            if (matches.length > 1) {
                matches.slice(1).forEach((dup) => {
                    if (dup && dup.parent && typeof dup.parent.removeIcon === "function") {
                        dup.parent.removeIcon(dup);
                    }
                });
            }

            if (icon && icon.object) {
                icon.object.label = getPeerDisplayName(peerToken);
                icon.setLabel(getPeerDisplayName(peerToken));
            }
        });

        Array.from(peerDesktopIcons.keys()).forEach((peerToken) => {
            if (connectedTokens.has(peerToken)) return;
            const icon = peerDesktopIcons.get(peerToken);
            if (icon && icon.parent && typeof icon.parent.removeIcon === "function") {
                icon.parent.removeIcon(icon);
            }
            peerDesktopIcons.delete(peerToken);
        });

        // Place newly added peer icons on free grid positions.
        if (addedNewIcon && typeof desktop.cleanUp === "function") {
            desktop.cleanUp();
        }
    }

    function removePeerDesktopIcon(peerToken) {
        if (!peerToken) return;
        const icon = peerDesktopIcons.get(peerToken);
        if (icon && icon.parent && typeof icon.parent.removeIcon === "function") {
            icon.parent.removeIcon(icon);
        }
        peerDesktopIcons.delete(peerToken);

        // Fallback cleanup for any stale icon that was keyed differently.
        const icons = desktop.getIcons ? desktop.getIcons() : [];
        icons.forEach((desktopIcon) => {
            const path = desktopIcon && desktopIcon.object ? desktopIcon.object.path : "";
            if (path === `ram:peer-${peerToken}.peer`) {
                if (desktopIcon.parent && typeof desktopIcon.parent.removeIcon === "function") {
                    desktopIcon.parent.removeIcon(desktopIcon);
                }
            }
        });
    }

    function upsertPeer(peerToken, patch) {
        if (!peerToken) return null;
        const prev = peers.get(peerToken) || {
            peerToken,
            peerName: "",
            signalId: "",
            connectionState: "new",
            connected: false,
            dataOpen: false,
            lastEventAt: now(),
            pc: null,
            dc: null,
        };
        const next = {
            ...prev,
            ...patch,
            peerToken,
            lastEventAt: now(),
        };
        peers.set(peerToken, next);
        if (next.pc) pcToPeerToken.set(next.pc, peerToken);
        if (next.dc) dcToPeerToken.set(next.dc, peerToken);
        notifyPeersChanged();
        return next;
    }

    function mergePeerIdentity(oldPeerToken, newPeerToken, patch) {
        if (!oldPeerToken || !newPeerToken || oldPeerToken === newPeerToken) return;
        const oldPeer = peers.get(oldPeerToken);
        if (!oldPeer) return;

        const existingNew = peers.get(newPeerToken) || {};
        const merged = {
            ...oldPeer,
            ...existingNew,
            ...(patch || {}),
            peerToken: newPeerToken,
            lastEventAt: now(),
        };
        peers.delete(oldPeerToken);
        peers.set(newPeerToken, merged);
        if (merged.pc) pcToPeerToken.set(merged.pc, newPeerToken);
        if (merged.dc) dcToPeerToken.set(merged.dc, newPeerToken);

        if (knownPeers.has(oldPeerToken) && !knownPeers.has(newPeerToken)) {
            knownPeers.set(newPeerToken, knownPeers.get(oldPeerToken));
        }
        knownPeers.delete(oldPeerToken);

        if (sharedFilesByPeer.has(oldPeerToken)) {
            const oldItems = sharedFilesByPeer.get(oldPeerToken) || [];
            const newItems = sharedFilesByPeer.get(newPeerToken) || [];
            sharedFilesByPeer.set(newPeerToken, oldItems.concat(newItems));
            sharedFilesByPeer.delete(oldPeerToken);
            saveSharedFilesSoon();
        }

        if (peerDesktopIcons.has(oldPeerToken)) {
            const icon = peerDesktopIcons.get(oldPeerToken);
            peerDesktopIcons.delete(oldPeerToken);
            if (icon) {
                peerDesktopIcons.set(newPeerToken, icon);
                if (icon.object) {
                    icon.object.label = getPeerDisplayName(newPeerToken);
                    icon.object.open = () => openPeerWindow(newPeerToken);
                    icon.object.getActions = () => [
                        { label: "Open", action: () => openPeerWindow(newPeerToken) },
                        { label: "Chat", action: () => openChatWithPeer(newPeerToken) },
                    ];
                }
            }
        }

        if (peerWindows.has(oldPeerToken)) {
            const info = peerWindows.get(oldPeerToken);
            peerWindows.delete(oldPeerToken);
            peerWindows.set(newPeerToken, info);
        }

        notifyPeersChanged();
    }

    function removePeer(peerToken) {
        if (!peerToken) return;
        peers.delete(peerToken);
        removePeerDesktopIcon(peerToken);
        notifyPeersChanged();
    }

    function createPeerConnection() {
        return new RTCPeerConnection({ iceServers: iceServers });
    }

    function attachPeerLifecycle(peerToken, pc) {
        if (!pc) return;
        if (boundPeerConnections.has(pc)) return;
        boundPeerConnections.add(pc);
        const update = () => {
            const activePeerToken = pcToPeerToken.get(pc) || peerToken;
            const state = pc.connectionState || "unknown";
            upsertPeer(activePeerToken, {
                connectionState: state,
                connected: state === "connected",
            });
            if (state === "connected") {
                const peer = peers.get(activePeerToken);
                rememberPeer(activePeerToken, peer && peer.peerName, peer && peer.signalId);
            }
        };
        pc.addEventListener("connectionstatechange", update);
        update();
    }

    function sendAppPayloadToPeer(toPeerToken, payload) {
        const peer = peers.get(toPeerToken);
        if (!peer || !peer.dc || peer.dc.readyState !== "open") return false;
        peer.dc.send(
            JSON.stringify({
                t: "app",
                from: {
                    token: identity.clientToken,
                    name: identity.displayName || "",
                },
                payload,
                ts: now(),
            })
        );
        return true;
    }

    function sendRemoteFsResponse(toPeerToken, requestId, ok, result, error) {
        if (!toPeerToken || !requestId) return false;
        return sendChunkedRemoteFsPayload(toPeerToken, {
            command: "network.remoteFs.response",
            to: toPeerToken,
            requestId,
            ok: !!ok,
            result: result || null,
            error: error || "",
        });
    }

    async function handleRemoteFsRequest(message, fallbackPeerToken) {
        const peerToken = (message && message.from) || fallbackPeerToken;
        const requestId = message && message.requestId ? String(message.requestId) : "";
        if (!peerToken || !requestId) return;
        try {
            const result = await remoteFs.executeRemoteFsOperation(message.operation, message.payload || {});
            sendRemoteFsResponse(peerToken, requestId, true, result, "");
        } catch (e) {
            const error = e && e.message ? e.message : "remote_request_failed";
            sendRemoteFsResponse(peerToken, requestId, false, null, error);
        }
    }

    function handleRemoteFsResponse(message) {
        const requestId = message && message.requestId ? String(message.requestId) : "";
        if (!requestId) return;
        const pending = pendingRemoteFsRequests.get(requestId);
        if (!pending) return;
        pendingRemoteFsRequests.delete(requestId);
        clearTimeout(pending.timer);
        if (message.ok) {
            pending.resolve(message.result || {});
            return;
        }
        pending.reject(new Error(message.error || "remote_request_failed"));
    }

    function requestRemoteFs(peerToken, operation, payload, timeoutMs) {
        return new Promise((resolve, reject) => {
            const to = String(peerToken || "");
            if (!to) {
                reject(new Error("missing_peer_token"));
                return;
            }
            const requestId = randomToken(10);
            const timer = setTimeout(() => {
                pendingRemoteFsRequests.delete(requestId);
                reject(new Error("remote_request_timeout"));
            }, timeoutMs || REMOTE_FS_REQUEST_TIMEOUT);
            pendingRemoteFsRequests.set(requestId, { resolve, reject, timer });

            const sent = sendChunkedRemoteFsPayload(to, {
                command: "network.remoteFs.request",
                to,
                requestId,
                operation,
                payload: payload || {},
            });
            if (!sent) {
                clearTimeout(timer);
                pendingRemoteFsRequests.delete(requestId);
                reject(new Error("remote_peer_not_connected"));
            }
        });
    }

    function sendChunkedRemoteFsPayload(toPeerToken, payload) {
        if (!toPeerToken || !payload) return false;
        const text = JSON.stringify(payload);
        if (text.length <= REMOTE_FS_MAX_PACKET_CHARS) {
            return sendAppPayloadToPeer(toPeerToken, payload);
        }

        const transferId = randomToken(10);
        const totalChunks = Math.ceil(text.length / REMOTE_FS_MAX_PACKET_CHARS);
        const started = sendAppPayloadToPeer(toPeerToken, {
            command: "network.remoteFs.chunk.start",
            transferId,
            totalChunks,
        });
        if (!started) return false;

        for (let i = 0; i < totalChunks; i += 1) {
            const chunk = text.slice(i * REMOTE_FS_MAX_PACKET_CHARS, (i + 1) * REMOTE_FS_MAX_PACKET_CHARS);
            const ok = sendAppPayloadToPeer(toPeerToken, {
                command: "network.remoteFs.chunk.data",
                transferId,
                index: i,
                chunk,
            });
            if (!ok) return false;
        }
        return true;
    }

    function handleRemoteFsChunkStart(message, fallbackPeerToken) {
        const transferId = message && message.transferId ? String(message.transferId) : "";
        const totalChunks = Number(message && message.totalChunks);
        if (!transferId || !Number.isFinite(totalChunks) || totalChunks <= 0) return;
        incomingRemoteFsChunks.set(transferId, {
            from: (message && message.from) || fallbackPeerToken || "",
            totalChunks,
            received: 0,
            chunks: new Array(totalChunks),
            createdAt: now(),
        });
    }

    function handleRemoteFsChunkData(message, fallbackPeerToken) {
        const transferId = message && message.transferId ? String(message.transferId) : "";
        const index = Number(message && message.index);
        const chunk = message && typeof message.chunk === "string" ? message.chunk : "";
        if (!transferId || !Number.isFinite(index) || index < 0) return;
        const entry = incomingRemoteFsChunks.get(transferId);
        if (!entry) return;
        if (!entry.from) entry.from = (message && message.from) || fallbackPeerToken || "";
        if (index >= entry.totalChunks) return;
        if (entry.chunks[index] == null) {
            entry.chunks[index] = chunk;
            entry.received += 1;
        }
        if (entry.received < entry.totalChunks) return;

        incomingRemoteFsChunks.delete(transferId);
        const merged = entry.chunks.join("");
        const payload = safeJson(merged);
        if (!payload || typeof payload !== "object" || !payload.command) return;
        dispatchAppCommand(payload, entry.from || fallbackPeerToken);
    }

    async function mountPeerRemoteDrives(peerToken) {
        if (!peerToken) return [];
        let response = await requestRemoteFs(peerToken, "listDrives", {});
        let drives = response && Array.isArray(response.drives) ? response.drives : [];
        let mounts = fileSystem.getMounts ? fileSystem.getMounts() : {};
        let mountedPaths = [];

        for (let i = 0; i < drives.length; i += 1) {
            const remoteDrive = drives[i] || {};
            const remoteVolume = String(remoteDrive.volume || "").toLowerCase();
            if (!remoteVolume) continue;

            let existing = Object.values(mounts).find(
                (mount) => mount && mount.isRemoteNetworkMount && mount.peerToken === peerToken && mount.remoteVolume === remoteVolume
            );

            if (!existing) {
                const labelSuffix = remoteDrive.name ? ` - ${remoteDrive.name}` : ` - ${remoteVolume.toUpperCase()}`;
                const mountedDrive = {
                    type: "drive",
                    label: `${getPeerDisplayName(peerToken)}${labelSuffix}`,
                    name: `${getPeerDisplayName(peerToken)}${labelSuffix}`,
                    volume: "REMOTE",
                    handler: "remoteFileSystemAccess",
                    peerToken,
                    remoteVolume,
                    read: remoteDrive.read !== false,
                    write: remoteDrive.write !== false && remoteDrive.readOnly !== true,
                    readOnly: remoteDrive.write === false || remoteDrive.readOnly === true,
                    password: remoteDrive.password || "",
                    isRemoteNetworkMount: true,
                };
                await fileSystem.mount(mountedDrive);
                mounts = fileSystem.getMounts ? fileSystem.getMounts() : mounts;
                existing = Object.values(mounts).find(
                    (mount) => mount && mount.isRemoteNetworkMount && mount.peerToken === peerToken && mount.remoteVolume === remoteVolume
                );
            }

            if (existing && existing.path) mountedPaths.push(existing.path);
        }

        return mountedPaths;
    }

    function dispatchAppCommand(payload, fallbackPeerToken) {
        if (!payload || typeof payload !== "object") return;
        const message = { ...payload };
        if (!message.from && fallbackPeerToken) message.from = fallbackPeerToken;

        if (message.command === "network.remoteFs.chunk.start") {
            handleRemoteFsChunkStart(message, fallbackPeerToken);
            return;
        }

        if (message.command === "network.remoteFs.chunk.data") {
            handleRemoteFsChunkData(message, fallbackPeerToken);
            return;
        }

        if (message.command === "network.remoteFs.request") {
            handleRemoteFsRequest(message, fallbackPeerToken);
            return;
        }

        if (message.command === "network.remoteFs.response") {
            handleRemoteFsResponse(message);
            return;
        }

        if (message.command === "network.peerDisconnect") {
            const targetPeerToken = message.peerToken || message.from || fallbackPeerToken;
            if (targetPeerToken) {
                forgetPeer(targetPeerToken);
                removePeer(targetPeerToken);
                peerWindows.delete(targetPeerToken);
            }
            return;
        }

        if (message.command === "network.fileShare") {
            handleIncomingSharedFile(message, fallbackPeerToken);
            return;
        }

        if (message.command === "chat" && !networkChatAccessEnabled) {
            return;
        }

        if (message.command === "hello" && message.from) {
            return;
        }

        const app = message.command ? registeredApps[message.command] : null;
        if (app) {
            try {
                app(message);
            } catch (e) {
                console.error("Network app callback failed", e);
            }
        }
        emit("message", message);
    }

    function handleDataMessage(peerToken, rawData) {
        const text = typeof rawData === "string" ? rawData : "";
        const msg = safeJson(text);
        if (!msg || typeof msg !== "object") return;

        if (msg.t === "hello") {
            const remote = msg.from || {};
            const remoteToken = typeof remote.token === "string" ? remote.token : "";
            const name = typeof remote.name === "string" ? remote.name : "";
            const signalId = typeof remote.signalId === "string" ? remote.signalId : "";
            let activePeerToken = peerToken;
            if (remoteToken && remoteToken !== peerToken) {
                mergePeerIdentity(peerToken, remoteToken, { peerName: name, signalId });
                activePeerToken = remoteToken;
            }
            upsertPeer(activePeerToken, { peerName: name, signalId });
            rememberPeer(activePeerToken, name, signalId);
            return;
        }

        if (msg.t === "app" && msg.payload && typeof msg.payload === "object") {
            dispatchAppCommand(msg.payload, peerToken);
            return;
        }

        if (msg.t === "chat") {
            dispatchAppCommand(
                {
                    command: "chat",
                    message: msg.text || "",
                    from: (msg.from && msg.from.token) || peerToken,
                    displayName: (msg.from && msg.from.name) || "",
                    to: msg.to || "*",
                    ts: msg.ts || now(),
                },
                peerToken
            );
        }
    }

    function sendHello(peerToken) {
        const peer = peers.get(peerToken);
        if (!peer || !peer.dc || peer.dc.readyState !== "open") return;
        peer.dc.send(
            JSON.stringify({
                t: "hello",
                ts: now(),
                from: {
                    token: identity.clientToken,
                    name: identity.displayName || "",
                    signalId: localSignalId || "",
                },
            })
        );
    }

    function attachDataChannelLifecycle(peerToken, dc) {
        if (!dc) return;
        if (boundDataChannels.has(dc)) return;
        boundDataChannels.add(dc);
        dc.addEventListener("open", () => {
            const activePeerToken = dcToPeerToken.get(dc) || peerToken;
            upsertPeer(activePeerToken, { dataOpen: true });
            sendHello(activePeerToken);
            emit("peer.connected", { peerToken: activePeerToken });
        });
        dc.addEventListener("close", () => {
            const activePeerToken = dcToPeerToken.get(dc) || peerToken;
            upsertPeer(activePeerToken, { dataOpen: false });
            emit("peer.closed", { peerToken: activePeerToken });
        });
        dc.addEventListener("message", (ev) => {
            const activePeerToken = dcToPeerToken.get(dc) || peerToken;
            handleDataMessage(activePeerToken, ev.data);
        });
    }

    function sendSignal(to, payload) {
        if (!signalSocket || signalSocket.readyState !== WebSocket.OPEN) return false;
        signalSocket.send(
            JSON.stringify({
                t: "signal",
                from: localSignalId,
                to,
                payload,
                ts: now(),
            })
        );
        return true;
    }

    function registerTrickleSession(sessionId, peerToken, signalId, pc) {
        const existing = trickleSessions.get(sessionId);
        if (existing && existing.cleanupTimer) clearTimeout(existing.cleanupTimer);

        const session = {
            sessionId,
            peerToken,
            signalId: signalId || "",
            pc,
            remoteDescriptionSet: false,
            queuedIce: [],
            cleanupTimer: setTimeout(() => {
                trickleSessions.delete(sessionId);
            }, 2 * 60 * 1000),
        };
        trickleSessions.set(sessionId, session);
        return session;
    }

    async function flushQueuedIce(sessionId) {
        const session = trickleSessions.get(sessionId);
        if (!session || !session.remoteDescriptionSet || !session.queuedIce.length) return;
        const queue = session.queuedIce.splice(0, session.queuedIce.length);
        for (let i = 0; i < queue.length; i += 1) {
            try {
                await session.pc.addIceCandidate(queue[i]);
            } catch (_e) {}
        }
    }

    async function addRemoteIce(payload) {
        const sessionId = payload && payload.sessionId;
        const candidate = payload && payload.candidate;
        if (!sessionId || !candidate) return;
        const session = trickleSessions.get(sessionId);
        if (!session) return;
        if (!session.remoteDescriptionSet || !session.pc.remoteDescription) {
            session.queuedIce.push(candidate);
            return;
        }
        try {
            await session.pc.addIceCandidate(candidate);
        } catch (_e) {}
    }

    async function createOfferTrickle(targetSignalId, knownPeerToken) {
        const peerToken = knownPeerToken || `signal-${targetSignalId}`;
        const sessionId = randomToken(12);
        const pc = createPeerConnection();
        const dc = pc.createDataChannel("amibase", { ordered: true });

        pendingOutgoing.set(sessionId, {
            sessionId,
            pc,
            dc,
            peerToken,
            signalId: targetSignalId,
            createdAt: now(),
        });

        registerTrickleSession(sessionId, peerToken, targetSignalId, pc);

        upsertPeer(peerToken, {
            peerName: (knownPeers.get(peerToken) || {}).name || "",
            signalId: targetSignalId,
            pc,
            dc,
        });
        attachPeerLifecycle(peerToken, pc);
        attachDataChannelLifecycle(peerToken, dc);

        pc.addEventListener("icecandidate", (ev) => {
            if (!ev.candidate) return;
            sendSignal(targetSignalId, {
                kind: "ice",
                sessionId,
                candidate: ev.candidate.toJSON(),
            });
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        return {
            sessionId,
            offerObj: {
                v: 1,
                kind: "offer",
                trickle: true,
                sessionId,
                from: {
                    token: identity.clientToken,
                    name: identity.displayName || "",
                },
                sdp: pc.localDescription && pc.localDescription.sdp ? pc.localDescription.sdp : offer.sdp,
                createdAt: now(),
            },
        };
    }

    async function acceptOfferTrickle(fromSignalId, offerObj) {
        const sessionId = offerObj && offerObj.sessionId;
        if (!sessionId || !offerObj.sdp) return;
        const remote = offerObj.from || {};
        const peerToken = remote.token || `signal-${fromSignalId}`;
        const peerName = remote.name || "";

        const pc = createPeerConnection();
        let dc = null;

        registerTrickleSession(sessionId, peerToken, fromSignalId, pc);
        upsertPeer(peerToken, { peerName, signalId: fromSignalId, pc, dc });
        attachPeerLifecycle(peerToken, pc);

        pc.addEventListener("icecandidate", (ev) => {
            if (!ev.candidate) return;
            sendSignal(fromSignalId, {
                kind: "ice",
                sessionId,
                candidate: ev.candidate.toJSON(),
            });
        });

        pc.addEventListener("datachannel", (ev) => {
            dc = ev.channel;
            upsertPeer(peerToken, { dc, pc, peerName, signalId: fromSignalId });
            attachDataChannelLifecycle(peerToken, dc);
        });

        await pc.setRemoteDescription({ type: "offer", sdp: offerObj.sdp });
        const session = trickleSessions.get(sessionId);
        if (session) {
            session.remoteDescriptionSet = true;
            await flushQueuedIce(sessionId);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        return {
            answerObj: {
                v: 1,
                kind: "answer",
                trickle: true,
                sessionId,
                from: {
                    token: identity.clientToken,
                    name: identity.displayName || "",
                },
                sdp: pc.localDescription && pc.localDescription.sdp ? pc.localDescription.sdp : answer.sdp,
                createdAt: now(),
            },
        };
    }

    async function applyAnswerTrickle(fromSignalId, answerObj) {
        const sessionId = answerObj && answerObj.sessionId;
        if (!sessionId || !answerObj.sdp) return;
        const pending = pendingOutgoing.get(sessionId);
        if (!pending) return;

        const remote = answerObj.from || {};
        const peerToken = remote.token || pending.peerToken || `signal-${fromSignalId}`;
        const peerName = remote.name || "";

        const session = trickleSessions.get(sessionId) || registerTrickleSession(sessionId, peerToken, fromSignalId, pending.pc);
        session.peerToken = peerToken;
        session.signalId = fromSignalId;

        if (pending.peerToken && pending.peerToken !== peerToken) {
            mergePeerIdentity(pending.peerToken, peerToken, {
                peerName,
                signalId: fromSignalId,
                pc: pending.pc,
                dc: pending.dc,
            });
        }

        pendingOutgoing.delete(sessionId);
        upsertPeer(peerToken, {
            pc: pending.pc,
            dc: pending.dc,
            signalId: fromSignalId,
            peerName,
        });
        attachPeerLifecycle(peerToken, pending.pc);
        attachDataChannelLifecycle(peerToken, pending.dc);

        await pending.pc.setRemoteDescription({ type: "answer", sdp: answerObj.sdp });
        session.remoteDescriptionSet = true;
        await flushQueuedIce(sessionId);
    }


    async function createInviteToken() {
        const sessionId = randomToken(12);
        const pc = createPeerConnection();
        const dc = pc.createDataChannel("amibase", { ordered: true });

        pendingOutgoing.set(sessionId, {
            sessionId,
            pc,
            dc,
            peerToken: `manual-${sessionId}`,
            signalId: "",
            createdAt: now(),
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const candidates = await waitForIceGathering(pc, 3500);

        return {
            sessionId,
            tokenText: encodeToken({
                v: 1,
                kind: "offer",
                sessionId,
                from: {
                    token: identity.clientToken,
                    name: identity.displayName || "",
                },
                sdp: pc.localDescription && pc.localDescription.sdp ? pc.localDescription.sdp : offer.sdp,
                candidates,
                createdAt: now(),
            }),
        };
    }

    async function acceptOffer(offerObj) {
        const sessionId = offerObj.sessionId;
        const remote = offerObj.from || {};
        const peerToken = remote.token || `manual-${sessionId}`;
        const peerName = remote.name || "";

        const pc = createPeerConnection();
        let dc = null;

        pc.addEventListener("datachannel", (ev) => {
            dc = ev.channel;
            upsertPeer(peerToken, { pc, dc, peerName });
            attachDataChannelLifecycle(peerToken, dc);
        });

        upsertPeer(peerToken, { pc, dc, peerName });
        attachPeerLifecycle(peerToken, pc);

        await pc.setRemoteDescription({ type: "offer", sdp: offerObj.sdp });
        await addIceCandidates(pc, offerObj.candidates);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const candidates = await waitForIceGathering(pc, 3500);

        return {
            result: "answerGenerated",
            peerToken,
            responseToken: encodeToken({
                v: 1,
                kind: "answer",
                sessionId,
                from: {
                    token: identity.clientToken,
                    name: identity.displayName || "",
                },
                sdp: pc.localDescription && pc.localDescription.sdp ? pc.localDescription.sdp : answer.sdp,
                candidates,
                createdAt: now(),
            }),
        };
    }

    async function applyAnswer(answerObj) {
        const sessionId = answerObj.sessionId;
        const pending = pendingOutgoing.get(sessionId);
        if (!pending) throw new Error("No pending invite for that session.");

        const remote = answerObj.from || {};
        const peerToken = remote.token || pending.peerToken || `manual-${sessionId}`;
        const peerName = remote.name || "";

        pendingOutgoing.delete(sessionId);
        upsertPeer(peerToken, {
            pc: pending.pc,
            dc: pending.dc,
            peerName,
        });
        attachPeerLifecycle(peerToken, pending.pc);
        attachDataChannelLifecycle(peerToken, pending.dc);

        await pending.pc.setRemoteDescription({ type: "answer", sdp: answerObj.sdp });
        await addIceCandidates(pending.pc, answerObj.candidates);
        rememberPeer(peerToken, peerName, "");
        return {
            result: "answerApplied",
            peerToken,
        };
    }

    async function processToken(tokenText) {
        const obj = decodeToken(tokenText);
        if (!obj || obj.v !== 1 || !obj.kind || !obj.sessionId || !obj.sdp) {
            throw new Error("Invalid token payload.");
        }
        if (obj.kind === "offer") return acceptOffer(obj);
        if (obj.kind === "answer") return applyAnswer(obj);
        throw new Error("Unsupported token kind.");
    }

    function disconnectPeer(peerToken) {
        const peer = peers.get(peerToken);
        if (!peer) {
            forgetPeer(peerToken);
            removePeerDesktopIcon(peerToken);
            return;
        }
        const aliasPeers = Array.from(peers.values())
            .filter((item) => {
                if (!item) return false;
                if (item.peerToken === peerToken) return true;
                if (peer.pc && item.pc && item.pc === peer.pc) return true;
                if (peer.dc && item.dc && item.dc === peer.dc) return true;
                return false;
            });
        const aliasTokens = aliasPeers.map((item) => item.peerToken);
        const aliasSignalIds = Array.from(new Set(aliasPeers.map((item) => String(item.signalId || "")).filter(Boolean)));

        try {
            // Tell the remote peer explicitly so it removes our icon immediately.
            me.sendApp({
                command: "network.peerDisconnect",
                to: peerToken,
                peerToken: identity.clientToken,
            });
        } catch (_e) {}

        try {
            if (peer.dc) peer.dc.close();
        } catch (_e) {}
        try {
            if (peer.pc) peer.pc.close();
        } catch (_e) {}
        aliasTokens.forEach((token) => {
            peers.delete(token);
            forgetPeer(token);
            removePeerDesktopIcon(token);
            peerWindows.delete(token);
        });
        aliasSignalIds.forEach((signalId) => {
            forgetPeersBySignalId(signalId);
        });
        notifyPeersChanged();
    }

    function disconnectAll() {
        peersSnapshot().forEach((peer) => disconnectPeer(peer.peerToken));
    }

    function signalPathCandidates() {
        if (!relayDomain) return [];
        return [`wss://${relayDomain}/ws`, `wss://${relayDomain}`];
    }

    function connectSignaling() {
        if (!networkEnabled) return;
        if (!relayDomain) {
            setSignalStatus(SIGNAL_STATUS.UNSUPPORTED, "No relay configured");
            return;
        }
        if (!localSignalId) {
            localSignalId = globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : `sig-${randomToken(10)}`;
        }
        const candidates = signalPathCandidates();
        if (!candidates.length) {
            setSignalStatus(SIGNAL_STATUS.UNSUPPORTED, "No relay configured");
            return;
        }
        signalPathIndex = signalPathIndex % candidates.length;
        signalUrl = candidates[signalPathIndex];

        if (signalSocket && (signalSocket.readyState === WebSocket.OPEN || signalSocket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        setSignalStatus(SIGNAL_STATUS.CONNECTING, signalUrl);
        console.log("signalUrl",signalUrl);
        signalSocket = new WebSocket(signalUrl);

        signalSocket.addEventListener("open", () => {
            console.debug("[signal] open", signalUrl);
            signalRetryMs = 600;
            setSignalStatus(SIGNAL_STATUS.CONNECTED, signalUrl);
            signalSocket.send(
                JSON.stringify({
                    t: "hello",
                    id: localSignalId,
                    token: identity.clientToken,
                    name: identity.displayName || "",
                    discoverable: isDiscoveryAllowed(),
                    ts: now(),
                })
            );
        });

        signalSocket.addEventListener("message", async (event) => {
            const msg = safeJson(typeof event.data === "string" ? event.data : "");
            if (!msg || typeof msg !== "object") return;

            if (msg.requestId && pendingRelayRequests.has(msg.requestId)) {
                const pending = pendingRelayRequests.get(msg.requestId);
                pendingRelayRequests.delete(msg.requestId);
                clearTimeout(pending.timer);
                if (msg.t === "invite.error") {
                    pending.reject(new Error(msg.error || "invite_request_failed"));
                } else {
                    pending.resolve(msg);
                }
                return;
            }

            if (msg.t === "peers" && Array.isArray(msg.peers)) {
                discoveredPeers = msg.peers
                    .filter((peer) => peer && peer.id && peer.id !== localSignalId && peer.token !== identity.clientToken && peer.discoverable !== false)
                    .map((peer) => ({
                        id: peer.id,
                        token: peer.token || "",
                        name: peer.name || "",
                    }));
                emit("discovered.changed", discoveredPeers.slice());
                maybeReconnectKnownPeers();
                return;
            }

            if (msg.t === "signal" && msg.payload) {
                const from = msg.from || "";
                const payload = msg.payload;
                try {
                    if (payload.kind === "offer") {
                        const result = await acceptOfferTrickle(from, payload);
                        if (result && result.answerObj) sendSignal(from, result.answerObj);
                        return;
                    }
                    if (payload.kind === "answer") {
                        await applyAnswerTrickle(from, payload);
                        return;
                    }
                    if (payload.kind === "ice") {
                        await addRemoteIce(payload);
                    }
                } catch (e) {
                    console.error("Signal handling failed", e);
                }
                return;
            }

            if (msg.command) {
                dispatchAppCommand(msg);
            }
        });

        signalSocket.addEventListener("close", (ev) => {
            console.warn("[signal] close", signalUrl, {
                code: ev.code,
                reason: ev.reason,
                wasClean: ev.wasClean,
            });
            signalSocket = null;
            clearPendingRelayRequests("relay_disconnected");
            setSignalStatus(SIGNAL_STATUS.DISCONNECTED, "closed");
            scheduleSignalReconnect();
        });

        signalSocket.addEventListener("error", (ev) => {
            console.warn("[signal] error", signalUrl, ev);
            signalPathIndex = (signalPathIndex + 1) % signalPathCandidates().length;
        });
    }

    function scheduleSignalReconnect() {
        if (!networkEnabled) return;
        if (signalRetryTimer) return;
        signalRetryMs = Math.min(5000, Math.floor(signalRetryMs * 1.5));
        signalRetryTimer = setTimeout(() => {
            signalRetryTimer = null;
            connectSignaling();
        }, signalRetryMs);
    }

    function maybeReconnectKnownPeers() {
        if (!discoveredPeers.length) return;
        const connected = new Set(peersSnapshot().filter((p) => p.connected || p.dataOpen).map((p) => p.peerToken));
        discoveredPeers.forEach((peer) => {
            if (!peer.token) return;
            if (!knownPeers.has(peer.token)) return;
            if (connected.has(peer.token)) return;

            const cooldown = reconnectCooldown.get(peer.token) || 0;
            if (cooldown > now()) return;
            reconnectCooldown.set(peer.token, now() + 10000);
            me.connectDiscoveredPeer(peer.id, peer.token).catch((err) => {
                console.warn("Auto reconnect failed", err);
            });
        });
    }

    function clearPendingRelayRequests(errorMessage) {
        pendingRelayRequests.forEach((pending, requestId) => {
            clearTimeout(pending.timer);
            pending.reject(new Error(errorMessage || "relay_disconnected"));
            pendingRelayRequests.delete(requestId);
        });
    }

    function sendRelayRequest(type, payload, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            if (!signalSocket || signalSocket.readyState !== WebSocket.OPEN) {
                reject(new Error("relay_not_connected"));
                return;
            }
            const requestId = randomToken(10);
            const timer = setTimeout(() => {
                pendingRelayRequests.delete(requestId);
                reject(new Error("relay_request_timeout"));
            }, timeoutMs);
            pendingRelayRequests.set(requestId, { resolve, reject, timer });
            signalSocket.send(
                JSON.stringify({
                    t: type,
                    requestId,
                    ...(payload || {}),
                })
            );
        });
    }

    async function waitForRelayConnected(timeoutMs = 15000) {
        if (signalSocket && signalSocket.readyState === WebSocket.OPEN) return true;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (unsub) unsub();
                reject(new Error("relay_not_connected"));
            }, timeoutMs);
            const unsub = me.on("status", (state) => {
                if (state && state.status === SIGNAL_STATUS.CONNECTED) {
                    clearTimeout(timer);
                    unsub();
                    resolve(true);
                }
            });
            connectSignaling();
        });
    }

    async function checkClientTokenUnique(token) {
        const clean = String(token || "").trim();
        if (!clean) throw new Error("invalid_token");
        if (!relayDomain) {
            return { unique: true, checked: false, reason: "relay_disabled" };
        }
        await waitForRelayConnected();
        const response = await sendRelayRequest("token.check", {
            token: clean,
            currentToken: identity.clientToken || "",
        }, 10000);
        if (!response || response.t === "token.error") {
            throw new Error((response && response.error) || "token_check_failed");
        }
        return {
            unique: response.unique !== false,
            checked: true,
            token: clean,
        };
    }

    function buildInviteUrl(code) {
        const url = new URL(window.location.href);
        url.searchParams.set("invite", String(code || ""));
        return url.toString();
    }

    async function createConnectInvitation() {
        await waitForRelayConnected();
        const response = await sendRelayRequest("invite.create", {}, 10000);
        if (!response || !response.code) throw new Error("invite_create_failed");
        return {
            code: response.code,
            expiresAt: response.expiresAt || now() + 5 * 60 * 1000,
            inviteUrl: buildInviteUrl(response.code),
        };
    }

    async function connectByInviteCode(code) {
        const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);
        if (cleanCode.length !== 6) throw new Error("invalid_invite_code");
        await waitForRelayConnected();
        const response = await sendRelayRequest("invite.resolve", { code: cleanCode }, 10000);
        const signalId = response && response.signalId ? String(response.signalId) : "";
        if (!signalId) throw new Error("invite_resolve_failed");
        if (signalId === localSignalId) throw new Error("invite_points_to_self");
        await me.connectDiscoveredPeer(signalId, `signal-${signalId}`);
        return {
            code: cleanCode,
            signalId,
            expiresAt: response.expiresAt || now() + 5 * 60 * 1000,
        };
    }

    async function connectFromUrlInvite() {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("invite");
        if (!code) return false;
        const cleanCode = String(code).replace(/\D/g, "").slice(0, 6);
        if (cleanCode.length !== 6) return false;
        try {
            await connectByInviteCode(cleanCode);
            url.searchParams.delete("invite");
            window.history.replaceState({}, "", url.toString());
            return true;
        } catch (e) {
            console.error("Auto connect from invite failed", e);
            return false;
        }
    }

    function triggerDownload(item) {
        const bytes = base64ToBytes(item.dataBase64 || "");
        const blob = new Blob([bytes], { type: item.mimeType || "application/octet-stream" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = item.name || "file";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 3000);
    }

    async function sendSharedFileToPeer(peerToken, fileObj) {
        if (!peerToken || !fileObj) return false;
        const peer = peers.get(peerToken);
        if (!peer || !peer.dc || peer.dc.readyState !== "open") return false;

        const fileLike = fileObj.object && fileObj.object.isAmiObject ? fileObj.object : fileObj;
        if (!fileLike || fileLike.type !== "file") return false;

        const content = await fileSystem.readFile(fileLike, true);
        let bytes = null;
        if (content instanceof Uint8Array) bytes = content;
        else if (content && content.buffer instanceof ArrayBuffer) bytes = new Uint8Array(content.buffer);
        else if (content instanceof ArrayBuffer) bytes = new Uint8Array(content);
        if (!bytes) return false;

        const payload = {
            command: "network.fileShare",
            from: identity.clientToken,
            displayName: identity.displayName || "",
            to: peerToken,
            file: {
                id: randomToken(8),
                name: fileLike.name || "file.bin",
                mimeType: fileLike.mimeType || "application/octet-stream",
                size: bytes.byteLength,
                dataBase64: bytesToBase64(bytes),
                ts: now(),
                fromToken: identity.clientToken,
                fromName: identity.displayName || "",
            },
        };

        const sent = me.sendApp(payload);
        if (!sent) return false;

        await remoteFs.storePeerSharedFileInRam(peerToken, payload.file);
        addSharedFile(peerToken, {
            ...payload.file,
            direction: "out",
        });
        const info = peerWindows.get(peerToken);
        if (info && info.window && info.window.sendMessage) info.window.sendMessage("refresh");
        return true;
    }

    function handleIncomingSharedFile(payload, fallbackPeerToken) {
        const file = payload && payload.file;
        const peerToken = payload && payload.from ? payload.from : fallbackPeerToken;
        if (!file || !peerToken) return;
        if (!file.name || !file.dataBase64) return;
        remoteFs.storePeerSharedFileInRam(peerToken, file).then(() => {
            const info = peerWindows.get(peerToken);
            if (info && info.window && info.window.sendMessage) info.window.sendMessage("refresh");
        });
        addSharedFile(peerToken, {
            id: file.id || randomToken(8),
            name: file.name,
            mimeType: file.mimeType || "application/octet-stream",
            size: file.size || 0,
            dataBase64: file.dataBase64,
            ts: file.ts || now(),
            direction: "in",
            fromToken: file.fromToken || peerToken,
            fromName: file.fromName || getPeerDisplayName(peerToken),
        });
        desktop.showNotification({
            label: "File received",
            text: `${file.name} from ${file.fromName || getPeerDisplayName(peerToken)}`,
            autoHide: true,
        });
    }

    let eventLoggerWindow = null;

    async function openEventLogger() {
        if (eventLoggerWindow && eventLoggerWindow.activate) {
            eventLoggerWindow.activate();
            return eventLoggerWindow;
        }
        const loggerWindow = await system.launchProgram({
            url: "plugin:eventlogger",
            width: 680,
            height: 380,
        });
        const previousOnClose = loggerWindow.onClose;
        loggerWindow.onClose = () => {
            if (typeof previousOnClose === "function") previousOnClose();
            eventLoggerWindow = null;
        };
        eventLoggerWindow = loggerWindow;
        return loggerWindow;
    }

    function openChatWithPeer(peerToken) {
        system.launchProgram({
            url: "plugin:chat",
            width: 360,
            height: 420,
        }).then((chatWindow) => {
            chatWindow.sendMessage("startChatWith", { peerToken });
        });
    }

    async function openPeerWindow(peerToken) {
        if (!peerToken) return;
        const existing = peerWindows.get(peerToken);
        if (existing && existing.window && existing.window.activate) {
            existing.window.activate();
            existing.window.sendMessage("refresh");
            return;
        }
        const peerName = getPeerDisplayName(peerToken);
        let mountedPaths = [];
        try {
            mountedPaths = await mountPeerRemoteDrives(peerToken);
        } catch (e) {
            console.error("Failed to mount remote peer drives", e);
            desktop.showError(`Unable to load remote drives from ${peerName}`, true);
        }

        const w = await system.launchProgram({
            url: "plugin:filemanager",
            width: 680,
            height: 460,
        });
        w.setCaption(`Peer: ${peerName}`);
        if (mountedPaths.length) {
            w.sendMessage("openFolder", {
                type: "folder",
                name: `Peer ${peerName}`,
                path: mountedPaths[0],
            });
        } else {
            await remoteFs.ensurePeerFolder(peerToken);
            w.sendMessage("hideSideBar");
            w.sendMessage("openFolder", {
                type: "folder",
                name: `Peer ${peerName}`,
                path: remoteFs.peerFolderPath(peerToken),
            });
        }

        w.onClose = () => {
            peerWindows.delete(peerToken);
        };
        peerWindows.set(peerToken, { window: w });
    }

    me.init = async () => {
        if (initDone) return;
        initDone = true;

        let settings = (await user.getAmiSettings()) || {};
        const networkSettings = settings.network || {};
        const networkConfig = (await user.getSetting("networkConfig", false)) || {};
        networkEnabled = networkConfig.enabled !== false;
        networkFileAccessEnabled = networkConfig.fileAccessEnabled !== false;
        networkAllowDiscoveryEnabled = networkConfig.allowDiscovery !== false;
        networkChatAccessEnabled = networkConfig.chatAccessEnabled !== false;
        networkTrustedAccessEnabled = networkConfig.trustedAccessEnabled !== false;
        networkDriveAccess = normalizeDriveAccessConfig(networkConfig.driveAccess || []);
        relayDomain = networkConfig.relay !== undefined
            ? networkConfig.relay
            : (networkSettings.relay || DEFAULT_RELAY_DOMAIN);
        if (networkConfig.iceServers && networkConfig.iceServers.length) {
            iceServers = networkConfig.iceServers;
        }

        const storedIdentity = (await user.getSetting(STORAGE_KEYS.IDENTITY, false)) || {};
        identity.clientToken = storedIdentity.clientToken || randomToken(18);
        identity.displayName = storedIdentity.displayName || "";
        identity.chatDisplayName = storedIdentity.chatDisplayName || identity.displayName || "";
        identity.createdAt = storedIdentity.createdAt || now();
        persistIdentity();

        const storedPeers = (await user.getSetting(STORAGE_KEYS.KNOWN_PEERS, false)) || [];
        if (Array.isArray(storedPeers)) {
            storedPeers.forEach((peer) => {
                if (peer && peer.token) {
                    knownPeers.set(peer.token, {
                        token: peer.token,
                        name: peer.name || "",
                        lastConnectedAt: peer.lastConnectedAt || 0,
                        lastSignalId: peer.lastSignalId || "",
                    });
                }
            });
        }

        const storedPeerFiles = (await user.getSetting(STORAGE_KEYS.PEER_FILES, false)) || {};
        if (storedPeerFiles && typeof storedPeerFiles === "object") {
            Object.keys(storedPeerFiles).forEach((peerToken) => {
                const list = Array.isArray(storedPeerFiles[peerToken]) ? storedPeerFiles[peerToken] : [];
                sharedFilesByPeer.set(
                    peerToken,
                    list.map((item) => ({
                        id: item.id || randomToken(8),
                        name: item.name || "file.bin",
                        mimeType: item.mimeType || "application/octet-stream",
                        size: item.size || 0,
                        dataBase64: item.dataBase64 || "",
                        ts: item.ts || now(),
                        direction: item.direction || "in",
                        fromToken: item.fromToken || "",
                        fromName: item.fromName || "",
                    }))
                );
            });
        }

        setSignalStatus(SIGNAL_STATUS.DISCONNECTED, "");
        if (networkEnabled) connectSignaling();
    };

    me.register = (appName, handler) => {
        registeredApps[appName] = handler;
    };

    me.unregister = (appName) => {
        delete registeredApps[appName];
    };

    me.on = on;
    me.getEventHistory = () => eventHistory.slice();
    me.getIdentity = () => ({ ...identity });
    me.setDisplayName = (name) => {
        const clean = (name || "").trim().slice(0, 60);
        identity.displayName = clean;
        persistIdentity();
        announceIdentityToSignaling();
        announceIdentityToPeers();
        emit("identity.changed", { ...identity });
        return { ...identity };
    };
    me.setClientToken = (token) => {
        const clean = String(token || "").trim().slice(0, 120);
        if (!clean) throw new Error("invalid_token");
        identity.clientToken = clean;
        persistIdentity();
        announceIdentityToSignaling();
        announceIdentityToPeers();
        emit("identity.changed", { ...identity });
        return { ...identity };
    };
    me.checkClientTokenUnique = checkClientTokenUnique;
    me.setChatDisplayName = (name) => {
        const clean = (name || "").trim().slice(0, 60);
        identity.chatDisplayName = clean;
        persistIdentity();
        emit("identity.changed", { ...identity });
        return { ...identity };
    };
    me.getSignalStatus = () => signalStatus;
    me.getDiscoveredPeers = () => discoveredPeers.slice();
    me.getPeers = () => peersSnapshot();

    me.send = (message, toPeerToken) => {
        let payload = message;
        if (typeof payload === "string") {
            payload = {
                command: "message",
                message: payload,
            };
        }
        if (!payload || typeof payload !== "object") return false;
        const commandPayload = {
            ...payload,
            from: identity.clientToken,
            displayName: payload.displayName || identity.displayName || "",
            ts: payload.ts || now(),
        };
        if (toPeerToken) commandPayload.to = toPeerToken;
        return me.sendApp(commandPayload);
    };

    me.sendApp = (payload) => {
        if (!payload || typeof payload !== "object") return false;
        const to = payload.to || "*";
        const packet = JSON.stringify({
            t: "app",
            from: {
                token: identity.clientToken,
                name: identity.displayName || "",
            },
            payload,
            ts: now(),
        });

        let sent = false;
        if (to && to !== "*") {
            const peer = peers.get(to);
            if (peer && peer.dc && peer.dc.readyState === "open") {
                peer.dc.send(packet);
                sent = true;
            }
        } else {
            peers.forEach((peer) => {
                if (peer.dc && peer.dc.readyState === "open") {
                    peer.dc.send(packet);
                    sent = true;
                }
            });
        }

        if (!sent && signalSocket && signalSocket.readyState === WebSocket.OPEN) {
            signalSocket.send(JSON.stringify(payload));
            sent = true;
        }
        return sent;
    };

    me.sendChat = (text, toPeerToken) => {
        const clean = (text || "").trim();
        if (!clean) return false;
        if (!networkChatAccessEnabled) return false;
        return me.send({
            command: "chat",
            message: clean,
            to: toPeerToken || "*",
            displayName: identity.chatDisplayName || identity.displayName || "",
        });
    };

    me.connectDiscoveredPeer = async (signalId, tokenHint) => {
        if (!signalId) return false;
        const { offerObj } = await createOfferTrickle(signalId, tokenHint || `signal-${signalId}`);
        return sendSignal(signalId, offerObj);
    };
    me.createConnectInvitation = createConnectInvitation;
    me.connectByInviteCode = connectByInviteCode;
    me.connectFromUrlInvite = connectFromUrlInvite;
    me.reconnect = connectSignaling;

    me.requestRemoteFileSystem = (peerToken, operation, payload, timeoutMs) =>
        requestRemoteFs(peerToken, operation, payload, timeoutMs);

    me.mountPeerRemoteDrives = (peerToken) => mountPeerRemoteDrives(peerToken);

    me.disconnectPeer = disconnectPeer;
    me.disconnectAll = disconnectAll;

    me.createInviteToken = async () => {
        const data = await createInviteToken();
        return data.tokenText;
    };

    me.processToken = processToken;
    me.openEventLogger = openEventLogger;

    me.openManagerWindow = () => {
        if (managerWindow && managerWindow.activate) {
            managerWindow.activate();
            return managerWindow;
        }
        return system
            .launchProgram({
                url: "plugin:networkmanager",
                width: 540,
                height: 460,
                left: 170,
                top: 70,
            })
            .then((windowHandle) => {
                const previousOnClose = windowHandle.onClose;
                windowHandle.onClose = () => {
                    if (typeof previousOnClose === "function") previousOnClose();
                    managerWindow = null;
                };
                managerWindow = windowHandle;
                return windowHandle;
            });
    };

    me.isEnabled = () => networkEnabled;

    me.setEnabled = (enabled) => {
        networkEnabled = !!enabled;
        if (!networkEnabled) {
            if (signalRetryTimer) {
                clearTimeout(signalRetryTimer);
                signalRetryTimer = null;
            }
            if (signalSocket) {
                try { signalSocket.close(); } catch (_e) {}
            }
            setSignalStatus(SIGNAL_STATUS.DISCONNECTED, "Network disabled");
        } else {
            connectSignaling();
        }
    };

    me.isFileAccessEnabled = () => networkFileAccessEnabled;

    me.setFileAccessEnabled = (enabled) => {
        networkFileAccessEnabled = enabled !== false;
        announceIdentityToSignaling();
    };

    me.isDiscoveryAllowed = () => networkAllowDiscoveryEnabled;

    me.setDiscoveryAllowed = (enabled) => {
        networkAllowDiscoveryEnabled = enabled !== false;
        announceIdentityToSignaling();
    };

    me.isChatAccessEnabled = () => networkChatAccessEnabled;

    me.setChatAccessEnabled = (enabled) => {
        networkChatAccessEnabled = enabled !== false;
    };

    me.isTrustedAccessEnabled = () => networkTrustedAccessEnabled;

    me.setTrustedAccessEnabled = (enabled) => {
        networkTrustedAccessEnabled = enabled !== false;
    };

    me.setRelayDomain = (domain) => {
        relayDomain = (domain || "").trim();
    };

    me.setIceServers = (servers) => {
        iceServers = Array.isArray(servers) && servers.length ? servers : ICE_SERVERS;
    };

    me.getDriveAccessConfig = () => networkDriveAccess.map((item) => ({ ...item }));

    me.setDriveAccessConfig = (items) => {
        networkDriveAccess = normalizeDriveAccessConfig(items);
        return me.getDriveAccessConfig();
    };

    me.getDefaults = () => ({
        relay: DEFAULT_RELAY_DOMAIN,
        iceServers: ICE_SERVERS,
    });

    me.getNetworkConfig = () => ({
        enabled: networkEnabled,
        fileAccessEnabled: networkFileAccessEnabled,
        allowDiscovery: networkAllowDiscoveryEnabled,
        chatAccessEnabled: networkChatAccessEnabled,
        trustedAccessEnabled: networkTrustedAccessEnabled,
        driveAccess: me.getDriveAccessConfig(),
        relay: relayDomain,
        iceServers: iceServers,
    });

    me.saveNetworkConfig = (config) => {
        user.storeSetting("networkConfig", config, false);
    };

    return me;
};

export default Network();