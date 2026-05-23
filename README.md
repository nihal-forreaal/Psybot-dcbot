# 🤖 Psybot

Psybot is a feature-rich, high-performance, and premium Discord bot scaffolded with `discord.js` (v14). It features interactive gaming modules, a built-in AI assistant powered by Google Gemini/Gemma models, automatic support ticket management, a custom voice-channel controller, server moderation, and YouTube WebSub notifications.

---

## 🌟 Key Features

### 1. 🧠 Built-in AI Assistant & Private Chats
* **Private AI Channels (`!aipanel`):** Spawn a message board containing a secure gateway button. When clicked, it spins up a custom channel (`#ai-chat-username`) that only the creator and Psybot can access.
  * *Auto-Cleanup:* Conserves resources by automatically deleting inactive chat channels after **1 hour** of inactivity (with a reminder warning after 50 minutes of silence). Users can also end the session early by typing `!end`.
* **Standard Queries (`!ask <prompt>`):** Direct question-and-answer prompt interface powered by Gemini/Gemma API.
* **Replies Interface:** Simply reply to any of Psybot's messages, and the bot will automatically reply using its AI engine.

### 2. 📊 Dynamic Leveling & XP system
* **Dynamic XP gains:** Users earn between 5 and 20 XP randomly per message.
* **Role Rewards:** Automatic advancement through leveling ranks. The bot cleans up lower-tier ranks from user profiles to prevent role bloat.
  * **Ranks:** *Nobby (Lv 1)* ➔ *Normie (Lv 2)* ➔ *Rookie (Lv 5)* ➔ *Grinder (Lv 10)* ➔ *Sweaty (Lv 15)* ➔ *Pro (Lv 20)* ➔ *Elite (Lv 30)* ➔ *Legend (Lv 35)* ➔ *Mythic (Lv 40)* ➔ *Godmode (Lv 50)*.
* **Database Sync:** Auto-saves and syncs current state to `levels.json` with synchronous flush on shutdown.

### 3. 🎮 Games & Entertainment
* **Trivia (`!trivia`):** Rapid-fire multiple choice game in a dedicated channel.
  * Features correct/incorrect option button styling and next-question prompts.
  * **Streak Multiplier:** Keep answering correctly to stack streak modifiers (1.2x XP reward for 3-4 correct answers, 1.5x XP reward for 5+ correct answers).
* **Guessing (`!guess`):** Play interactive guessing mini-games.
* **Games Maintenance:** Automatic daily deletion of messages in the gaming channel to keep the room clean, plus automated reminders prompting users to play.

### 4. 🎙️ Custom Voice Channel (VC) Panel (`!vcpanel`)
* Allows temporary voice channel owners to manage their dynamic VC rooms from a premium visual interface.
* **Controls:** Edit channel names, limit maximum voice members, assign co-owners, lock/unlock channels, whitelist specific users, block users, or kick/disconnect current voice members.

### 5. 🎫 Support Ticket System (`!ticket`)
* **Self-Service Support:** Interactive button panels allow users to open private support tickets.
* **Ticket Actions:** Interactive buttons allow staff members to claim, transfer ownership, add users to the ticket channel, or close the ticket.

### 6. 🛡️ Server Moderation (Prefix & Slash Commands)
* Supports both traditional message commands and application-level slash commands.
* Commands include: **Kick**, **Server Mute/Unmute**, **Server Deafen/Undeafen**, and **Timeout/Untimeout** (which parses standard timeframes).

### 7. 📡 YouTube WebSub Notifications
* Built-in server listener for YouTube WebSub (PubSubHubbub) hubs. Instantly posts announcements in Discord when new videos are published.

---

## 🛠️ Installation & Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v16.11.0 or higher recommended)
* [npm](https://www.npmjs.com/) (usually bundled with Node.js)
* A Discord Bot Token (created via the [Discord Developer Portal](https://discord.com/developers/applications))
* A Google AI Studio API key (obtain yours from [Google AI Studio](https://aistudio.google.com/))

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <your-github-repo-url>
   cd "Dc bot"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Rename `.env.example` to `.env` and fill out the configuration:
   ```env
   # Core Bot Configuration
   TOKEN=YOUR_DISCORD_BOT_TOKEN
   PREFIX=!
   ADMIN_ROLE_ID=YOUR_ADMIN_ROLE_ID
   LEVEL_CHANNEL_ID=YOUR_LEVELS_ANNOUNCEMENT_CHANNEL_ID
   
   # AI Assistant
   GEMINI_API_KEY=YOUR_GEMINI_STUDIO_API_KEY
   
   # Ticket Configuration
   TICKET_CATEGORY_ID=YOUR_TICKET_CATEGORY_ID
   TICKET_PANEL_CHANNEL_ID=YOUR_TICKET_PANEL_CHANNEL_ID
   
   # YouTube WebSub Integration (Optional)
   PUBLIC_URL=https://your-public-url.ngrok-free.app
   YT_CHANNEL_ID=YOUR_YOUTUBE_CHANNEL_ID
   DISCORD_ANNOUNCE_CHANNEL_ID=YOUR_DISCORD_YOUTUBE_CHANNEL_ID
   YT_VERIFY_TOKEN=YOUR_CUSTOM_VERIFICATION_TOKEN
   ```

4. **Launch the Bot:**
   ```bash
   npm start
   ```

---

## 📄 Commands Directory

Below is the directory of prefix commands (`!`) loaded dynamically from the `commands/` directory:

| Command | Category | Description | Permissions |
| :--- | :--- | :--- | :--- |
| `!ask <prompt>` | AI | Ask Psybot's AI assistant anything. | Everyone |
| `!aipanel` | AI | Spawn the private AI chat creation portal. | Administrator / Admin Role |
| `!vcpanel` | Voice | Show VC management panel for your dynamic voice channel. | VC Creator |
| `!ticket` | Tickets | Send the ticket system button panel. | Admin Role |
| `!close` | Tickets | Close the current ticket channel. | Staff / Admin |
| `!level [@user]` | Leveling | Show current level and XP progression. | Everyone |
| `!leaderboard` | Leveling | Show the guild's top leveling leaders. | Everyone |
| `!givexp <@user> <amount>` | Leveling | Grant or revoke XP for a member. | Admin Role |
| `!resetlvl <@user>` | Leveling | Reset level stats for a member. | Admin Role |
| `!trivia` | Gaming | Answer a rapid-fire trivia question to win XP. | Everyone (Gaming channel) |
| `!guess` | Gaming | Play the guessing mini-game. | Everyone (Gaming channel) |
| `!kick <@user> [reason]` | Moderation | Kick a member from the server. | Kick Members / Admin |
| `!mute <@user>` | Moderation | Server mute/unmute a user in voice. | Mute Members / Admin |
| `!deafen <@user>` | Moderation | Server deafen/undeafen a user in voice. | Deafen Members / Admin |
| `!timeout <@user> [mins] [reason]` | Moderation | Mute/timeout a member. | Moderate Members / Admin |
| `!ping` | Utility | Replies with bot latency. | Everyone |
| `!say <text>` | Utility | Bot repeats your message. | Everyone |
| `!startlink <link> [chars] [int] [target]` | Utility | Broadcast randomized links at specific intervals. | Authorized IDs |
| `!stoplink <target>` | Utility | Stop broadcast intervals for target link. | Authorized IDs |
| `!deleteall` | Utility | Clean up DM messages (DM only). | Developer ID |

---

## 📝 File Structure

* [index.js](file:///c:/Users/ahamm/Downloads/randm%20things/Dc%20bot/index.js) — Main entry point, sets up event listeners, command routers, slash registrations, and daily maintenance loops.
* [levelsUtil.js](file:///c:/Users/ahamm/Downloads/randm%20things/Dc%20bot/levelsUtil.js) — Central leveling utility covering role assignments and XP calculations.
* [youtube.js](file:///c:/Users/ahamm/Downloads/randm%20things/Dc%20bot/youtube.js) — YouTube WebSub notifier middleware server.
* [commands/](file:///c:/Users/ahamm/Downloads/randm%20things/Dc%20bot/commands) — Dynamic command module loader directory.
* `levels.json` & `tickets.json` — Local flat-file database stores (automatically excluded via `.gitignore`).
