const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
  name: 'ask',
  description: 'Ask Psybot’s built-in AI assistant anything',
  async execute(message, args) {
    const apiKey = process.env.GEMINI_API_KEY;

    // Help instructions if no API key is set
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      const errorEmbed = new EmbedBuilder()
        .setTitle('🤖 Psybot AI Assistant Setup')
        .setColor('#ff3333')
        .setDescription('Your AI assistant is ready to activate! To enable it, please follow these quick steps:')
        .addFields(
          { name: '1️⃣ Get your free API Key', value: 'Go to the [Google AI Studio](https://aistudio.google.com/) and generate a free API key.', inline: false },
          { name: '2️⃣ Add it to your configuration', value: 'Open your `.env` file and add the following line at the bottom:\n```env\nGEMINI_API_KEY=your_actual_api_key_here\n```', inline: false },
          { name: '3️⃣ Restart the bot', value: 'Restart the bot process to load your new credentials!', inline: false }
        )
        .setFooter({ text: 'Psybot AI Engine', iconURL: message.client.user.displayAvatarURL() })
        .setTimestamp();

      return message.reply({ embeds: [errorEmbed] });
    }

    const prompt = args.join(' ');
    if (!prompt) {
      return message.reply({ content: '❌ Please provide a question or prompt! Example: `!ask Explain quantum computing in one sentence`.' });
    }

    const typingMsg = await message.reply({ content: '🤔 *Psybot AI is thinking...*' });

    try {
      // Connect to Google Gemini API using a lightweight REST POST request
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=${apiKey}`;
      const requestBody = {
        contents: [{
          parts: [{
            text: `You are Psybot, a highly helpful, intelligent, friendly, and premium Discord bot assistant. Respond concisely to the following user message: ${prompt}`
          }]
        }]
      };

      const response = await axios.post(endpoint, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!responseText) {
        throw new Error('Empty response from AI engine');
      }

      // Handle message length limits (Discord limit is 2000 characters)
      if (responseText.length > 1950) {
        const chunks = responseText.match(/[\s\S]{1,1900}/g) || [];
        await typingMsg.edit({ content: chunks[0] });
        for (let i = 1; i < chunks.length; i++) {
          await message.channel.send({ content: chunks[i] });
        }
      } else {
        await typingMsg.edit({ content: responseText });
      }

    } catch (error) {
      console.error('AI engine error details:', error.response?.data || error.message);
      await typingMsg.edit({ content: '❌ Sorry, I encountered an error while processing your request with the AI engine. Please ensure your API key in `.env` is valid.' });
    }
  }
};
