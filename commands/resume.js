const musicUtil = require('../musicUtil');

module.exports = {
  name: 'resume',
  description: 'Resume the paused music',
  async execute(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('⚠️ You need to be in a voice channel to resume music!');
    }

    const serverQueue = musicUtil.queue.get(message.guild.id);
    if (!serverQueue) {
      return message.reply('⚠️ There is nothing playing currently.');
    }

    if (voiceChannel.id !== serverQueue.voiceChannel.id) {
      return message.reply(`⚠️ You must be in the same voice channel (<#${serverQueue.voiceChannel.id}>) to resume the music.`);
    }

    if (serverQueue.player.state.status !== 'paused') {
      return message.reply('⚠️ The music is not paused.');
    }

    serverQueue.player.unpause();
    return message.reply('▶️ Resumed the music!');
  }
};
