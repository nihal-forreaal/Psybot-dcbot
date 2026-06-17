'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Safely reads and parses a JSON file.
 * Returns `fallback` if the file is missing, empty, or unparseable.
 * @param {string} filePath
 * @param {*} fallback
 * @returns {*}
 */
function readJsonFile(filePath, fallback) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content ? JSON.parse(content) : fallback;
  } catch (err) {
    console.error(`Failed to read ${path.basename(filePath)}:`, err.message);
    return fallback;
  }
}

/**
 * Atomically writes data to a JSON file using a temp-file + rename pattern
 * to avoid corruption on crash.
 * @param {string} filePath
 * @param {*} data
 */
function writeJsonFile(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

module.exports = { readJsonFile, writeJsonFile };
