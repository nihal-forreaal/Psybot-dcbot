'use strict';

const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../temp_vcs.json');

function readDb() {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content ? JSON.parse(content) : {};
  } catch (err) {
    console.error('Error reading VC database:', err);
    return {};
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing VC database:', err);
  }
}

function getVc(channelId) {
  const db = readDb();
  return db[channelId] || null;
}

function saveVc(channelId, data) {
  const db = readDb();
  const existing = db[channelId] || {};
  db[channelId] = {
    ownerId: data.ownerId || existing.ownerId || '',
    coOwners: data.coOwners || existing.coOwners || [],
    isLocked: data.isLocked !== undefined ? data.isLocked : (existing.isLocked || false),
    isHidden: data.isHidden !== undefined ? data.isHidden : (existing.isHidden || false),
    limit: data.limit !== undefined ? data.limit : (existing.limit || 0),
    panelMessageId: data.panelMessageId || existing.panelMessageId || '',
  };
  writeDb(db);
}

function deleteVc(channelId) {
  const db = readDb();
  if (db[channelId]) {
    delete db[channelId];
    writeDb(db);
  }
}

module.exports = {
  getVc,
  saveVc,
  deleteVc,
  readDb,
};
