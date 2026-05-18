module.exports = {
  name: 'close',
  description: 'Close a ticket (admin only)',
  async execute(message) {
    // Check if this is a ticket channel
    if (!message.channel.name.startsWith('ticket-')) {
      return message.reply('❌ This command can only be used in ticket channels.');
    }

    // Check if user has admin role
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('❌ Only admins can close tickets.');
    }

    const fs = require('fs');
    const ticketsFile = JSON.parse(fs.readFileSync('./tickets.json', 'utf8'));
    const ticketEntry = Object.entries(ticketsFile).find(([, ticket]) => ticket.channelId === message.channel.id);

    if (ticketEntry) {
      delete ticketsFile[ticketEntry[0]];
      fs.writeFileSync('./tickets.json', JSON.stringify(ticketsFile, null, 2));
    }

    message.reply('✅ Ticket closed and channel will be deleted in 5 seconds...');
    setTimeout(() => message.channel.delete().catch(() => {}), 5000);
  }
};
