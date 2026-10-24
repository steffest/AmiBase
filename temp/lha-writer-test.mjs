import {writeFile} from "node:fs/promises";
import {encodeLha} from "../plugins/archiver/lha/lhaWriter.js";
import {extractAll} from "../plugins/archiver/libArchive/archive.mjs";

const archiveBuffer = encodeLha([
    { path: "hello.txt", data: "hello from lha" },
    { path: "folder/nested.bin", data: new Uint8Array([1, 2, 3, 4, 5]) }
]);

await writeFile("/tmp/amibase-test.lha", Buffer.from(archiveBuffer));

const entries = extractAll(new Uint8Array(archiveBuffer));
console.log("entries:", entries.map(e => ({ path: e.path, type: e.type, size: Number(e.size) })));

const hello = entries.find(e => e.path === "hello.txt");
if (!hello) throw new Error("Missing hello.txt");
const helloText = new TextDecoder().decode(hello.data);
if (helloText !== "hello from lha") throw new Error("Unexpected hello.txt content: " + helloText);

const nested = entries.find(e => e.path === "folder/nested.bin");
if (!nested) throw new Error("Missing folder/nested.bin");
if (nested.data.byteLength !== 5) throw new Error("Unexpected nested size: " + nested.data.byteLength);

console.log("LHA writer test passed");

