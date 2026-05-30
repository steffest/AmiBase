export const DEFAULT_RELAY_DOMAIN = "relay.amibase.com";
export const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

export const SIGNAL_STATUS = {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    UNSUPPORTED: "unsupported",
};

export const STORAGE_KEYS = {
    IDENTITY: "networkIdentity",
    KNOWN_PEERS: "networkKnownPeers",
    PEER_FILES: "networkPeerFiles",
};

export const REMOTE_FS_REQUEST_TIMEOUT = 20000;
export const EVENT_LOG_LIMIT = 500;
export const REMOTE_FS_MAX_PACKET_CHARS = 48000;

export function now() {
    return Date.now();
}

export function base64UrlEncodeBytes(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function randomToken(byteLength = 18) {
    const bytes = new Uint8Array(byteLength);
    if (globalThis.crypto && globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < byteLength; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    return base64UrlEncodeBytes(bytes);
}

export function shortId(token) {
    return (token || "").slice(0, 10);
}

export function safeJson(text) {
    try {
        return JSON.parse(text);
    } catch (_e) {
        return null;
    }
}

export function escapeHtml(text) {
    return (text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

export function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

export function base64ToBytes(base64) {
    const binary = atob(base64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export function binaryToBase64(content) {
    if (!content) return "";
    if (content instanceof Uint8Array) return bytesToBase64(content);
    if (content instanceof ArrayBuffer) return bytesToBase64(new Uint8Array(content));
    if (content.buffer instanceof ArrayBuffer) {
        if (typeof content.byteLength === "number" && typeof content.byteOffset === "number") {
            return bytesToBase64(new Uint8Array(content.buffer, content.byteOffset, content.byteLength));
        }
        return bytesToBase64(new Uint8Array(content.buffer));
    }
    return "";
}

export function base64UrlDecodeToBytes(b64url) {
    const b64 = (b64url || "").replaceAll("-", "+").replaceAll("_", "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export function encodeToken(obj) {
    return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

export function decodeToken(tokenText) {
    const clean = (tokenText || "").trim().replaceAll(/\s+/g, "");
    if (!clean) throw new Error("Empty token.");
    return JSON.parse(new TextDecoder().decode(base64UrlDecodeToBytes(clean)));
}

