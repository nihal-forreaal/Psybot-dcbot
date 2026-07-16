'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

/**
 * Registers guildMemberAdd event to send styled welcome greetings.
 * @param {import('discord.js').Client} client
 */
function register(client) {
  client.on('guildMemberAdd', async member => {
    try {
      const channelUrl = 'https://www.youtube.com/@psybotlive';
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('Welcome!')
        .setDescription("We're glad you're here.\nJump in anytime.")
        .setColor('#57F287');

      const channelButton = new ButtonBuilder()
        .setLabel('Psybot Live Channel')
        .setStyle(ButtonStyle.Link)
        .setURL(channelUrl);

      const welcomeMessage = {
        content: `Welcome to Psybot Gaming, ${member.user}!`,
        embeds: [welcomeEmbed],
        components: [new ActionRowBuilder().addComponents(channelButton)],
      };

      const welcomeChannelId = process.env.WELCOME_CHANNEL_ID || '1445406874231898153';
      const welcomeChannel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
      if (welcomeChannel) {
        await welcomeChannel.send(welcomeMessage);
      } else {
        console.warn(`Welcome channel ${welcomeChannelId} not found.`);
      }
    } catch (err) {
      console.error(`Could not send welcome message for ${member.user.tag}:`, err.message);
    }
  });
}

module.exports = { register };
