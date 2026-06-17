'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

/**
 * Registers the guildMemberAdd event on the client.
 * Sends a welcome message with an embed and a link to the Psybot Live channel.
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
        .setLabel('Psybot Live channel')
        .setStyle(ButtonStyle.Link)
        .setURL(channelUrl);

      const welcomeChannel = await member.guild.channels.fetch('1445406874231898153').catch(() => null);
      if (welcomeChannel) {
        await welcomeChannel.send({
          content: `Welcome to Psybot Gaming, ${member.user}!`,
          embeds: [welcomeEmbed],
          components: [new ActionRowBuilder().addComponents(channelButton)],
        });
      } else {
        console.warn('Welcome channel 1445406874231898153 not found.');
      }
    } catch (err) {
      console.error(`Could not send welcome message for ${member.user.tag}:`, err.message);
    }
  });
}

module.exports = { register };
