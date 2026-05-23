const express = require('express');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');

module.exports = {
  async init(client) {
    const channelId = process.env.YT_CHANNEL_ID;
    const port = parseInt(process.env.PORT, 10) || parseInt(process.env.YT_PORT, 10) || 3000;
    const publicUrl = process.env.PUBLIC_URL;
    const callbackPath = process.env.YT_CALLBACK_PATH || '/youtube/callback';
    const callbackUrl = `${publicUrl}${callbackPath}`;
    const verifyToken = process.env.YT_VERIFY_TOKEN || 'yt-verify-token';
    const hubUrl = 'https://pubsubhubbub.appspot.com/subscribe';

    if (!channelId || !publicUrl) {
      console.warn('YouTube webhook not configured: set YT_CHANNEL_ID and PUBLIC_URL in .env');
      console.log('Starting minimal health check server for Koyeb/Render deployment...');
      const app = express();
      app.get('/', (req, res) => res.send('Psybot is active and healthy! 🤖'));
      app.listen(port, () => {
        console.log(`Health check server listening on port ${port}`);
      });
      return;
    }

    const topic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;

    const app = express();
    app.use(express.text({ type: '*/*' }));

    // Root path for Koyeb/Render health check verification
    app.get('/', (req, res) => res.send('Psybot is active and healthy! 🤖'));

    app.get(callbackPath, (req, res) => {
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      if (token !== verifyToken) return res.status(403).send('Invalid verify token');
      return res.send(challenge);
    });

    app.post(callbackPath, async (req, res) => {
      try {
        const parsed = await parseStringPromise(req.body);
        const entries = parsed.feed && parsed.feed.entry ? parsed.feed.entry : [];

        for (const entry of entries) {
          const videoId = entry['yt:videoId'] ? entry['yt:videoId'][0] : null;
          const title = entry.title ? entry.title[0] : 'New video';
          const link = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
          if (!videoId || !link) continue;

          const message = `@everyone\nNew video uploaded: **${title}**\n${link}`;
          const announceChannelId = process.env.DISCORD_ANNOUNCE_CHANNEL_ID;
          const allowedMentions = { parse: ['everyone'] };

          if (announceChannelId) {
            const channel = await client.channels.fetch(announceChannelId).catch(() => null);
            if (channel) {
              await channel.send({ content: message, allowedMentions });
              continue;
            }
          }

          const guild = client.guilds.cache.first();
          if (guild) {
            const chan = guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages'));
            if (chan) await chan.send({ content: message, allowedMentions });
          }
        }

        return res.status(200).send('ok');
      } catch (err) {
        console.error('Failed to parse YouTube notification', err);
        return res.status(500).send('error');
      }
    });

    const webhookListening = await new Promise(resolve => {
      const server = app.listen(port, () => {
        console.log(`YouTube webhook listening on ${port}${callbackPath}`);
        resolve(true);
      });

      server.on('error', err => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`YouTube webhook disabled: port ${port} is already in use.`);
        } else {
          console.error('YouTube webhook server error:', err);
        }
        resolve(false);
      });
    });

    if (!webhookListening) return;

    try {
      await axios.post(hubUrl, new URLSearchParams({
        'hub.mode': 'subscribe',
        'hub.verify': 'async',
        'hub.callback': callbackUrl,
        'hub.topic': topic,
        'hub.verify_token': verifyToken
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      console.log('Subscription request sent to hub for', topic);
    } catch (err) {
      console.error('Failed to send subscribe request to hub:', err.message || err);
    }
  }
};
