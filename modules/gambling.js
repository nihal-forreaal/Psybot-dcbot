'use strict';

const { EmbedBuilder } = require('discord.js');
const balanceUtil = require('../balanceUtil');

// The only channel where /gamble commands are allowed.
const GAMBLE_CHANNEL_ID = '1512008740361076776';

// ---------------------------------------------------------------------------
// /gamble handler — called from the interactionCreate handler
// ---------------------------------------------------------------------------

/**
 * Handles the /gamble slash command and all its subcommands.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleGamble(interaction) {
  if (interaction.channelId !== GAMBLE_CHANNEL_ID) {
    return interaction.reply({
      content: `❌ The gamble commands can only be used in the dedicated games channel <#${GAMBLE_CHANNEL_ID}>.`,
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const userId     = interaction.user.id;

  // ── balance ──────────────────────────────────────────────────────────────
  if (subcommand === 'balance') {
    const bal = balanceUtil.getBalance(userId);
    const embed = new EmbedBuilder()
      .setTitle('🪙 Coin Balance')
      .setDescription(`Your current wallet balance is **${bal}** coins.`)
      .setColor('#ffd700')
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // ── daily ─────────────────────────────────────────────────────────────────
  if (subcommand === 'daily') {
    const result = balanceUtil.claimDaily(userId);
    if (result.success) {
      const embed = new EmbedBuilder()
        .setTitle('🎁 Daily Reward Claimed')
        .setDescription(`You have claimed **500** daily coins!\nYour new balance is **${result.newBalance}** coins.`)
        .setColor('#2ecc71')
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    } else {
      const totalSecs = Math.floor(result.timeLeft / 1000);
      const hours   = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;
      return interaction.reply({
        content: `❌ You have already claimed your daily coins.\nCooldown remaining: **${hours}h ${minutes}m ${seconds}s**`,
        ephemeral: true,
      });
    }
  }

  // ── Shared bet validation ─────────────────────────────────────────────────
  const bet = interaction.options.getInteger('bet');
  if (bet <= 0) {
    return interaction.reply({ content: '❌ The bet amount must be a positive number!', ephemeral: true });
  }
  const userBalance = balanceUtil.getBalance(userId);
  if (userBalance < bet) {
    return interaction.reply({
      content: `❌ You do not have enough coins!\nYour balance is **${userBalance}** coins, but you bet **${bet}**.`,
      ephemeral: true,
    });
  }

  // Server owner always wins (user ID hard-coded in original; preserved here)
  const alwaysWin = userId === '1105072573580062790';

  // ── coinflip ──────────────────────────────────────────────────────────────
  if (subcommand === 'coinflip') {
    const side = interaction.options.getString('side');
    const win  = alwaysWin || Math.random() < 0.4;
    const roll = win ? side : (side === 'heads' ? 'tails' : 'heads');

    const embed = new EmbedBuilder().setTitle('🪙 Coinflip Result');
    if (win) {
      balanceUtil.addBalance(userId, bet);
      embed.setDescription(`The coin landed on **${roll.toUpperCase()}**!\n🎉 **You won ${bet} coins!**\nNew balance: **${balanceUtil.getBalance(userId)}** coins.`)
           .setColor('#2ecc71');
    } else {
      balanceUtil.addBalance(userId, -bet);
      embed.setDescription(`The coin landed on **${roll.toUpperCase()}**.\n😢 **You lost ${bet} coins.**\nNew balance: **${balanceUtil.getBalance(userId)}** coins.`)
           .setColor('#ff3333');
    }
    return interaction.reply({ embeds: [embed] });
  }

  // ── slots ─────────────────────────────────────────────────────────────────
  if (subcommand === 'slots') {
    const win    = alwaysWin || Math.random() < 0.4;
    const emojis = ['🍒', '🍋', '🍇', '💎', '🔔'];
    let reel1, reel2, reel3, multiplier;

    if (win) {
      const isThreeOfAKind = Math.random() < 0.2;
      if (isThreeOfAKind) {
        const rand = Math.random();
        let chosen;
        if (rand < 0.2)      { chosen = '💎'; multiplier = 5; }
        else if (rand < 0.5) { chosen = '🔔'; multiplier = 3; }
        else                 { chosen = ['🍒', '🍋', '🍇'][Math.floor(Math.random() * 3)]; multiplier = 2; }
        reel1 = reel2 = reel3 = chosen;
      } else {
        const matchedEmoji   = emojis[Math.floor(Math.random() * emojis.length)];
        const unmatchedEmoji = emojis.filter(e => e !== matchedEmoji)[Math.floor(Math.random() * 4)];
        const arrangement    = [matchedEmoji, matchedEmoji, unmatchedEmoji].sort(() => 0.5 - Math.random());
        [reel1, reel2, reel3] = arrangement;
        multiplier = 1.5;
      }
    } else {
      const shuffled = [...emojis].sort(() => 0.5 - Math.random());
      [reel1, reel2, reel3] = shuffled;
      multiplier = 0;
    }

    const embed = new EmbedBuilder().setTitle('🎰 Slot Machine')
      .setDescription(`**[ ${reel1} | ${reel2} | ${reel3} ]**\n\n`);

    if (win) {
      const winAmount = Math.floor(bet * multiplier);
      const profit    = winAmount - bet;
      balanceUtil.addBalance(userId, profit);
      embed.setDescription(embed.data.description + `🎉 **WIN!** You matched items!\n**Payout:** ${winAmount} coins (${multiplier}x bet)\nNew balance: **${balanceUtil.getBalance(userId)}** coins.`)
           .setColor('#2ecc71');
    } else {
      balanceUtil.addBalance(userId, -bet);
      embed.setDescription(embed.data.description + `😢 **No match.** You lost **${bet}** coins.\nNew balance: **${balanceUtil.getBalance(userId)}** coins.`)
           .setColor('#ff3333');
    }
    return interaction.reply({ embeds: [embed] });
  }

  // ── roll ──────────────────────────────────────────────────────────────────
  if (subcommand === 'roll') {
    const win      = alwaysWin || Math.random() < 0.4;
    const diceRoll = win
      ? Math.floor(Math.random() * 40) + 61
      : Math.floor(Math.random() * 60) + 1;

    const embed = new EmbedBuilder().setTitle('🎲 Dice Roll Result')
      .setDescription(`You rolled a **${diceRoll}/100** (Need > 60 to win).\n\n`);

    if (win) {
      balanceUtil.addBalance(userId, bet);
      embed.setDescription(embed.data.description + `🎉 **You won ${bet} coins!**\nNew balance: **${balanceUtil.getBalance(userId)}** coins.`)
           .setColor('#2ecc71');
    } else {
      balanceUtil.addBalance(userId, -bet);
      embed.setDescription(embed.data.description + `😢 **You lost ${bet} coins.**\nNew balance: **${balanceUtil.getBalance(userId)}** coins.`)
           .setColor('#ff3333');
    }
    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = { handleGamble };
