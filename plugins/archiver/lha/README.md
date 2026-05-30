# LHA Writer (LH0)

Small standalone LHA writer for AmiBase.

- Format: LHA level-0 headers
- Method: `-lh0-` (stored/no compression)
- Scope: write support for simple file archives

## API

- `encodeLha(entries, options?) -> ArrayBuffer`
- `encodeLhaFromMap(fileMap, options?) -> ArrayBuffer`

`entries` format:

```js
[
  { path: "hello.txt", data: "text or bytes", modifiedAt: new Date() }
]
```

`fileMap` format:

```js
{
  "hello.txt": "text",
  "folder/file.bin": new Uint8Array([1, 2, 3])
}
```

## Quick Test

Run:

```bash
node /Users/stef/Dropbox/www/AmiBase/temp/lha-writer-test.mjs
```

This writes `/tmp/amibase-test.lha` and verifies entries by re-reading via the bundled `libArchive` extractor.

