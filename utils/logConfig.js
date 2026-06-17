'use strict';

const fs   = require('fs');
const path = require('path');

const logConfigPath = path.join(__dirname, '..', 'logConfig.json');

/**
 * Reads the log channel configuration from logConfig.json.
 * Returns an empty object if the file is missing or unreadable.
 * Shape: { messageLog, voiceLog, muteLog, roleLog }
 * @returns {{ messageLog?: string, voiceLog?: string, muteLog?: string, roleLog?: string }}
 */
function getLogConfig() {
  try {
    return JSON.parse(fs.readFileSync(logConfigPath, 'utf8'));
  } catch {
    return {};
  }
}

module.exports = { getLogConfig, logConfigPath };
