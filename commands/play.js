const { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const play = require('play-dl');
const { EmbedBuilder } = require('discord.js');
const musicUtil = require('../musicUtil');

// Helper to run an async operation with a timeout
function withTimeout(promise, ms, errorMessage) {
  let timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeout]);
}

module.exports = {
  name: 'play',
  description: 'Play music in your voice channel from YouTube, SoundCloud, or Spotify',
  async execute(message, args) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('⚠️ You need to be in a voice channel to play music!');
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return message.reply('⚠️ I do not have permission to join or speak in your voice channel!');
    }

    if (!args || args.length === 0) {
      return message.reply('⚠️ Please provide a song name or a link (YouTube, SoundCloud, Spotify)!');
    }

    const query = args.join(' ');
    const serverQueue = musicUtil.queue.get(message.guild.id);

    // If bot is already playing, make sure the user is in the same VC
    if (serverQueue && voiceChannel.id !== serverQueue.voiceChannel.id) {
      return message.reply(`⚠️ You must be in the same voice channel (<#${serverQueue.voiceChannel.id}>) as the bot to request songs.`);
    }

    let songs = [];
    const loadingMessage = await message.reply('🔍 Searching and processing track...');

    try {
      console.log(`[MUSIC] Validating query: "${query}"`);
      const validate = await withTimeout(play.validate(query), 12000, 'YouTube/SoundCloud/Spotify validation timed out.');
      console.log(`[MUSIC] Validation result: "${validate}"`);

      if (validate === 'yt_video') {
        console.log(`[MUSIC] Fetching YouTube video info using play-dl for: "${query}"`);
        
        const videoInfo = await withTimeout(
          play.video_info(query),
          12000,
          'YouTube video info request timed out.'
        );
        
        const details = videoInfo.video_details;
        console.log(`[MUSIC] Video info fetched: "${details.title}"`);
        
        songs.push({
          title: details.title,
          url: details.url,
          duration: details.durationRaw || '00:00',
          thumbnail: details.thumbnails[0]?.url || '',
          requester: message.author
        });
      } else if (validate === 'yt_playlist') {
        console.log(`[MUSIC] Fetching playlist info for: "${query}"`);
        const playlist = await withTimeout(play.playlist_info(query, { incomplete: true }), 15000, 'YouTube playlist request timed out.');
        const videos = await playlist.all_videos();
        console.log(`[MUSIC] Playlist info fetched: "${playlist.title}" with ${videos.length} videos`);
        for (const video of videos) {
          songs.push({
            title: video.title,
            url: video.url,
            duration: video.durationRaw || 'Unknown',
            thumbnail: video.thumbnails[0]?.url || '',
            requester: message.author
          });
        }
        await message.channel.send(`` + `✅ Added **${videos.length}** songs from playlist **${playlist.title}** to the queue.`);
      } else if (validate && validate.startsWith('sp_')) {
        // Spotify Link
        console.log(`[MUSIC] Fetching Spotify data for: "${query}"`);
        const spotifyData = await withTimeout(play.spotify(query), 15000, 'Spotify metadata request timed out.');
        console.log(`[MUSIC] Spotify type: "${spotifyData.type}"`);
        if (spotifyData.type === 'track') {
          console.log(`[MUSIC] Searching YouTube for Spotify track: "${spotifyData.name}"`);
          const searchResult = await withTimeout(play.search(`${spotifyData.name} ${spotifyData.artists[0]?.name}`, { limit: 1 }), 12000, 'Spotify track search on YouTube timed out.');
          if (searchResult.length > 0) {
            songs.push({
              title: spotifyData.name,
              url: searchResult[0].url,
              duration: searchResult[0].durationRaw || '00:00',
              thumbnail: spotifyData.thumbnail?.url || searchResult[0].thumbnails[0]?.url || '',
              requester: message.author
            });
          }
        } else {
          // Playlist or Album
          const tracks = await spotifyData.all_tracks();
          console.log(`[MUSIC] Spotify playlist/album contains ${tracks.length} tracks. Resolving first 25...`);
          await message.channel.send(`` + `🔄 Loading Spotify ${spotifyData.type}... (processing first 25 tracks)`);
          for (const track of tracks) {
            if (songs.length >= 25) break;
            const searchResult = await play.search(`${track.name} ${track.artists[0]?.name}`, { limit: 1 }).catch(() => []);
            if (searchResult.length > 0) {
              songs.push({
                title: track.name,
                url: searchResult[0].url,
                duration: searchResult[0].durationRaw || '00:00',
                thumbnail: track.thumbnail?.url || searchResult[0].thumbnails[0]?.url || '',
                requester: message.author
              });
            }
          }
          await message.channel.send(`` + `✅ Added **${songs.length}** songs from Spotify **${spotifyData.name}**.`);
        }
      } else if (validate === 'so_track') {
        console.log(`[MUSIC] Fetching SoundCloud info for: "${query}"`);
        const soundcloudInfo = await withTimeout(play.soundcloud(query), 12000, 'SoundCloud request timed out.');
        songs.push({
          title: soundcloudInfo.name,
          url: soundcloudInfo.permalink,
          duration: soundcloudInfo.durationInMs ? new Date(soundcloudInfo.durationInMs).toISOString().slice(11, 19) : '00:00',
          thumbnail: soundcloudInfo.thumbnail || '',
          requester: message.author
        });
      } else {
        // Search term
        console.log(`[MUSIC] Searching YouTube for query: "${query}"`);
        const searchResults = await withTimeout(play.search(query, { limit: 1 }), 12000, 'YouTube search request timed out.');
        console.log(`[MUSIC] Search complete. Found: ${searchResults.length} results`);
        if (searchResults.length === 0) {
          await loadingMessage.delete().catch(() => {});
          return message.reply('❌ No results found on YouTube.');
        }
        const video = searchResults[0];
        songs.push({
          title: video.title,
          url: video.url,
          duration: video.durationRaw,
          thumbnail: video.thumbnails[0]?.url || '',
          requester: message.author
        });
      }
    } catch (err) {
      console.error('[MUSIC] Error during search/resolve:', err);
      await loadingMessage.delete().catch(() => {});
      return message.reply(`❌ Connection error: **${err.message || err}**. Please try again.`);
    }

    console.log(`[MUSIC] Search phase completed. Deleting loading message.`);
    await loadingMessage.delete().catch(() => {});

    if (songs.length === 0) {
      return message.reply('❌ No songs could be resolved.');
    }

    if (!serverQueue) {
      // Create new queue object
      const queueConstruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        player: null,
        songs: [],
        timeoutId: null
      };

      musicUtil.queue.set(message.guild.id, queueConstruct);
      queueConstruct.songs.push(...songs);

      try {
        console.log(`[MUSIC] Joining voice channel: "${voiceChannel.name}" (${voiceChannel.id})`);
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

        console.log('[MUSIC] Creating audio player...');
        const player = createAudioPlayer();
        connection.subscribe(player);

        queueConstruct.connection = connection;
        queueConstruct.player = player;

        // Player transitions
        player.on(AudioPlayerStatus.Idle, () => {
          console.log('[MUSIC] Audio player is Idle. Playing next song in queue...');
          queueConstruct.songs.shift();
          musicUtil.playSong(message.guild.id, queueConstruct.songs[0]);
        });

        player.on('error', error => {
          console.error('[MUSIC] Audio Player Error:', error);
          queueConstruct.textChannel.send(`⚠️ Audio player error: ${error.message}. Skipping...`);
          queueConstruct.songs.shift();
          musicUtil.playSong(message.guild.id, queueConstruct.songs[0]);
        });

        // Connection transitions (cleanup on manual disconnect)
        connection.on(VoiceConnectionStatus.Destroyed, () => {
          console.log('[MUSIC] Voice connection was destroyed. Cleaning up queue...');
          musicUtil.queue.delete(message.guild.id);
        });

        // Start playback
        console.log(`[MUSIC] Starting playback of: "${queueConstruct.songs[0].title}"`);
        await musicUtil.playSong(message.guild.id, queueConstruct.songs[0]);
      } catch (err) {
        console.error('[MUSIC] Voice Join Error:', err);
        musicUtil.queue.delete(message.guild.id);
        return message.reply(`❌ Could not join the voice channel: ${err.message}`);
      }
    } else {
      console.log(`[MUSIC] Queue exists. Adding ${songs.length} song(s) to queue.`);
      const wasEmpty = serverQueue.songs.length === 0;
      serverQueue.songs.push(...songs);

      if (wasEmpty) {
        console.log(`[MUSIC] Queue was empty. Starting playback of: "${serverQueue.songs[0].title}"`);
        await musicUtil.playSong(message.guild.id, serverQueue.songs[0]);
      } else if (songs.length === 1) {
        const embed = new EmbedBuilder()
          .setTitle('📥 Song Added to Queue')
          .setDescription(`[${songs[0].title}](${songs[0].url})`)
          .addFields(
            { name: '⏱️ Duration', value: `\`${songs[0].duration}\``, inline: true },
            { name: '📊 Position in Queue', value: `\`#${serverQueue.songs.length - 1}\``, inline: true }
          )
          .setColor('#0f8c8c')
          .setThumbnail(songs[0].thumbnail)
          .setTimestamp();
        
        return message.channel.send({ embeds: [embed] });
      }
    }
  }
};
