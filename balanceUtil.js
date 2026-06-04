const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'user_balances.json');

function readBalances() {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content ? JSON.parse(content) : {};
  } catch (err) {
    console.error('Error reading balances:', err);
    return {};
  }
}

function writeBalances(data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing balances:', err);
  }
}

function getBalance(userId) {
  const data = readBalances();
  if (!data[userId]) {
    // Starting balance: 1000 coins
    data[userId] = { balance: 1000, lastDaily: 0 };
    writeBalances(data);
  }
  if (typeof data[userId] === 'number') {
    data[userId] = { balance: data[userId], lastDaily: 0 };
    writeBalances(data);
  }
  return data[userId].balance;
}

function addBalance(userId, amount) {
  const data = readBalances();
  if (!data[userId]) {
    data[userId] = { balance: 1000, lastDaily: 0 };
  } else if (typeof data[userId] === 'number') {
    data[userId] = { balance: data[userId], lastDaily: 0 };
  }
  data[userId].balance += amount;
  writeBalances(data);
  return data[userId].balance;
}

function claimDaily(userId) {
  const data = readBalances();
  if (!data[userId]) {
    data[userId] = { balance: 1000, lastDaily: 0 };
  } else if (typeof data[userId] === 'number') {
    data[userId] = { balance: data[userId], lastDaily: 0 };
  }

  const now = Date.now();
  const cooldown = 24 * 60 * 60 * 1000; // 24 hours
  const lastDaily = data[userId].lastDaily || 0;

  if (now - lastDaily < cooldown) {
    const timeLeft = cooldown - (now - lastDaily);
    return { success: false, timeLeft };
  }

  data[userId].lastDaily = now;
  data[userId].balance += 500;
  writeBalances(data);
  return { success: true, newBalance: data[userId].balance };
}

module.exports = {
  getBalance,
  addBalance,
  claimDaily
};
