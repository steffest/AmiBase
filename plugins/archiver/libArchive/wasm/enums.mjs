/*!
 * archive-wasm - LibArchive compiled to WASM with a idiomatic JS API
 * Copyright (C) 2023 Spacedrive Technology Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file Constants and Enums used by the raw LibArchive API
 * @module archive-wasm/wasm/enums.mjs
 */

/**
 * Error codes for LibArchive. Use archive_errno() and archive_error_string()
 * to retrieve additional details. Unless otherwise specified, all functions
 * returning an integer use these codes.
 *
 * | Code           | Value | Description        |
 * |----------------|-------|--------------------|
 * | ARCHIVE_EOF    |   1 | End of archive.      |
 * | ARCHIVE_OK     |   0 | Operation succeeded. |
 * | ARCHIVE_RETRY  | -10 | Retry may succeed.   |
 * | ARCHIVE_WARN   | -20 | Partial success.     |
 * | ARCHIVE_FAILED | -25 | The current operation cannot complete. |
 * | ARCHIVE_FATAL  | -30 | No further operations are possible. |
 * @see {@link https://github.com/libarchive/libarchive/blob/v3.7.7/libarchive/archive.h#L186-L198}
 * @private
 * @readonly
 * @enum {number}
 */
export const ReturnCode = {
  OK: 0,
  EOF: 1,
  RETRY: -10,
  WARN: -20,
  FAILED: -25,
  FATAL: -30,
}

/**
 * File-type constants for LibArchive. Returned by archive_entry_filetype() and
 * used by archive_entry_set_filetype().
 *
 * | Constant  | Value   |
 * |-----------|---------|
 * | AE_IFREG  | 0100000 |
 * | AE_IFLNK  | 0120000 |
 * | AE_IFSOCK | 0140000 |
 * | AE_IFCHR  | 0020000 |
 * | AE_IFBLK  | 0060000 |
 * | AE_IFDIR  | 0040000 |
 * | AE_IFIFO  | 0010000 |
 * @see {@link https://github.com/libarchive/libarchive/blob/v3.7.7/libarchive/archive_entry.h#L184-L191}
 * @readonly
 * @enum {number}
 */
export const EntryType = {
  FILE: 0o0100000,
  SYMBOLIC_LINK: 0o0120000,
  SOCKET: 0o0140000,
  CHARACTER_DEVICE: 0o0020000,
  BLOCK_DEVICE: 0o0060000,
  DIR: 0o0040000,
  NAMED_PIPE: 0o0010000,
}

/**
 * Maps each EntryType to a string identifier:
 * - FILE
 * - NAMED_PIPE
 * - SOCKET
 * - DIR
 * - BLOCK_DEVICE
 * - SYMBOLIC_LINK
 * - CHARACTER_DEVICE
 * @readonly
 * @enum { 'FILE' | 'NAMED_PIPE' | 'SOCKET' | 'DIR' | 'BLOCK_DEVICE' | 'SYMBOLIC_LINK' | 'CHARACTER_DEVICE'}
 */
export const EntryTypeName = {
  /** @type {EntryTypeName} */
  [EntryType.FILE]: 'FILE',
  /** @type {EntryTypeName} */
  [EntryType.NAMED_PIPE]: 'NAMED_PIPE',
  /** @type {EntryTypeName} */
  [EntryType.SOCKET]: 'SOCKET',
  /** @type {EntryTypeName} */
  [EntryType.DIR]: 'DIR',
  /** @type {EntryTypeName} */
  [EntryType.BLOCK_DEVICE]: 'BLOCK_DEVICE',
  /** @type {EntryTypeName} */
  [EntryType.SYMBOLIC_LINK]: 'SYMBOLIC_LINK',
  /** @type {EntryTypeName} */
  [EntryType.CHARACTER_DEVICE]: 'CHARACTER_DEVICE',
}

/**
 * Mask representing the file type bits.
 *
 * #define AE_IFMT 0170000
 * @see {@link https://github.com/libarchive/libarchive/blob/v3.7.7/libarchive/archive_entry.h#L184}
 * @private
 * @type {number}
 */
export const FILETYPE_FLAG = 0o0170000
