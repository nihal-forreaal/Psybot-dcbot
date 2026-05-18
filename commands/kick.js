const targetChannelId = '1505909671918043258';

module.exports = {
  name: 'kick',
  description: 'Kicks a member from the server (requires access to channel 1505909671918043258)',
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
      return message.reply('❌ Please mention a user to kick or provide their ID.');
    }

    if (!targetMember.kickable) {
      return message.reply('❌ I cannot kick this user. They may have a higher role than me.');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';
    await targetMember.kick(reason);
    message.reply(`✅ Successfully kicked **${targetMember.user.tag}**.`);
  }
};
