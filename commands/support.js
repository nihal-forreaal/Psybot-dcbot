const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'support',
  description: 'Get help from the support team',
  async execute(message) {
    const ticketChannelId = process.env.TICKET_PANEL_CHANNEL_ID || '1505164021186433075';
    const targetChannel = await message.guild.channels.fetch(ticketChannelId).catch(() => null);
    if (!targetChannel) {
      return message.reply('❌ Ticket panel channel not found.');
    }

    const embed = new EmbedBuilder()
      .setTitle('Support')
      .setDescription('Need help? Open a support ticket and staff will assist you.')
      .setColor('#5865F2')
      .setFooter({ text: 'Please explain your issue clearly in the ticket.' });

    const button = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('Open Ticket')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await targetChannel.send({ embeds: [embed], components: [row] });
    await message.reply(`<:tick:1510274177486028860> Ticket panel sent to <#${ticketChannelId}>`);
  },
};
