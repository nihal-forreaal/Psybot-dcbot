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

// Helper to run an async operation with a timeout
function withTimeout(promise, ms, errorMessage) {
  let timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeout]);
}

/**
 * Play the next song in the guild queue.
 */
async function playSong(guildId, song) {
  const serverQueue = queue.get(guildId);
  if (!serverQueue) {
    console.log(`[MUSIC] No queue found for guild: ${guildId}`);
    return;
  }

  if (!song) {
    console.log(`[MUSIC] Queue is empty for guild: ${guildId}. Setting disconnect timeout.`);
    serverQueue.textChannel.send('🎵 Queue is empty. Leaving voice channel soon...');
    
    serverQueue.timeoutId = setTimeout(() => {
      console.log(`[MUSIC] Disconnect timeout triggered for guild: ${guildId}`);
      cleanupQueue(guildId);
    }, 180000); // 3 minutes
    return;
  }

  // Clear any existing idle timeout
  if (serverQueue.timeoutId) {
    console.log(`[MUSIC] Clearing disconnect timeout for guild: ${guildId}`);
    clearTimeout(serverQueue.timeoutId);
    serverQueue.timeoutId = null;
  }

  try {
    console.log(`[MUSIC] Requesting audio stream from play-dl for song: "${song.title}" (${song.url})`);
    
    // Fetch stream using play-dl with a 15-second timeout
    const stream = await withTimeout(
      play.stream(song.url),
      15000,
      'Failed to establish audio stream (request timed out).'
    );
    
    console.log(`[MUSIC] Stream generated. Input type: ${stream.type}`);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });

    console.log('[MUSIC] Playing resource on audio player...');
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
    console.error(`[MUSIC] Error playing song "${song.title}":`, err);
    await serverQueue.textChannel.send(`⚠️ Error playing track: **${song.title}** (${err.message || err}). Skipping...`);
    
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
      console.log(`[MUSIC] Destroying voice connection for guild: ${guildId}`);
      serverQueue.connection.destroy();
    }
  } catch (err) {
    console.error('[MUSIC] Error destroying voice connection:', err);
  }

  queue.delete(guildId);
}

module.exports = {
  queue,
  playSong,
  cleanupQueue
};
