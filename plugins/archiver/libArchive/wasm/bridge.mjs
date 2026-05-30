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
 * @file Bridge between idiomatic Javascript API and the raw LibArchive WASM API
 * @module archive-wasm/wasm/bridge.mjs
 */

import { ReturnCode } from './enums.mjs'
import {
  ARCHIVE_ERRNO_MISC,
  ARCHIVE_ERRNO_PROGRAMMER_ERROR,
  ArchiveError,
  ENULL,
  EPASS,
  FailedError,
  FatalError,
  FileReadError,
  NullError,
  PassphraseError,
  RetryError,
} from './errors.mjs'
import { wasm } from './libarchive.mjs'
import { Pointer } from './pointer.mjs'

/**
 * @private
 * @type {boolean}
 */
export let WARNING = true

/** Disable lib warnings */
export function disableWarning() {
  WARNING = false
}

const utf8Labels = new Set(['unicode-1-1-utf-8', 'utf-8', 'utf8'])

/**
 * Get the message content of the last error that occured
 * const char	*archive_error_string(struct archive *archive);
 * @private
 * @callback GetErrorCb
 * @param {number} archive Pointer to archive struct
 * @returns {string} Last error message that occurred, empty string if no error has occurred yet
 */
const getError = /** @type {GetErrorCb} */ (
  wasm.cwrap('archive_error_string', 'string', ['number'])
)

/**
 * Get numeric error of the last error that occured
 * int archive_errno(struct archive *archive);
 * @private
 * @callback getErrorCodeCb
 * @param {number} archive Pointer to archive struct
 * @returns {number} Last error code that occurred, zero if no error has occurred yet
 */
const getErrorCode = /** @type {getErrorCodeCb} */ (
  wasm.cwrap('archive_errno', 'number', ['number'])
)

/**
 * Open a compressed archive in memory
 * void archive_clear_error(struct archive *archive);
 * @private
 * @callback clearErrorCb
 * @param {number} archive Pointer to archive struct
 */
const clearError = /** @type {clearErrorCb} */ (wasm.cwrap('archive_clear_error', null, ['number']))

/**
 * Wrap calls that interact with archive to do erro checking/clean-up
 * @param {Function} cb Native call
 * @param {null | boolean} checkReturn Wheter the return of the call is a {@link ReturnCode} to be checked and consumed,
 *                                     null is a special case for functions that return a pointer and need to validate that it isn't Pointer.NULL
 * @returns {Function} cb wrapped with error checking logic
 */
function errorCheck(cb, checkReturn) {
  /**
   * @param {Pointer} archive = Pointer to archive struct
   * @param {unknown[]} args Other arguments
   * @returns {unknown} cb return value
   */
  function errorCheckWrapper(archive, ...args) {
    if (archive.isNull()) throw new NullError('Archive pointer is Pointer.NULL')

    const returnCode = cb(archive.raw, ...args)
    if (archive.isNull()) return returnCode

    const errorMsg = getError(archive.raw) ?? 'Unknown error'
    const errorCode = getErrorCode(archive.raw)
    if (WARNING && errorCode === ARCHIVE_ERRNO_PROGRAMMER_ERROR)
      console.warn(
        'LibArchive Programming Error occurred. ' +
          'Please report this to https://github.com/spacedriveapp/archive-wasm/issues/new/choose' +
          '\n%s: %s',
        cb.name,
        errorMsg
      )
    try {
      if (checkReturn) {
        switch (returnCode) {
          case ReturnCode.WARN:
            if (WARNING) console.warn(`${cb.name}: ${errorMsg}`)
          // eslint-disable-next-line no-fallthrough
          case ReturnCode.OK:
          case ReturnCode.EOF:
            return
          case ReturnCode.RETRY:
            throw new RetryError(errorCode, errorMsg)
          case ReturnCode.FATAL:
            throw new FatalError(errorCode, errorMsg)
          case ReturnCode.FAILED:
            throw new FailedError(errorCode, errorMsg)
          default:
            throw new Error('Invalid return code')
        }
      } else {
        if (errorCode !== 0) throw new ArchiveError(errorCode, errorMsg)

        if (checkReturn === null) {
          const pointer = new Pointer(0, returnCode)
          if (pointer.isNull()) throw new NullError('Returned unexpected Pointer.NULL')
          return pointer
        }

        return returnCode
      }
    } finally {
      clearError(archive.raw)
    }
  }

  return errorCheckWrapper
}

/**
 * struct archive *open_archive(const void *buf, size_t size, const char *passphrase);
 * @private
 * @callback OpenArchiveCb
 * @param {number} buf Pointer to archive data buffer
 * @param {number} size Size of archive data buffer
 * @param {string} passphrase Password to decrypt archive data
 * @param {boolean} recursive recursively open archives inside archives
 * @returns {number} Pointer to struct representing the opened archive
 */
const _openArchive = /** @type {OpenArchiveCb} */ (
  wasm.cwrap('open_archive', 'number', ['number', 'number', 'string', 'boolean'])
)

/**
 * Keep reference to opened archives buffer pointer to avoid GC from freeing them
 * @private
 * @type {WeakMap<Pointer, Pointer>}
 */
const _openArchiveBuffMap = new WeakMap()

/**
 * Open a compressed archive in memory
 * @private
 * @param {Pointer} buffer Archive data
 * @param {string} [passphrase] to decrypt archive data
 * @param {boolean} [recursive] recursively open archives inside archives
 * @returns {Pointer} Pointer to struct representing the opened archive
 */
export function openArchive(buffer, passphrase, recursive) {
  if (buffer.size == null || buffer.isNull())
    throw new NullError("Archive data must be a malloc'd buffer, not NULL or externally managed")

  if (passphrase == null) passphrase = ''

  const archive = new Pointer(
    0,
    _openArchive(buffer.raw, buffer.size, passphrase, recursive || false)
  )
  if (archive.isNull()) throw new NullError('Failed to allocate memory')

  const errorCode = getErrorCode(archive.raw)
  if (errorCode !== 0) {
    const errorMsg = getError(archive.raw)

    clearError(archive.raw)
    closeArchive(archive)

    throw new (errorCode === EPASS ? PassphraseError : ArchiveError)(errorCode, errorMsg)
  }

  _openArchiveBuffMap.set(archive, buffer)

  return archive
}

/**
 * Get the current entry of an archive
 * struct archive_entry *get_next_entry(struct archive *archive);
 * @private
 * @callback GetNextEntryCb
 * @param {Pointer} archive Pointer to archive struct
 * @returns {Pointer} Pointer to struct representing an archive entry
 */

/** @private  */
export const getNextEntry = /** @type {GetNextEntryCb} */ (
  errorCheck(wasm.cwrap('get_next_entry', 'number', ['number']), null)
)

/**
 * void * get_filedata(void * archive, size_t buffsize);
 * @private
 * @callback GetFileDataCb
 * @param {number} archive Pointer to archive struct
 * @param {number} buffsize File size to be read, must be a value returned by {@link GetEntrySizeCb}
 * @returns {number} Pointer to file data buffer
 */
const _getFileData = /** @type {GetFileDataCb} */ (
  wasm.cwrap('get_filedata', 'number', ['number', 'number'])
)

/**
 * Get the file data for the current entry of an archive
 * @private
 * @param {Pointer} archive Pointer to archive struct
 * @param {bigint} buffsize File size to be read, must be a value returned by {@link GetEntrySizeCb}
 * @returns {Pointer} Pointer to file data in WASM HEAP
 */
export function getFileData(archive, buffsize) {
  if (archive.isNull()) throw new NullError('Archive pointer is Pointer.NULL')

  if (buffsize === 0n) return new Pointer()

  const size = Number(buffsize)
  if (size > Number.MAX_SAFE_INTEGER) {
    throw new FileReadError(
      ARCHIVE_ERRNO_MISC,
      `Couldn't read entry data due to it's size exceeding MAX_SAFE_INTEGER: ${buffsize}`
    )
  }

  const fileDataPointer = new Pointer(size, _getFileData(archive.raw, size))
  let readLen, errorMsg, errorCode
  if (archive.isNull()) {
    errorMsg = 'Archive pointer is Pointer.NULL'
    errorCode = ENULL
  } else {
    errorMsg = getError(archive.raw)
    errorCode = getErrorCode(archive.raw)
  }

  try {
    if (errorCode !== 0) {
      throw errorCode === ARCHIVE_ERRNO_MISC && errorMsg.toLocaleLowerCase().includes('passphrase')
        ? new PassphraseError(EPASS, errorMsg)
        : new FileReadError(errorCode, errorMsg || 'Failed to read archive data')
    }

    if (fileDataPointer.isNull()) throw new NullError('Failed to allocate memory for archive data')

    readLen = Number.parseInt(errorMsg)
    if (Number.isNaN(readLen) || readLen < 0)
      throw new FileReadError(ARCHIVE_ERRNO_MISC, 'Invalid size for archive data')
  } finally {
    if (!archive.isNull()) clearError(archive.raw)
  }

  return fileDataPointer.realloc(readLen, true)
}

/**
 * int archive_read_free(struct archive * archive);
 * @private
 * @callback CloseArchiveCb
 * @param {Pointer} archive Pointer to archive struct
 */
const _closeArchive = /** @type {CloseArchiveCb} */ (
  errorCheck(wasm.cwrap('archive_read_free', 'number', ['number']), true)
)

/**
 * Free archive pointer from memory
 * @private
 * @param {Pointer} archive Pointer to archive struct
 */
export function closeArchive(archive) {
  try {
    if (!archive.isNull()) _closeArchive(archive)
  } finally {
    _openArchiveBuffMap.delete(archive)
    archive.free()
  }
}

/**
 * Get the size of the current entry of an archive
 * la_int64_t archive_entry_size(struct archive_entry *archive);
 * @private
 * @callback GetEntrySizeCb
 * @param {Pointer} entry Pointer to entry struct
 * @returns {bigint} Current entry size to be used in {@link GetFileDataCb}
 */

/** @private */
export const getEntrySize = /** @type {GetEntrySizeCb} */ (
  errorCheck(wasm.cwrap('archive_entry_size', 'number', ['number']), false)
)

/**
 * Get the st_mode of the current entry of an archive
 * mode_t archive_entry_filetype(struct archive_entry *archive);
 * @private
 * @callback GetEntryModeCb
 * @param {Pointer} entry Pointer to entry struct
 * @returns {number} Current entry's st_mode
 */

/** @private */
export const getEntryMode = /** @type {GetEntryModeCb} */ (
  errorCheck(wasm.cwrap('archive_entry_mode', 'number', ['number']), false)
)

/**
 * time_t	 archive_entry_atime(struct archive_entry *archive);
 * @private
 * @callback GetEntryAtimeCb
 * @param {Pointer} entry Pointer to entry struct
 * @returns {bigint} Current entry atime
 */

/** @private */
export const getEntryAtime = /** @type {GetEntryAtimeCb} */ (
  errorCheck(wasm.cwrap('archive_entry_atime', 'number', ['number']), false)
)

/**
 * time_t archive_entry_ctime(struct archive_entry *archive)
 * @private
 * @callback GetEntryCtimeCb
 * @param {Pointer} entry Pointer to entry struct
 * @returns {bigint} Current entry ctime
 */

/** @private */
export const getEntryCtime = /** @type {GetEntryCtimeCb} */ (
  errorCheck(wasm.cwrap('archive_entry_ctime', 'number', ['number']), false)
)

/**
 * time_t archive_entry_mtime(struct archive_entry *archive)
 * @private
 * @callback GetEntryMtimeCb
 * @param {Pointer} entry Pointer to entry struct
 * @returns {bigint} Current entry mtime
 */

/** @private */
export const getEntryMtime = /** @type {GetEntryMtimeCb} */ (
  errorCheck(wasm.cwrap('archive_entry_mtime', 'number', ['number']), false)
)

/**
 * time_t archive_entry_birthtime(struct archive_entry *archive)
 * @private
 * @callback GetEntryBirthtimeCb
 * @param {Pointer} entry Pointer to entry struct
 * @returns {bigint} Current entry birthtime
 */

/** @private */
export const getEntryBirthtime = /** @type {GetEntryBirthtimeCb} */ (
  errorCheck(wasm.cwrap('archive_entry_birthtime', 'number', ['number']), false)
)

/**
 * @private
 * @callback GetEntryStringValueCb
 * @param {Pointer} entry Pointer to entry struct
 * @param {string} [encoding] Label for decoding the string value. Default is utf8
 * @returns {string?} Entry string value
 */

/**
 * Wrap C function to get entry string value
 * @param {string} cFuncName Name of the function to get the value
 * @returns {GetEntryStringValueCb} Wrapped function
 */
function wrapGetEntryStringValue(cFuncName) {
  return (entry, encoding) => {
    let value = null

    if (encoding == null || utf8Labels.has(encoding))
      value = wasm.ccall(`${cFuncName}_utf8`, 'string', ['number'], [entry.raw])

    if (!value) {
      const pointer = new Pointer(
        0,
        /** @type {number} */ (wasm.ccall(cFuncName, 'number', ['number'], [entry.raw]))
      )
      if (!pointer.isNull()) value = pointer.readString(encoding)
    }

    return value || null
  }
}

export const getEntrySymlink = wrapGetEntryStringValue('archive_entry_symlink')
export const getEntryHardlink = wrapGetEntryStringValue('archive_entry_hardlink')
export const getEntryPathName = wrapGetEntryStringValue('archive_entry_pathname')
