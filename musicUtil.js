const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus 
} = require('@discordjs/voice');
const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const { EmbedBuilder } = require('discord.js');

const queue = new Map();

// Bypass play-dl trying to dynamically scrape a SoundCloud client_id from SoundCloud's website,
// which gets blocked by SoundCloud on cloud hosting IPs (e.g. Render.com) and throws a fatal error.
play.setToken({
  soundcloud: {
    client_id: '00000000000000000000000000000000'
  }
}).catch(err => console.error('[MUSIC] Failed to set dummy SoundCloud token:', err));

const YOUTUBE_COOKIE = 'HSID=AlpJMnadEGHeUs0YY; SSID=A-ajQbUsssbA_JxSm; APISID=s-FkaJKUC9VbQVdP/A5lnJkSeznPf0oAUl; SAPISID=dwr6WDmm3CtYp2AC/Aveg_mMLDSmASrT-o; __Secure-1PAPISID=dwr6WDmm3CtYp2AC/Aveg_mMLDSmASrT-o; __Secure-3PAPISID=dwr6WDmm3CtYp2AC/Aveg_mMLDSmASrT-o; SID=g.a000-QjM3B1W8XSeVbNLwZ1dJKTGHRZc72bMzeReP8Q8LMVDPkw2GpfiVwmaJdzQ3_k270W_JQACgYKAcgSARUSFQHGX2MidWSPsM7YOcAqFHuYDwQDKxoVAUF8yKryZtbEJBxMGUdoeR7DngDn0076; __Secure-1PSID=g.a000-QjM3B1W8XSeVbNLwZ1dJKTGHRZc72bMzeReP8Q8LMVDPkw2heuMMbfqYiHxrbdWwUzPNwACgYKAQwSARUSFQHGX2Mi3rWyffcvls5hGcFmGQXdSRoVAUF8yKrLNxi-n_1MIQ8SGH5CLqfl0076; __Secure-3PSID=g.a000-QjM3B1W8XSeVbNLwZ1dJKTGHRZc72bMzeReP8Q8LMVDPkw2lsdViIRDEDVaA4VG5RN36gACgYKAaESARUSFQHGX2MiNSD67o9MR10fnPYvj3QgfxoVAUF8yKrO4SwKZHUZ-WYxyeoSm2UC0076; VISITOR_INFO1_LIVE=1g5bua1i5mI; VISITOR_PRIVACY_METADATA=CgJJThIEGgAgFg%3D%3D; __Secure-YNID=18.YT=W_9QI263tg8iEjJyLSNV7L7W-gG_OVK3pjxbIQ8moJRSvZ4cPXZTnzi8nW4WBHZfWQrjLMVOoimYwL4PXzrZ9Nm0Ea9Fc6vxWMoEv8bdSfqtn4pBn5Q0dUs12OD-RgaNuj_0igSJ60swuXiLsUQFRqFqeKgvzGIpc8wO4j1jNDOIUjNPq-m-mjrTAgNJe6laVyhSXb--XMXrktPAJwIlRJADHeFHS47lkMxPWiJviCLAN1a105-xaRzI86-q9AImOcEIwRSKCqOQlTrHuTwun2iKfeRmIAbvlGL0QimJS61Oxf4-hoUBGqdB7pp71vFfrsKGpqWuLGcb0D_sviqgwQ; YSC=reVW9tXxIIw; __Secure-ROLLOUT_TOKEN=CPit-PaExPDcMxCY4I--iNCUAxj3ja7gltOUAw%3D%3D; PREF=f6=40000080&f4=4000000&tz=Asia.Calcutta&f7=140; LOGIN_INFO=AFmmF2swRgIhALwSOO93cwnPoMf_oSDm4INXQ3Az4TXIpspFXwQ0rEiPAiEAy8eZKGzJ5yQjkRBpQPhdCTIfOKBI6i3vedMItXQ6PkA:QUQ3MjNmeGcyTGZsNVhfbGRVN3RCcERrT21ZYkxKWDVrYXg1QVY0ZjZ2X292Qzl5d2owQjlSdzI5bURaZVpYcUx4MXdnT1JBeXJPa1RzN0ZVSVJlQW9GbXJJX19NTkVSZ3hwZVFGdXU3MzdjT2h3RXk2NjFQcUdGUDVLWHBSM0lGazBCeUVsS0Z2cmtSalFkZ0lFN0FsWjVfdWFibTZfOGtUZDdvb292RnpWaEI4X3hUbndRc1lvS2ds3QPcUxMeHBtN2NwNWxuUk10VFFSZG9XVnd5anVWckVEWkcteXdTdw==; __Secure-1PSIDTS=sidts-CjUBhkeRd2Wc8X-MEQM-Ll-wtLDL2F-q48NnemxtnS4cMZrOA8KA7aY-tIg08ZmoGf3Uz6L5LRAA; __Secure-3PSIDTS=sidts-CjUBhkeRd2Wc8X-MEQM-Ll-wtLDL2F-q48NnemxtnS4cMZrOA8KA7aY-tIg08ZmoGf3Uz6L5LRAA; ST-l3hjtt=session_logininfo=AFmmF2swRgIhALwSOO93cwnPoMf_oSDm4INXQ3Az4TXIpspFXwQ0rEiPAiEAy8eZKGzJ5yQjkRBpQPhdCTIfOKBI6i3vedMItXQ6PkA%3AQUQ3MjNmeGcyTGZsNVhfbGRVN3RCcERrT21ZYkxKWDVrYXg1QVY0ZjZ2X292Qzl5d2owQjlSdzI5bURaZVpYcUx4MXdnT1JBeXJPa1RzN0ZVSVJlQW9GbXJJX19NTkVSZ3hwZVFGdXU3MzdjT2h3RXk2NjFQcUdGUDVLWHBSM0lGazBCeUVsS0Z2cmtSalFkZ0lFN0FsWjVfdWFibTZfOGtUZDdvb292RnpWaEI4X3hUbndRc1lvS2dsM1FPcUxMeHBtN2NwNWxuUk10VFFSZG9XVnd5anVWckVEWkcteXdTdw%3D%3D; ST-tladcw=session_logininfo=AFmmF2swRgIhALwSOO93cwnPoMf_oSDm4INXQ3Az4TXIpspFXwQ0rEiPAiEAy8eZKGzJ5yQjkRBpQPhdCTIfOKBI6i3vedMItXQ6PkA%3AQUQ3MjNmeGcyTGZsNVhfbGRVN3RCcERrT21ZYkxKWDVrYXg1QVY0ZjZ2X292Qzl5d2owQjlSdzI5bURaZVpYcUx4MXdnT1JBeXJPa1RzN0ZVSVJlQW9GbXJJX19NTkVSZ3hwZVFGdXU3MzdjT2h3RXk2NjFQcUdGUDVLWHBSM0lGazBCeUVsS0Z2cmtSalFkZ0lFN0FsWjVfdWFibTZfOGtUZDdvb292RnpWaEI4X3hUbndRc1lvS2dsM1FPcUxMeHBtN2NwNWxuUk10VFFSZG9XVnd5anVWckVEWkcteXdTdw%3D%3D; SIDCC=AKEyXzVWa3jbsRGrw_8Bisd7qm2hgweADwr0U0bZwppcVeTrpYIBgeQsva4j0_Gzoilev3Y7rGs; __Secure-1PSIDCC=AKEyXzUKxWXyhN74kt-7CByrgs-72GA1GQxO_H4owgICoh_06lGwO_VAhmc6muVxuAOk3FkEXQ; __Secure-3PSIDCC=AKEyXzUa0WBvKB9Q-4FycZQOtatYxHNkVCjTeofIXChI5UpNEKwdv_jZ6oc8vD1gJBloIds8lz8';
const targetCookie = process.env.YOUTUBE_COOKIE || YOUTUBE_COOKIE;

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
    console.log(`[MUSIC] Requesting audio stream using @distube/ytdl-core for song: "${song.title}" (${song.url})`);
    
    // Fetch stream using @distube/ytdl-core passing Brave cookies and matching user-agent
    const stream = ytdl(song.url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25, // 32MB buffer
      requestOptions: {
        headers: {
          cookie: targetCookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      }
    });
    
    // Attach error handler to stream to prevent unhandled promise rejection or crash
    stream.on('error', async (err) => {
      console.error(`[MUSIC] Stream error for song "${song.title}":`, err);
      await serverQueue.textChannel.send(`⚠️ Error playing track: **${song.title}** (${err.message || err}). Skipping...`);
      serverQueue.songs.shift();
      playSong(guildId, serverQueue.songs[0]);
    });

    console.log(`[MUSIC] Creating audio resource...`);
    const resource = createAudioResource(stream);

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
    console.error(`[MUSIC] Error starting stream for "${song.title}":`, err);
    await serverQueue.textChannel.send(`⚠️ Error starting stream: **${song.title}** (${err.message || err}). Skipping...`);
    
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
