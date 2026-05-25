const musicUtil = require('../musicUtil');

module.exports = {
  name: 'pause',
  description: 'Pause the currently playing music',
  async execute(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('⚠️ You need to be in a voice channel to pause music!');
    }

    const serverQueue = musicUtil.queue.get(message.guild.id);
    if (!serverQueue) {
      return message.reply('⚠️ There is nothing playing currently.');
    }

    if (voiceChannel.id !== serverQueue.voiceChannel.id) {
      return message.reply(`⚠️ You must be in the same voice channel (<#${serverQueue.voiceChannel.id}>) to pause the music.`);
    }

    if (serverQueue.player.state.status === 'paused') {
      return message.reply('⚠️ The music is already paused.');
    }

    serverQueue.player.pause();
    return message.reply('⏸️ Paused the music! Use `!resume` to continue playing.');
  }
};
