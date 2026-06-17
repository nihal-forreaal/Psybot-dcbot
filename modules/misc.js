'use strict';

const { EmbedBuilder, ChannelType } = require('discord.js');

/**
 * Handles the /misc slash command group.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleMiscCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'avatar') {
    return await handleAvatar(interaction);
  } else if (subcommand === 'serverinfo') {
    return await handleServerInfo(interaction);
  } else if (subcommand === 'userinfo') {
    return await handleUserInfo(interaction);
  }
}

/**
 * Handles the /misc avatar subcommand.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleAvatar(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;

  const avatarPng = user.avatarURL({ extension: 'png', size: 4096 });
  const avatarJpg = user.avatarURL({ extension: 'jpg', size: 4096 });
  const avatarWebp = user.avatarURL({ extension: 'webp', size: 4096 });
  const avatarGif = user.avatar && user.avatar.startsWith('a_') 
    ? user.avatarURL({ extension: 'gif', size: 4096 }) 
    : null;

  const formats = [
    `[PNG](${avatarPng})`,
    `[JPG](${avatarJpg})`,
    `[WEBP](${avatarWebp})`
  ];
  if (avatarGif) {
    formats.push(`[GIF](${avatarGif})`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`👤 ${user.username}'s Avatar`)
    .setDescription(`Download formats: ${formats.join(' | ')}`)
    .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
    .setColor('#00d0ff')
    .setFooter({ 
      text: `Requested by ${interaction.user.tag}`, 
      iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
    })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

/**
 * Handles the /misc serverinfo subcommand.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleServerInfo(interaction) {
  const { guild } = interaction;
  if (!guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  // Ensure members cache is somewhat populated
  await guild.members.fetch().catch(() => {});

  const totalMembers = guild.memberCount;
  const botCount = guild.members.cache.filter(m => m.user.bot).size;
  const humanCount = totalMembers - botCount;

  const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
  const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
  const categoryChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
  const totalChannels = guild.channels.cache.size;

  const rolesCount = guild.roles.cache.size;
  const premiumSubscriptionCount = guild.premiumSubscriptionCount || 0;
  const premiumTier = guild.premiumTier;

  // Format Verification Level to be user friendly
  const verificationLevels = {
    0: 'None',
    1: 'Low (Verified Email)',
    2: 'Medium (Registered on Discord for 5+ min)',
    3: 'High (Member of guild for 10+ min)',
    4: 'Very High (Verified Phone Number)'
  };
  const verifLevelStr = verificationLevels[guild.verificationLevel] || guild.verificationLevel.toString();

  const embed = new EmbedBuilder()
    .setTitle(`👑 ${guild.name} Server Diagnostics`)
    .setColor('#00d0ff')
    .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
    .addFields(
      { name: '📋 General Info', value: `• **Owner:** <@${guild.ownerId}> (ID: \`${guild.ownerId}\`)\n• **Server ID:** \`${guild.id}\`\n• **Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:F> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: false },
      { name: '👥 Members', value: `• **Total:** \`${totalMembers}\`\n• **Humans:** \`${humanCount}\`\n• **Bots:** \`${botCount}\``, inline: true },
      { name: '📡 Channels & Roles', value: `• **Text Channels:** \`${textChannels}\`\n• **Voice Channels:** \`${voiceChannels}\`\n• **Categories:** \`${categoryChannels}\` (Total: \`${totalChannels}\`)\n• **Roles Count:** \`${rolesCount}\``, inline: true },
      { name: '💎 Server Boosts', value: `• **Tier:** \`Tier ${premiumTier}\`\n• **Boost Count:** \`${premiumSubscriptionCount}\``, inline: true },
      { name: '🔒 Security Settings', value: `• **Verification Level:** \`${verifLevelStr}\``, inline: false }
    )
    .setFooter({ 
      text: `Requested by ${interaction.user.tag}`, 
      iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
    })
    .setTimestamp();

  const bannerUrl = guild.bannerURL({ size: 1024 });
  if (bannerUrl) {
    embed.setImage(bannerUrl);
  }

  return interaction.reply({ embeds: [embed] });
}

/**
 * Handles the /misc userinfo subcommand.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleUserInfo(interaction) {
  const { guild } = interaction;
  if (!guild) {
    return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
  }

  const user = interaction.options.getUser('user') || interaction.user;
  const member = await guild.members.fetch(user.id).catch(() => null);

  if (!member) {
    return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
  }

  const roles = member.roles.cache
    .filter(r => r.id !== guild.id) // exclude @everyone
    .map(r => r.toString());
  
  const rolesDisplay = roles.length > 0
    ? (roles.length > 20 ? `${roles.slice(0, 20).join(', ')}... and ${roles.length - 20} more` : roles.join(', '))
    : 'None';

  const keyPerms = [];
  if (member.permissions.has('Administrator')) {
    keyPerms.push('Administrator');
  } else {
    if (member.permissions.has('ManageGuild')) keyPerms.push('Manage Server');
    if (member.permissions.has('ManageChannels')) keyPerms.push('Manage Channels');
    if (member.permissions.has('ManageRoles')) keyPerms.push('Manage Roles');
    if (member.permissions.has('KickMembers')) keyPerms.push('Kick Members');
    if (member.permissions.has('BanMembers')) keyPerms.push('Ban Members');
    if (member.permissions.has('ManageMessages')) keyPerms.push('Manage Messages');
  }
  const keyPermsDisplay = keyPerms.length > 0 ? keyPerms.join(', ') : 'None';

  const embed = new EmbedBuilder()
    .setTitle(`👤 Server Member Diagnostics: ${user.username}`)
    .setColor('#00d0ff')
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
    .addFields(
      { name: '👤 User Information', value: `• **Username / Tag:** \`${user.tag}\` (Mention: ${user})\n• **User ID:** \`${user.id}\`\n• **Bot Account:** \`${user.bot ? 'Yes' : 'No'}\`\n• **Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:F> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: false },
      { name: '🛡️ Server Member Details', value: `• **Server Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)\n• **Nickname:** \`${member.nickname || 'None'}\`\n• **Highest Role:** ${member.roles.highest}`, inline: false },
      { name: '🔑 Key Permissions', value: `\`${keyPermsDisplay}\``, inline: false },
      { name: `🎭 Roles [${roles.length}]`, value: rolesDisplay, inline: false }
    )
    .setFooter({ 
      text: `Requested by ${interaction.user.tag}`, 
      iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
    })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

module.exports = { handleMiscCommand };
