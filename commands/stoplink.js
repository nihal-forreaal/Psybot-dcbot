module.exports = {
  name: 'stoplink',
  description: 'Stop sending randomized links',
  async execute(message, args) {
    const allowedUsers = ['1500513638283345991', '1105072573580062790'];

    // If sent in DM, restrict to allowed users
    if (!message.guild && !allowedUsers.includes(message.author.id)) {
      return message.reply('❌ You are not authorized to run this command in DMs.');
    }

    const client = message.client;

    // Determine target to stop:
    // 1. Specified in args[0]
    // 2. Or, if in a guild, the current channel
    // 3. Or, if in DM, default to user's ID for authorized user or channel '1506859628280152134'
    let target = args[0];
    if (!target) {
      if (message.guild) {
        target = message.channel.id;
      } else {
        if (message.author.id === '1500513638283345991') {
          target = message.author.id;
        } else {
          target = '1506859628280152134';
        }
      }
    }

    if (!client.activeLinkIntervals || !client.activeLinkIntervals.has(target)) {
      let displayTarget = target.startsWith('http') ? 'Webhook URL' : `channel \`${target}\``;
      if (/^\d{17,19}$/.test(target) && target === message.author.id) {
        displayTarget = 'your DM';
      }
      return message.reply(`❌ There is no active link randomizer running for ${displayTarget}.`);
    }

    clearInterval(client.activeLinkIntervals.get(target));
    client.activeLinkIntervals.delete(target);

    let displayTarget = target.startsWith('http') ? 'Webhook URL' : `channel \`${target}\``;
    if (/^\d{17,19}$/.test(target) && target === message.author.id) {
      displayTarget = 'your DM';
    }
    await message.reply(`🛑 Stopped sending randomized links for ${displayTarget}.`);
  }
};
