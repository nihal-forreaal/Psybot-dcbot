const musicUtil = require('../musicUtil');

module.exports = {
  name: 'stop',
  description: 'Stop all music playback and disconnect the bot',
  async execute(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('⚠️ You need to be in a voice channel to stop music!');
    }

    const serverQueue = musicUtil.queue.get(message.guild.id);
    if (!serverQueue) {
      return message.reply('⚠️ There is nothing playing currently.');
    }

    if (voiceChannel.id !== serverQueue.voiceChannel.id) {
      return message.reply(`⚠️ You must be in the same voice channel (<#${serverQueue.voiceChannel.id}>) to stop the music.`);
    }

    musicUtil.cleanupQueue(message.guild.id);
    return message.reply('⏹️ Stopped playback and disconnected from the voice channel!');
  }
};
