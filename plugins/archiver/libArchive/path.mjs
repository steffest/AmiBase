// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

/**
 * This file is a modified, slimmed down, version of NodeJS's posix path module
 * Original source: https://github.com/nodejs/node/blob/v23.10.0/lib/path.js
 */

const CHAR_DOT = 46
const CHAR_FORWARD_SLASH = 47

/**
 * Checks if a character code represents a POSIX path separator ('/').
 * @param {number} code Character code to check.
 * @returns {boolean} True if the code is a path separator.
 */
function isPosixPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH
}

/**
 * Removes redundant '.' or '..' path segments.
 * @param {string} path Candidate path.
 * @param {boolean} allowAboveRoot Whether to keep '..' segments beyond root.
 * @param {string} separator Path separator to use.
 * @param {(code: number) => boolean} isPathSeparator Function to identify separators.
 * @returns {string} Normalized path.
 */
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
  let res = ''
  let lastSegmentLength = 0
  let lastSlash = -1
  let dots = 0
  let code = 0
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) {
      code = path.charCodeAt(i)
    } else if (isPathSeparator(code)) {
      break
    } else {
      code = CHAR_FORWARD_SLASH
    }

    if (isPathSeparator(code)) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (dots === 2) {
        if (
          res.length < 2 ||
          lastSegmentLength !== 2 ||
          res.charCodeAt(res.length - 1) !== CHAR_DOT ||
          res.charCodeAt(res.length - 2) !== CHAR_DOT
        ) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(separator)
            if (lastSlashIndex === -1) {
              res = ''
              lastSegmentLength = 0
            } else {
              res = res.slice(0, lastSlashIndex)
              lastSegmentLength = res.length - 1 - res.lastIndexOf(separator)
            }
            lastSlash = i
            dots = 0
            continue
          }

          if (res.length !== 0) {
            res = ''
            lastSegmentLength = 0
            lastSlash = i
            dots = 0
            continue
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? `${separator}..` : '..'
          lastSegmentLength = 2
        }
      } else {
        if (res.length > 0) {
          res += `${separator}${path.slice(lastSlash + 1, i)}`
        } else {
          res = path.slice(lastSlash + 1, i)
        }
        lastSegmentLength = i - lastSlash - 1
      }
      lastSlash = i
      dots = 0
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots
    } else {
      dots = -1
    }
  }
  return res
}

/**
 * Resolves one or more paths into an absolute path.
 * @param {...string} args Path segments to resolve.
 * @returns {string} Resolved absolute path.
 */
export function resolve(...args) {
  let resolvedPath = ''
  let resolvedAbsolute = false

  for (let i = args.length - 1; i >= 0 && !resolvedAbsolute; i--) {
    const path = args[i]
    if (typeof path !== 'string') {
      throw new TypeError(`Expected a string for paths[${i}]`)
    }

    // Skip empty entries
    if (path.length === 0) {
      continue
    }

    resolvedPath = `${path}/${resolvedPath}`
    resolvedAbsolute = path?.charCodeAt(0) === CHAR_FORWARD_SLASH
  }

  if (!resolvedAbsolute) {
    resolvedPath = `/${resolvedPath}`
    resolvedAbsolute = true
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe

  // Normalize the path
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, '/', isPosixPathSeparator)
  return resolvedAbsolute ? `/${resolvedPath}` : resolvedPath.length > 0 ? resolvedPath : '.'
}

/**
 * Normalizes the given path, resolving '.' and '..' segments.
 * @param {string} path The path to normalize.
 * @returns {string} Normalized path.
 */
export function normalize(path) {
  if (typeof path !== 'string') {
    throw new TypeError(`Expected a string for path`)
  }

  if (path.length === 0) return '.'

  const isAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH

  // Normalize the path
  path = normalizeString(path, !isAbsolute, '/', isPosixPathSeparator)

  return path.length === 0 ? (isAbsolute ? '/' : '.') : isAbsolute ? `/${path}` : path
}

/**
 * Checks if a path is absolute.
 * @param {string} path The path to check.
 * @returns {boolean} True if the path is absolute, otherwise false.
 */
export function isAbsolute(path) {
  if (typeof path !== 'string') {
    throw new TypeError(`Expected a string for path`)
  }
  return path.length > 0 && path.charCodeAt(0) === CHAR_FORWARD_SLASH
}

/**
 * Calculates the relative path from one path to another.
 * @param {string} from The base path.
 * @param {string} to The target path.
 * @returns {string} The relative path from 'from' to 'to'.
 */
export function relative(from, to) {
  if (typeof from !== 'string') {
    throw new TypeError(`Expected a string for from`)
  }

  if (typeof to !== 'string') {
    throw new TypeError(`Expected a string for to`)
  }

  if (from === to) {
    return ''
  }

  // Trim leading forward slashes.
  from = resolve(from)
  to = resolve(to)
  if (from === to) {
    return ''
  }

  const fromStart = 1
  const fromEnd = from.length
  const fromLen = fromEnd - fromStart
  const toStart = 1
  const toLen = to.length - toStart

  // Compare paths to find the longest common path from root
  const length = fromLen < toLen ? fromLen : toLen
  let lastCommonSep = -1
  let i = 0
  for (; i < length; i++) {
    const fromCode = from.charCodeAt(fromStart + i)
    if (fromCode !== to.charCodeAt(toStart + i)) {
      break
    }

    if (fromCode === CHAR_FORWARD_SLASH) {
      lastCommonSep = i
    }
  }
  if (i === length) {
    if (toLen > length) {
      if (to.charCodeAt(toStart + i) === CHAR_FORWARD_SLASH) {
        // We get here if `from` is the exact base path for `to`.
        // For example: from='/foo/bar'; to='/foo/bar/baz'
        return to.slice(toStart + i + 1)
      }
      if (i === 0) {
        // We get here if `from` is the root
        // For example: from='/'; to='/foo'
        return to.slice(toStart + i)
      }
    } else if (fromLen > length) {
      if (from.charCodeAt(fromStart + i) === CHAR_FORWARD_SLASH) {
        // We get here if `to` is the exact base path for `from`.
        // For example: from='/foo/bar/baz'; to='/foo/bar'
        lastCommonSep = i
      } else if (i === 0) {
        // We get here if `to` is the root.
        // For example: from='/foo/bar'; to='/'
        lastCommonSep = 0
      }
    }
  }

  let out = ''
  // Generate the relative path based on the path difference between `to`
  // and `from`.
  for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
    if (i === fromEnd || from.charCodeAt(i) === CHAR_FORWARD_SLASH) {
      out += out.length === 0 ? '..' : '/..'
    }
  }

  // Lastly, append the rest of the destination (`to`) path that comes after
  // the common path parts.
  return `${out}${to.slice(toStart + lastCommonSep)}`
}

/**
 * Returns the directory name of a path.
 * @param {string} path The path to evaluate.
 * @returns {string} The path to the directory.
 */
export function dirname(path) {
  if (typeof path !== 'string') {
    throw new TypeError(`Expected a string for path`)
  }

  if (path.length === 0) {
    return '.'
  }

  const hasRoot = path.charCodeAt(0) === CHAR_FORWARD_SLASH
  let end = -1
  let matchedSlash = true
  for (let i = path.length - 1; i >= 1; --i) {
    if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
      if (!matchedSlash) {
        end = i
        break
      }
    } else {
      // We saw the first non-path separator
      matchedSlash = false
    }
  }

  if (end === -1) {
    return hasRoot ? '/' : '.'
  }
  if (hasRoot && end === 1) {
    return '//'
  }
  return path.slice(0, end)
}

export default {
  resolve,
  normalize,
  isAbsolute,
  relative,
  dirname,
}
