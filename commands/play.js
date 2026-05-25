const { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const play = require('play-dl');
const { EmbedBuilder } = require('discord.js');
const musicUtil = require('../musicUtil');

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
      const validate = await play.validate(query);

      if (validate === 'yt_video') {
        const videoInfo = await play.video_info(query);
        songs.push({
          title: videoInfo.video_details.title,
          url: videoInfo.video_details.url,
          duration: videoInfo.video_details.durationRaw,
          thumbnail: videoInfo.video_details.thumbnails[0]?.url || '',
          requester: message.author
        });
      } else if (validate === 'yt_playlist') {
        const playlist = await play.playlist_info(query, { incomplete: true });
        const videos = await playlist.all_videos();
        for (const video of videos) {
          songs.push({
            title: video.title,
            url: video.url,
            duration: video.durationRaw || 'Unknown',
            thumbnail: video.thumbnails[0]?.url || '',
            requester: message.author
          });
        }
        await message.channel.send(`✅ Added **${videos.length}** songs from playlist **${playlist.title}** to the queue.`);
      } else if (validate && validate.startsWith('sp_')) {
        // Spotify Link
        const spotifyData = await play.spotify(query);
        if (spotifyData.type === 'track') {
          const searchResult = await play.search(`${spotifyData.name} ${spotifyData.artists[0]?.name}`, { limit: 1 });
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
          await message.channel.send(`🔄 Loading Spotify ${spotifyData.type}... (processing first 25 tracks)`);
          for (const track of tracks) {
            if (songs.length >= 25) break;
            const searchResult = await play.search(`${track.name} ${track.artists[0]?.name}`, { limit: 1 });
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
          await message.channel.send(`✅ Added **${songs.length}** songs from Spotify **${spotifyData.name}**.`);
        }
      } else if (validate === 'so_track') {
        const soundcloudInfo = await play.soundcloud(query);
        songs.push({
          title: soundcloudInfo.name,
          url: soundcloudInfo.permalink,
          duration: soundcloudInfo.durationInMs ? new Date(soundcloudInfo.durationInMs).toISOString().slice(11, 19) : '00:00',
          thumbnail: soundcloudInfo.thumbnail || '',
          requester: message.author
        });
      } else {
        // Search term
        const searchResults = await play.search(query, { limit: 1 });
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
      console.error(err);
      await loadingMessage.delete().catch(() => {});
      return message.reply('❌ An error occurred while searching for the track. Please try again.');
    }

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
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        queueConstruct.connection = connection;
        queueConstruct.player = player;

        // Player transitions
        player.on(AudioPlayerStatus.Idle, () => {
          // Play next song
          queueConstruct.songs.shift();
          musicUtil.playSong(message.guild.id, queueConstruct.songs[0]);
        });

        player.on('error', error => {
          console.error('Audio Player Error:', error);
          queueConstruct.textChannel.send(`⚠️ Audio player error: ${error.message}. Skipping...`);
          queueConstruct.songs.shift();
          musicUtil.playSong(message.guild.id, queueConstruct.songs[0]);
        });

        // Connection transitions (cleanup on manual disconnect)
        connection.on(VoiceConnectionStatus.Destroyed, () => {
          musicUtil.queue.delete(message.guild.id);
        });

        // Start playback
        await musicUtil.playSong(message.guild.id, queueConstruct.songs[0]);
      } catch (err) {
        console.error('Voice Join Error:', err);
        musicUtil.queue.delete(message.guild.id);
        return message.reply(`❌ Could not join the voice channel: ${err.message}`);
      }
    } else {
      serverQueue.songs.push(...songs);
      if (songs.length === 1) {
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
