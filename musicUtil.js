const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus 
} = require('@discordjs/voice');
const play = require('play-dl');
const { EmbedBuilder } = require('discord.js');

const queue = new Map();

/**
 * Play the next song in the guild queue.
 */
async function playSong(guildId, song) {
  const serverQueue = queue.get(guildId);
  if (!serverQueue) return;

  if (!song) {
    // Queue is empty, start a 3-minute disconnect timeout
    serverQueue.textChannel.send('🎵 Queue is empty. Leaving voice channel soon...');
    
    serverQueue.timeoutId = setTimeout(() => {
      cleanupQueue(guildId);
    }, 180000); // 3 minutes
    return;
  }

  // Clear any existing idle timeout
  if (serverQueue.timeoutId) {
    clearTimeout(serverQueue.timeoutId);
    serverQueue.timeoutId = null;
  }

  try {
    // Fetch stream using play-dl
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });

    serverQueue.player.play(resource);

    const embed = new EmbedBuilder()
      .setTitle('🎶 Now Playing')
      .setDescription(`[${song.title}](${song.url})`)
      .addFields(
        { name: '⏱️ Duration', value: `\`${song.duration}\``, inline: true },
        { name: '👤 Requested By', value: `${song.requester}`, inline: true }
      )
      .setColor('#0f8c8c')
      .setThumbnail(song.thumbnail)
      .setTimestamp();

    await serverQueue.textChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Error playing song ${song.title}:`, err);
    await serverQueue.textChannel.send(`⚠️ Error playing track: **${song.title}**. Skipping...`);
    
    // Play next song
    serverQueue.songs.shift();
    playSong(guildId, serverQueue.songs[0]);
  }
}

/**
 * Clean up guild voice connection and remove from queue map.
 */
function cleanupQueue(guildId) {
  const serverQueue = queue.get(guildId);
  if (!serverQueue) return;

  if (serverQueue.timeoutId) {
    clearTimeout(serverQueue.timeoutId);
  }

  try {
    if (serverQueue.connection) {
      serverQueue.connection.destroy();
    }
  } catch (err) {
    console.error('Error destroying voice connection:', err);
  }

  queue.delete(guildId);
}

module.exports = {
  queue,
  playSong,
  cleanupQueue
};
