const targetChannelId = '1505909671918043258';

module.exports = {
  name: 'timeout',
  description: 'Times out a member in the server (requires access to channel 1505909671918043258)',
  async execute(message, args) {
    const targetChannel = message.guild.channels.cache.get(targetChannelId);
    if (!targetChannel) {
      return message.reply('❌ The required moderation channel does not exist.');
    }

    const permissions = targetChannel.permissionsFor(message.member);
    if (!permissions || !permissions.has('ViewChannel') || !permissions.has('SendMessages')) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const targetMember = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!targetMember) {
      return message.reply('❌ Please mention a user to timeout or provide their ID.');
    }

    // Default duration is 10 minutes (600,000 ms) unless specified
    let duration = 10 * 60 * 1000;
    if (args[1]) {
      const parsedTime = parseInt(args[1]);
      if (!isNaN(parsedTime) && parsedTime > 0) {
        duration = parsedTime * 60 * 1000; // in minutes
      }
    }

    const reason = args.slice(2).join(' ') || 'No reason provided';

    try {
      if (targetMember.communicationDisabledUntilTimestamp && targetMember.communicationDisabledUntilTimestamp > Date.now()) {
        await targetMember.timeout(null);
        return message.reply(`✅ Successfully removed timeout from **${targetMember.user.tag}**.`);
      } else {
        await targetMember.timeout(duration, reason);
        return message.reply(`✅ Successfully timed out **${targetMember.user.tag}** for ${duration / 60000} minutes.`);
      }
    } catch (err) {
      console.error(err);
      return message.reply('❌ I failed to timeout that user. Check my role hierarchy and permissions.');
    }
  }
};
