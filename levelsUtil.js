const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, 'levels.json');

// Centralized Level Role Rewards mapping
const LEVEL_ROLE_REWARDS = [
  { level: 1, name: 'Nobby 1' },
  { level: 2, name: 'Normie 2' },
  { level: 5, name: 'Rookie 5' },
  { level: 10, name: 'Grinder 10' },
  { level: 15, name: 'Sweaty 15' },
  { level: 20, name: 'Pro 20' },
  { level: 30, name: 'Elite 30' },
  { level: 35, name: 'Legend 35' },
  { level: 40, name: 'Mythic 40' },
  { level: 50, name: 'Godmode 50' },
];

let levelsCache = null;
let levelsDirty = false;
let levelsSaveTimer = null;
const LEVEL_SAVE_DELAY_MS = 5000;

// Load levels at startup or get current cached levels
function getLevels() {
  if (!levelsCache) {
    try {
      if (fs.existsSync(levelsPath)) {
        const content = fs.readFileSync(levelsPath, 'utf8').trim();
        levelsCache = content ? JSON.parse(content) : {};
      } else {
        levelsCache = {};
      }
    } catch (err) {
      console.error('[DATABASE] Failed to read levels.json:', err.message);
      levelsCache = {};
    }
  }
  return levelsCache;
}

// Flush cache to disk
function saveLevelsNow() {
  if (!levelsDirty || !levelsCache) return;
  try {
    const tempPath = `${levelsPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(levelsCache, null, 2), 'utf8');
    fs.renameSync(tempPath, levelsPath);
    levelsDirty = false;
    console.log('[DATABASE] Level database successfully flushed to disk.');
  } catch (err) {
    console.error('[DATABASE] Failed to write levels.json:', err.message);
  }
}

// Schedule debounced save
function scheduleLevelsSave() {
  levelsDirty = true;
  if (levelsSaveTimer) return;

  levelsSaveTimer = setTimeout(() => {
    levelsSaveTimer = null;
    saveLevelsNow();
  }, LEVEL_SAVE_DELAY_MS);

  if (typeof levelsSaveTimer.unref === 'function') {
    levelsSaveTimer.unref();
  }
}

// Force a synchronous/immediate write to disk
function saveLevelsSync() {
  levelsDirty = true;
  saveLevelsNow();
}

// Reset levels
function resetLevel(userId) {
  const levels = getLevels();
  levels[userId] = { xp: 0, level: 0 };
  scheduleLevelsSave();
}

// Get single user levels data
function getUserLevel(userId) {
  const levels = getLevels();
  if (!levels[userId]) {
    levels[userId] = { xp: 0, level: 0 };
  }
  return levels[userId];
}

// Add XP function that encapsulates leveling logic and sequential level-up detection
function addXP(userId, xpAmount) {
  const levels = getLevels();
  if (!levels[userId]) {
    levels[userId] = { xp: 0, level: 0 };
  }
  levels[userId].xp += xpAmount;

  let levelsGained = [];
  while (true) {
    const xpNeeded = levels[userId].level * 600 + 600;
    if (levels[userId].xp >= xpNeeded) {
      levels[userId].level += 1;
      levelsGained.push(levels[userId].level);
    } else {
      break;
    }
  }

  scheduleLevelsSave();

  return {
    leveledUp: levelsGained.length > 0,
    newLevel: levels[userId].level,
    levelsGained,
    currentXP: levels[userId].xp
  };
}

// Centralized role assigner
function getLevelRoleId(level) {
  const roleIds = process.env.LEVEL_ROLE_IDS || '';
  const roleMap = {};
  roleIds.split(',').forEach(pair => {
    const [lvl, id] = pair.split(':');
    if (lvl && id) {
      roleMap[parseInt(lvl, 10)] = id;
    }
  });
  return roleMap[level] || null;
}

function getLevelRoleReward(level) {
  return LEVEL_ROLE_REWARDS.find(reward => reward.level === level) || null;
}

async function findOrCreateLevelRole(guild, reward) {
  const configuredRoleId = getLevelRoleId(reward.level);
  if (configuredRoleId) {
    const configuredRole = await guild.roles.fetch(configuredRoleId).catch(() => null);
    if (configuredRole) return configuredRole;
  }

  const roles = await guild.roles.fetch();
  const existingRole = roles.find(role => role.name.toLowerCase() === reward.name.toLowerCase());
  if (existingRole) return existingRole;

  return guild.roles.create({
    name: reward.name,
    reason: `Level ${reward.level} reward role`,
  });
}

async function giveLevelRole(member, level) {
  const reward = getLevelRoleReward(level);
  if (!reward) return;

  try {
    const role = await findOrCreateLevelRole(member.guild, reward);
    if (role) {
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
      }

      // Remove all OTHER level roles from the member
      for (const r of LEVEL_ROLE_REWARDS) {
        if (r.level !== level) {
          const otherRole = await findOrCreateLevelRole(member.guild, r);
          if (otherRole && member.roles.cache.has(otherRole.id)) {
            await member.roles.remove(otherRole).catch(() => null);
          }
        }
      }
    }
  } catch (err) {
    console.error(`[LEVELS] Error managing level roles for ${member.user.tag}:`, err);
  }
}

async function ensureLevelRoles(guild) {
  try {
    for (const reward of LEVEL_ROLE_REWARDS) {
      await findOrCreateLevelRole(guild, reward);
    }
    console.log(`[LEVELS] Level roles verified/created in guild: ${guild.name}`);
  } catch (err) {
    console.error(`[LEVELS] Error ensuring level roles for guild ${guild.name}:`, err.message);
  }
}

// Exit handlers to flush cache before exit
process.once('SIGINT', () => {
  saveLevelsNow();
  process.exit(0);
});

process.once('SIGTERM', () => {
  saveLevelsNow();
  process.exit(0);
});

module.exports = {
  LEVEL_ROLE_REWARDS,
  getLevels,
  getUserLevel,
  addXP,
  resetLevel,
  giveLevelRole,
  ensureLevelRoles,
  saveLevelsNow,
  saveLevelsSync
};
