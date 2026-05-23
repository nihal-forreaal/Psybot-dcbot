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
      .setTitle('🎫 Support Ticket Portal')
      .setDescription(
        'Welcome to the **Psybot Support Center**. If you require assistance, please click the button below to initiate a private support ticket with our server staff.\n\n' +
        '🚨 **Ticket Guidelines:**\n' +
        '▪️ State your issue or question clearly in your first message.\n' +
        '▪️ Attach relevant screenshots or logs if applicable.\n' +
        '▪️ Do not ping staff; a representative will assist you shortly.\n' +
        '▪️ Abuse or spamming of tickets will lead to a temporary blacklist.'
      )
      .setColor('#ff3333') // Crimson Red to match red & black theme
      .addFields(
        { name: '🕒 Service Hours', value: '`24/7 Availability`', inline: true },
        { name: '📁 Topics Handled', value: '`General Help`, `Appeals`, `Bug Reports`', inline: true }
      )
      .setFooter({ text: 'Psybot Support Services', iconURL: message.client.user.displayAvatarURL() })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('Create Support Ticket')
      .setStyle(ButtonStyle.Danger) // Danger (Red) for red/black theme
      .setEmoji('🎫');

    const row = new ActionRowBuilder().addComponents(button);

    await targetChannel.send({ embeds: [embed], components: [row] });
    message.reply(`✅ Ticket panel sent to <#${ticketChannelId}>`);
  }
};
