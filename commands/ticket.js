const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ticket',
  description: 'Send the ticket system button',
  async execute(message) {
    // Only allow admins to send the ticket panel
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const ticketChannelId = process.env.TICKET_PANEL_CHANNEL_ID || '1505164021186433075';
    const targetChannel = await message.guild.channels.fetch(ticketChannelId).catch(() => null);
    if (!targetChannel) {
      return message.reply('❌ Ticket panel channel not found.');
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Support Ticket System')
      .setDescription('Click the button below to create a support ticket.')
      .setColor('#f25858')
      .setFooter({ text: 'Support team will assist you shortly' });

    const button = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('Open Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫');

    const row = new ActionRowBuilder().addComponents(button);

    await targetChannel.send({ embeds: [embed], components: [row] });
    message.reply(`✅ Ticket panel sent to <#${ticketChannelId}>`);
  }
};
