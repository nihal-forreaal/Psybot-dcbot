const { EmbedBuilder } = require('discord.js');
const musicUtil = require('../musicUtil');

module.exports = {
  name: 'queue',
  description: 'Show the upcoming tracks in the music queue',
  async execute(message) {
    const serverQueue = musicUtil.queue.get(message.guild.id);
    if (!serverQueue || serverQueue.songs.length === 0) {
      return message.reply('🎵 The queue is currently empty. Use `!play <song>` to add tracks!');
    }

    const currentSong = serverQueue.songs[0];
    const upcomingSongs = serverQueue.songs.slice(1, 11); // Show next 10 songs

    const embed = new EmbedBuilder()
      .setTitle(`🎵 Music Queue - ${message.guild.name}`)
      .setColor('#0f8c8c')
      .setDescription(`**🔊 Now Playing:**\n[${currentSong.title}](${currentSong.url}) | \`${currentSong.duration}\` (Requested by: ${currentSong.requester})`)
      .setTimestamp();

    if (upcomingSongs.length > 0) {
      const queueList = upcomingSongs
        .map((song, idx) => `\`${idx + 1}.\` [${song.title}](${song.url}) | \`${song.duration}\` (Requested by: ${song.requester})`)
        .join('\n');
      
      embed.addFields({ name: '📋 Next Up:', value: queueList });
    } else {
      embed.addFields({ name: '📋 Next Up:', value: 'No tracks in queue. Add some with `!play`!' });
    }

    if (serverQueue.songs.length > 11) {
      embed.setFooter({ text: `And ${serverQueue.songs.length - 11} more songs in queue...` });
    } else {
      embed.setFooter({ text: `${serverQueue.songs.length} song(s) in queue` });
    }

    return message.channel.send({ embeds: [embed] });
  }
};
