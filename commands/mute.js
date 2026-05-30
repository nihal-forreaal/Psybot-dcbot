const targetChannelId = '1505909671918043258';

module.exports = {
  name: 'mute',
  description: 'Server mutes/unmutes a member in voice channels (requires access to channel 1505909671918043258)',
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
      return message.reply('❌ Please mention a user to mute or provide their ID.');
    }

    const voiceState = targetMember.voice;
    if (!voiceState.channel) {
      return message.reply('❌ That user is not in a voice channel.');
    }

    if (voiceState.serverMute) {
      await voiceState.setMute(false);
      return message.reply(`<:tick:1510274177486028860> Successfully server-unmuted **${targetMember.user.tag}**.`);
    } else {
      await voiceState.setMute(true);
      return message.reply(`<:tick:1510274177486028860> Successfully server-muted **${targetMember.user.tag}**.`);
    }
  }
};
