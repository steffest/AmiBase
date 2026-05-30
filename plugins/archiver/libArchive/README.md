# Archive-Wasm

**[LibArchive](https://libarchive.org/) compiled to WASM with an idiomatic JavaScript API for extracting files from the most popular archive formats**

> Inspired by [libarchivejs](https://github.com/nika-begiashvili/libarchivejs)

## Introduction

Archive-Wasm provides a WebAssembly (WASM) version of [LibArchive](https://github.com/libarchive/libarchive/tree/v3.7.7) to be used in NodeJS and Browsers through an idiomatic JS API, that allows you to effortlessly extract data from most of the popular archive formats.

## Installation

To use Archive-Wasm in your project, you can install it via npm:

`npm install archive-wasm`

## Environment Support

- NodeJS >= 18
- Chromium & Cia. >= 109
- Safari >= 15
- Firefox >= 102

> It is possible that this lib works fine with previous versions than the listed, however these will be the minimum versions that the lib will be tested against

## Usage

Here's a simple example of extracting data from an archive using Archive-Wasm:

```js
import { extract, getEntryType } from 'archive-wasm'

// Load your archive data as an ArrayBuffer or any compatible Buffer type.
const archiveData = new Uint8Array([
  /* Archive Data */
])

for (const entry of extract(archiveData)) {
  if (entry.type === 'FILE' && entry.path.endsWith('lyrics.txt')) {
    console.log(`Found lyrics file: ${entry.path}, size: ${entry.size}`)
    console.log(new TextDecoder().decode(entry.data))
  }
}
```

## Supported Archives Types

Archive-Wasm supports the same archive formats as the full version of [LibArchive](https://libarchive.org/), with the exception of the xar format and grzip and lrzip compressions:

- Reads a variety of formats, including 7z, tar, pax, cpio, zip, lha, ar, cab, mtree, rar, and ISO images.
- Automatically handles archives compressed with compress, bzip2, gzip, lz4, lzip, lzop, lzma/xz, zstd.

### Encrypted formats

Only encrypted zip is supported in [LibArchive](https://github.com/libarchive/libarchive/blob/v3.7.7/tar/bsdtar.1#L775), other encrypted formats will throw an error during either the decoding step or when trying to read the actual file data, depending on how they implement encryption.

## API

Check the [docs](./docs)

## Contributing

Feel free to send PRs and open issues.

## TODO

- Add browser tests
- Add cpio, lha, ar, mtree tests
- Handle extracting sparse entries

## License

Except where otherwise noted, all files in this project are licensed under the GNU General Public License v3.0 or later - see the [LICENSE](./LICENSE) file for details.
