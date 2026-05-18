# Discord Bot

Simple Discord bot scaffold using `discord.js`.

Setup

1. Copy `.env.example` to `.env` and set `TOKEN` (your bot token) and optional `PREFIX`.
2. Install dependencies:

```bash
npm install
```

3. Start the bot:

```bash
npm start
```

Commands

- `!ping` - replies with latency.
- `!help` - lists commands.
- `!say <text>` - bot repeats your message.

YouTube uploads (instant webhook)

- This project supports subscribing to YouTube uploads via WebSub (PubSubHubbub). To enable:
	1. Install `ngrok` and run `ngrok http 3000` (or whichever port you set).
	2. Copy the `https://...` forwarding URL from ngrok and set `PUBLIC_URL` in your `.env` (no trailing slash), e.g. `PUBLIC_URL=https://abcd.ngrok.io`.
	3. Add `YT_CHANNEL_ID` to `.env` (the channel id, not username).
	4. Optionally set `DISCORD_ANNOUNCE_CHANNEL_ID` to the channel ID where announcements should go.
	5. Optionally set `YT_VERIFY_TOKEN` (random string) to validate hub verification.

Example `.env` additions:

```
PUBLIC_URL=https://abcd.ngrok.io
YT_CHANNEL_ID=UC_x5XG1OV2P6uZZ5FSM9Ttw
DISCORD_ANNOUNCE_CHANNEL_ID=123456789012345678
YT_VERIFY_TOKEN=some-secret-token
```

The bot will attempt to subscribe to YouTube's hub on startup. For local testing use ngrok; for production deploy to a public URL (Heroku, Vercel, Fly, etc.).

Notes

- This uses prefix commands loaded from the `commands/` folder.
- For moderation commands or slash commands, add additional modules and follow Discord API docs.
