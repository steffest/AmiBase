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

/** Disable lib warnings */
import { Pointer } from './pointer.mjs'

export function disableWarning(): void
/**
 * Open a compressed archive in memory
 * @private
 * @param {Pointer} buffer Archive data
 * @param {string} [passphrase] to decrypt archive data
 * @param {boolean} [recursive] recursively open archives inside archives
 * @returns {Pointer} Pointer to struct representing the opened archive
 */
export function openArchive(buffer: Pointer, passphrase?: string, recursive?: boolean): Pointer
/**
 * Get the file data for the current entry of an archive
 * @private
 * @param {Pointer} archive Pointer to archive struct
 * @param {bigint} buffsize File size to be read, must be a value returned by {@link GetEntrySizeCb}
 * @returns {Pointer} Pointer to file data in WASM HEAP
 */
export function getFileData(archive: Pointer, buffsize: bigint): Pointer
/**
 * Free archive pointer from memory
 * @private
 * @param {Pointer} archive Pointer to archive struct
 */
export function closeArchive(archive: Pointer): void
/**
 * @private
 * @type {boolean}
 */
export let WARNING: boolean
export function getNextEntry(archive: Pointer): Pointer
export function getEntrySize(entry: Pointer): bigint
export function getEntryMode(entry: Pointer): number
export function getEntryAtime(entry: Pointer): bigint
export function getEntryCtime(entry: Pointer): bigint
export function getEntryMtime(entry: Pointer): bigint
export function getEntryBirthtime(entry: Pointer): bigint
export function getEntrySymlink(entry: Pointer, encoding?: string): string | null
export function getEntryHardlink(entry: Pointer, encoding?: string): string | null
export function getEntryPathName(entry: Pointer, encoding?: string): string | null
export type GetEntryStringValueCb = (entry: Pointer, encoding?: string) => string | null
/**
 * Get the message content of the last error that occured
 * const char	*archive_error_string(struct archive *archive);
 */
export type GetErrorCb = (archive: number) => string
/**
 * Get numeric error of the last error that occured
 * int archive_errno(struct archive *archive);
 */
export type getErrorCodeCb = (archive: number) => number
/**
 * Open a compressed archive in memory
 * void archive_clear_error(struct archive *archive);
 */
export type clearErrorCb = (archive: number) => unknown
/**
 * struct archive *open_archive(const void *buf, size_t size, const char *passphrase);
 */
export type OpenArchiveCb = (
  buf: number,
  size: number,
  passphrase: string,
  recursive: boolean
) => number
/**
 * Get the current entry of an archive
 * struct archive_entry *get_next_entry(struct archive *archive);
 */
export type GetNextEntryCb = (archive: Pointer) => Pointer
/**
 * void * get_filedata(void * archive, size_t buffsize);
 */
export type GetFileDataCb = (archive: number, buffsize: number) => number
/**
 * int archive_read_free(struct archive * archive);
 */
export type CloseArchiveCb = (archive: Pointer) => unknown
/**
 * Get the size of the current entry of an archive
 * la_int64_t archive_entry_size(struct archive_entry *archive);
 */
export type GetEntrySizeCb = (entry: Pointer) => bigint
/**
 * Get the st_mode of the current entry of an archive
 * mode_t archive_entry_filetype(struct archive_entry *archive);
 */
export type GetEntryModeCb = (entry: Pointer) => number
/**
 * time_t	 archive_entry_atime(struct archive_entry *archive);
 */
export type GetEntryAtimeCb = (entry: Pointer) => bigint
/**
 * time_t archive_entry_ctime(struct archive_entry *archive)
 */
export type GetEntryCtimeCb = (entry: Pointer) => bigint
/**
 * time_t archive_entry_mtime(struct archive_entry *archive)
 */
export type GetEntryMtimeCb = (entry: Pointer) => bigint
/**
 * time_t archive_entry_birthtime(struct archive_entry *archive)
 */
export type GetEntryBirthtimeCb = (entry: Pointer) => bigint
