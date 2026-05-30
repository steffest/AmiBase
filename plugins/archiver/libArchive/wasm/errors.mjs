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
 * @file Error handling definitions
 * @module archive-wasm/wasm/errors.mjs
 */

/**
 * Error code definitions.
 * Must be kept in sync with the definition in ../../wasm/wrapper.c
 */
/** Archive requires a password for decryption. */
export const EPASS = -37455
/** Null pointer error. */
export const ENULL = -37456
/** Unknown or unclassified error. */
export const ARCHIVE_ERRNO_MISC = -1
/** Unrecognized or invalid file format. */
export const ARCHIVE_ERRNO_FILE_FORMAT = -2
/** Illegal usage of the library. */
export const ARCHIVE_ERRNO_PROGRAMMER_ERROR = -3

export class ArchiveError extends Error {
  /**
   * Creates a new ArchiveError instance.
   * @param {number} code The error code.
   * @param {string} [message] The error message.
   */
  constructor(code, message) {
    super(message || 'Unknown error')
    this.code = code
    this.name = this.constructor.name
  }
}

export class NullError extends ArchiveError {
  /**
   * Creates a new NullError instance.
   * @param {string} [message] The error message.
   */
  constructor(message) {
    super(ENULL, message || 'Unexpected Pointer.NULL')
  }
}

export class RetryError extends ArchiveError {}

export class FatalError extends ArchiveError {}

export class FailedError extends ArchiveError {}

export class FileReadError extends ArchiveError {}

export class PassphraseError extends ArchiveError {
  /**
   * Creates a new PassphraseError instance.
   * @param {number} code The error code.
   * @param {string} [message] The error message.
   */
  constructor(code, message) {
    super(code, message || 'Passphrase required for this entry')
  }
}

export class ExceedSizeLimitError extends ArchiveError {
  /**
   * Creates a new ExceedSizeLimitError instance.
   * @param {string} [message] The error message.
   */
  constructor(message) {
    super(ARCHIVE_ERRNO_MISC, message || 'Archive exceeds the size limit')
  }
}

export class ExceedRecursionLimitError extends ArchiveError {
  /**
   * Creates a new ExceedRecursionLimitError instance.
   * @param {string} [message] The error message.
   */
  constructor(message) {
    super(ARCHIVE_ERRNO_MISC, message || 'Archive exceeds the recursion limit')
  }
}
