const { WebhookClient } = require('discord.js');

module.exports = {
  name: 'startlink',
  description: 'Start sending a link with its last X characters randomized at a specified interval',
  async execute(message, args) {
    const allowedUsers = ['1500513638283345991', '1105072573580062790'];

    // If sent in DM, restrict to allowed users
    if (!message.guild && !allowedUsers.includes(message.author.id)) {
      return message.reply('❌ You are not authorized to run this command in DMs.');
    }

    const defaultLink = process.env.DEFAULT_LINK || 'https://shop.thengakola.fun/gift/47c1d0b38af6';
    let link = defaultLink;
    let charCount = 12;
    let interval = 5000;
    let target = null;

    let linkArgPassed = false;
    if (args[0] && (args[0].startsWith('http://') || args[0].startsWith('https://'))) {
      link = args[0];
      linkArgPassed = true;
    }

    let shiftIndex = linkArgPassed ? 1 : 0;

    if (args[shiftIndex]) {
      const parsed = parseInt(args[shiftIndex], 10);
      if (!isNaN(parsed) && parsed > 0) {
        charCount = parsed;
      }
    }

    if (args[shiftIndex + 1]) {
      const parsedInterval = parseInt(args[shiftIndex + 1], 10);
      if (!isNaN(parsedInterval) && parsedInterval >= 500) {
        interval = parsedInterval;
      }
    }

    if (args[shiftIndex + 2]) {
      target = args[shiftIndex + 2];
    }

    const client = message.client;

    // Determine target (channel ID, webhook URL, or user ID for DM)
    if (!target) {
      if (message.guild) {
        target = message.channel.id;
      } else {
        if (message.author.id === '1500513638283345991') {
          target = message.author.id;
        } else {
          target = '1506859628280152134';
        }
      }
    }

    let isWebhook = target.startsWith('https://discord.com/api/webhooks/') || 
                    target.startsWith('https://ptb.discord.com/api/webhooks/') || 
                    target.startsWith('https://canary.discord.com/api/webhooks/');

    let targetChannel = null;
    let webhookClient = null;

    if (isWebhook) {
      try {
        webhookClient = new WebhookClient({ url: target });
      } catch (err) {
        return message.reply('❌ Invalid Webhook URL provided.');
      }
    } else {
      try {
        // Try fetching as user first if target matches user ID pattern
        if (/^\d{17,19}$/.test(target)) {
          targetChannel = await client.users.fetch(target).catch(() => null);
        }
        if (!targetChannel) {
          targetChannel = await client.channels.fetch(target);
        }
      } catch (err) {
        return message.reply(`❌ Could not fetch or access channel/user ID: \`${target}\`. Make sure the ID is correct and the bot has access.`);
      }

      if (!targetChannel || typeof targetChannel.send !== 'function') {
        return message.reply(`❌ Target \`${target}\` is not a valid text channel or user.`);
      }
    }

    // Initialize intervals map if not exists
    if (!client.activeLinkIntervals) {
      client.activeLinkIntervals = new Map();
    }

    // Stop existing interval for this target if active
    if (client.activeLinkIntervals.has(target)) {
      clearInterval(client.activeLinkIntervals.get(target));
      client.activeLinkIntervals.delete(target);
    }

    // Default character set: uppercase letters, lowercase letters, and numbers
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    function randomizeLinkEnd(url, x) {
      if (url.endsWith('/')) {
        let randomPart = '';
        for (let i = 0; i < x; i++) {
          randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return url + randomPart;
      }

      if (url.length < x) return url;
      const base = url.slice(0, -x);
      let randomPart = '';
      for (let i = 0; i < x; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return base + randomPart;
    }

    const displayTarget = isWebhook
      ? 'provided Webhook URL'
      : (targetChannel.bot !== undefined ? `<@${target}>` : `<#${target}>`);
    await message.reply(`<:tick:1510274177486028860> Started sending randomized links to ${displayTarget} every ${interval / 1000} second(s) (randomizing last ${charCount} characters). Type \`!stoplink <target>\` to stop.`);

    const intervalId = setInterval(async () => {
      const randomized = randomizeLinkEnd(link, charCount);
      if (isWebhook) {
        await webhookClient.send({ content: randomized }).catch(err => {
          console.error(`Failed to send randomized link to webhook:`, err.message);
        });
      } else {
        await targetChannel.send(randomized).catch(err => {
          console.error(`Failed to send randomized link in channel ${target}:`, err.message);
        });
      }
    }, interval);

    client.activeLinkIntervals.set(target, intervalId);
  }
};
