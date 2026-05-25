const musicUtil = require('../musicUtil');

module.exports = {
  name: 'skip',
  description: 'Skip the currently playing song',
  async execute(message) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('⚠️ You need to be in a voice channel to skip music!');
    }

    const serverQueue = musicUtil.queue.get(message.guild.id);
    if (!serverQueue) {
      return message.reply('⚠️ There is nothing playing that I could skip.');
    }

    if (voiceChannel.id !== serverQueue.voiceChannel.id) {
      return message.reply(`⚠️ You must be in the same voice channel (<#${serverQueue.voiceChannel.id}>) to skip songs.`);
    }

    // Stopping the player triggers the Idle transition, which automatically handles playing the next track.
    serverQueue.player.stop();
    return message.reply('⏭️ Skipped the current song!');
  }
};
