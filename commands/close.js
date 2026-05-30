const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'close',
  description: 'Close a ticket (admin only)',
  async execute(message) {
    // Check if this is a ticket channel
    if (!message.channel.name.startsWith('ticket-')) {
      return message.reply('❌ This command can only be used in ticket channels.');
    }

    // Check if user has admin role — FIX: guard against undefined ADMIN_ROLE_ID
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!adminRoleId || !message.member.roles.cache.has(adminRoleId)) {
      return message.reply('❌ Only admins can close tickets.');
    }

    const ticketsPath = path.join(__dirname, '../tickets.json');

    // FIX: use try/catch instead of bare readFileSync
    let ticketsFile = {};
    try {
      const raw = fs.readFileSync(ticketsPath, 'utf8').trim();
      if (raw) ticketsFile = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to read tickets.json in close.js:', err.message);
    }

    const ticketEntry = Object.entries(ticketsFile).find(([, ticket]) => ticket.channelId === message.channel.id);
    if (ticketEntry) {
      delete ticketsFile[ticketEntry[0]];
      try {
        fs.writeFileSync(ticketsPath, JSON.stringify(ticketsFile, null, 2));
      } catch (err) {
        console.error('Failed to write tickets.json in close.js:', err.message);
      }
    }

    await message.reply('<:tick:1510274177486028860> Ticket closed and channel will be deleted in 5 seconds...');
    setTimeout(() => message.channel.delete().catch(() => {}), 5000);
  }
};
