'use strict';

module.exports = {
  name: 'ping',
  description: 'Replies with the bot and API latency.',
  async execute(message, args) {
    try {
      const sent = await message.reply('🏓 Pinging...');
      const latency = sent.createdTimestamp - message.createdTimestamp;
      const apiPing = Math.round(message.client.ws.ping);
      
      await sent.edit(`🏓 Pong!\n• **Latency:** ${latency}ms\n• **API Latency:** ${apiPing}ms`);
    } catch (err) {
      console.error('Error in ping command:', err);
    }
  }
};
