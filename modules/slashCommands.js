'use strict';

const { ApplicationCommandOptionType } = require('discord.js');

/**
 * Array of slash command definitions registered globally on startup.
 * Exported so that the ready handler can pass this to client.application.commands.set().
 */
const slashCommands = [
  {
    name: 'kick',
    description: 'Kicks a member from the server.',
    options: [
      {
        name: 'user',
        description: 'The user to kick',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'reason',
        description: 'Reason for kick',
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
  },
  {
    name: 'mute',
    description: 'Server mutes/unmutes a member in voice channels.',
    options: [
      {
        name: 'user',
        description: 'The user to server mute/unmute',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
  },
  {
    name: 'deafen',
    description: 'Server deafens/undeafens a member in voice channels.',
    options: [
      {
        name: 'user',
        description: 'The user to server deafen/undeafen',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
  },
  {
    name: 'defen',
    description: 'Server deafens/undeafens a member in voice channels.',
    options: [
      {
        name: 'user',
        description: 'The user to server deafen/undeafen',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
    ],
  },
  {
    name: 'timeout',
    description: 'Times out/removes timeout from a member in the server.',
    options: [
      {
        name: 'user',
        description: 'The user to timeout',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'minutes',
        description: 'Duration of timeout in minutes (default 10)',
        type: ApplicationCommandOptionType.Integer,
        required: false,
      },
      {
        name: 'reason',
        description: 'Reason for timeout',
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
  },
  {
    name: 'gamble',
    description: 'Gamble and play minigames to earn coins!',
    options: [
      {
        name: 'balance',
        description: 'Checks your current coin balance.',
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: 'daily',
        description: 'Claims your daily reward of 500 coins.',
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: 'coinflip',
        description: 'Play a coinflip game (50% win chance).',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'side',
            description: 'Choose Heads or Tails',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: 'Heads', value: 'heads' },
              { name: 'Tails', value: 'tails' },
            ],
          },
          {
            name: 'bet',
            description: 'The amount of coins to bet',
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
        ],
      },
      {
        name: 'slots',
        description: 'Play the slot machine.',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'bet',
            description: 'The amount of coins to bet',
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
        ],
      },
      {
        name: 'roll',
        description: 'Roll a 100-sided die (Roll > 60 to win).',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'bet',
            description: 'The amount of coins to bet',
            type: ApplicationCommandOptionType.Integer,
            required: true,
          },
        ],
      },
    ],
  },
  {
    name: 'log',
    description: 'Query and view logs fast for a specific timeframe',
    options: [
      {
        name: 'voice',
        description: 'Query voice channel logs',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'start', description: 'Start time (e.g. 10am, 10:00, 2:30pm)', type: ApplicationCommandOptionType.String, required: true },
          { name: 'end',   description: 'End time (e.g. 11am, 11:00, 3:30pm)',   type: ApplicationCommandOptionType.String, required: true },
          { name: 'date',  description: 'Date (format: YYYY-MM-DD). Defaults to today.', type: ApplicationCommandOptionType.String, required: false },
          { name: 'page',  description: 'Select page number to view (defaults to 1)',    type: ApplicationCommandOptionType.Integer, required: false },
        ],
      },
      {
        name: 'messages',
        description: 'Query message logs',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'start', description: 'Start time (e.g. 10am, 10:00, 2:30pm)', type: ApplicationCommandOptionType.String, required: true },
          { name: 'end',   description: 'End time (e.g. 11am, 11:00, 3:30pm)',   type: ApplicationCommandOptionType.String, required: true },
          { name: 'date',  description: 'Date (format: YYYY-MM-DD). Defaults to today.', type: ApplicationCommandOptionType.String, required: false },
          { name: 'page',  description: 'Select page number to view (defaults to 1)',    type: ApplicationCommandOptionType.Integer, required: false },
        ],
      },
      {
        name: 'mute',
        description: 'Query mute/unmute logs',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'start', description: 'Start time (e.g. 10am, 10:00, 2:30pm)', type: ApplicationCommandOptionType.String, required: true },
          { name: 'end',   description: 'End time (e.g. 11am, 11:00, 3:30pm)',   type: ApplicationCommandOptionType.String, required: true },
          { name: 'date',  description: 'Date (format: YYYY-MM-DD). Defaults to today.', type: ApplicationCommandOptionType.String, required: false },
          { name: 'page',  description: 'Select page number to view (defaults to 1)',    type: ApplicationCommandOptionType.Integer, required: false },
        ],
      },
      {
        name: 'role',
        description: 'Query role logs',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          { name: 'start', description: 'Start time (e.g. 10am, 10:00, 2:30pm)', type: ApplicationCommandOptionType.String, required: true },
          { name: 'end',   description: 'End time (e.g. 11am, 11:00, 3:30pm)',   type: ApplicationCommandOptionType.String, required: true },
          { name: 'date',  description: 'Date (format: YYYY-MM-DD). Defaults to today.', type: ApplicationCommandOptionType.String, required: false },
          { name: 'page',  description: 'Select page number to view (defaults to 1)',    type: ApplicationCommandOptionType.Integer, required: false },
        ],
      },
    ],
  },
];

module.exports = { slashCommands };
