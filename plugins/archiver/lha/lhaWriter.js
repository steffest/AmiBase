// Minimal LHA writer (LH0 only, no compression).
// Produces archives readable by common tools for simple file payloads.

function toBytes(input) {
    if (!input) return new Uint8Array(0);
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (typeof input === "string") return new TextEncoder().encode(input);
    if (input.buffer instanceof ArrayBuffer) {
        const offset = input.byteOffset || 0;
        const length = typeof input.byteLength === "number" ? input.byteLength : input.buffer.byteLength;
        return new Uint8Array(input.buffer.slice(offset, offset + length));
    }
    return new Uint8Array(0);
}

function crc16(data) {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 1) crc = (crc >>> 1) ^ 0xA001;
            else crc >>>= 1;
        }
    }
    return crc & 0xFFFF;
}

function toDosDateTime(date) {
    const d = date || new Date();
    const year = Math.max(1980, d.getFullYear());
    const datePart = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const timePart = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    return ((datePart << 16) | timePart) >>> 0;
}

function normalizePath(path) {
    let p = (path || "").replace(/\\/g, "/");
    while (p.startsWith("/")) p = p.substring(1);
    return p;
}

function writeUint32LE(bytes, offset, value) {
    bytes[offset] = value & 0xFF;
    bytes[offset + 1] = (value >>> 8) & 0xFF;
    bytes[offset + 2] = (value >>> 16) & 0xFF;
    bytes[offset + 3] = (value >>> 24) & 0xFF;
}

function writeUint16LE(bytes, offset, value) {
    bytes[offset] = value & 0xFF;
    bytes[offset + 1] = (value >>> 8) & 0xFF;
}

function encodeEntry(path, content, modifiedAt) {
    const name = normalizePath(path);
    const nameBytes = new TextEncoder().encode(name);
    if (nameBytes.length > 255) {
        throw new Error("LHA path too long for level-0 header: " + name);
    }

    const data = toBytes(content);
    const headerSize = 22 + nameBytes.length;
    const total = 2 + headerSize + data.length;
    const out = new Uint8Array(total);

    // Size/checksum prefix.
    out[0] = headerSize;

    // Header starts at index 2 for level-0 LHA.
    out.set(new TextEncoder().encode("-lh0-"), 2);
    writeUint32LE(out, 7, data.length); // compressed size (LH0 == stored)
    writeUint32LE(out, 11, data.length); // original size
    writeUint32LE(out, 15, toDosDateTime(modifiedAt));
    out[19] = 0x20; // file attribute
    out[20] = 0x00; // header level 0
    out[21] = nameBytes.length;
    out.set(nameBytes, 22);
    writeUint16LE(out, 22 + nameBytes.length, crc16(data));

    // Header checksum is sum of header bytes after checksum field.
    let sum = 0;
    for (let i = 2; i < 2 + headerSize; i++) sum = (sum + out[i]) & 0xFF;
    out[1] = sum;

    // File payload.
    out.set(data, 2 + headerSize);

    return out;
}

export function encodeLha(entries, options) {
    const list = entries || [];
    const parts = [];
    let size = 0;

    list.forEach(entry => {
        if (!entry || !entry.path) return;
        const encoded = encodeEntry(entry.path, entry.data, entry.modifiedAt || (options && options.modifiedAt));
        parts.push(encoded);
        size += encoded.length;
    });

    // Archive terminator: zero header-size byte.
    size += 1;

    const out = new Uint8Array(size);
    let offset = 0;
    parts.forEach(part => {
        out.set(part, offset);
        offset += part.length;
    });
    out[offset] = 0;

    return out.buffer;
}

export function encodeLhaFromMap(fileMap, options) {
    const entries = [];
    Object.keys(fileMap || {}).forEach(path => {
        if (!path || path.endsWith("/")) return;
        entries.push({ path, data: fileMap[path] });
    });
    return encodeLha(entries, options);
}

