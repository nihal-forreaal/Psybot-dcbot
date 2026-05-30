# 🤖 Psybot

Psybot is a feature-rich, high-performance, and premium Discord bot scaffolded with `discord.js` (v14). It features interactive gaming modules, a built-in AI assistant powered by Google Gemini/Gemma models, automatic support ticket management, a custom voice-channel controller, server moderation, and YouTube WebSub notifications.

---

## 🌟 Key Features

### 1. 🎙️ Custom Voice Channel (VC) Panel (`!vcpanel`)
* Allows temporary voice channel owners to manage their dynamic VC rooms from a premium visual interface.
* **Controls:** Edit channel names, limit maximum voice members, assign co-owners, lock/unlock channels, whitelist specific users, block users, or kick/disconnect current voice members.

### 2. 🎫 Support Ticket System (`!ticket`)
* **Self-Service Support:** Interactive button panels allow users to open private support tickets.
* **Ticket Actions:** Interactive buttons allow staff members to claim, transfer ownership, add users to the ticket channel, or close the ticket.

### 3. 🛡️ Server Moderation (Prefix & Slash Commands)
* Supports both traditional message commands and application-level slash commands.
* Commands include: **Kick**, **Server Mute/Unmute**, **Server Deafen/Undeafen**, and **Timeout/Untimeout** (which parses standard timeframes).

### 4. 📡 YouTube WebSub Notifications
* Built-in server listener for YouTube WebSub (PubSubHubbub) hubs. Instantly posts announcements in Discord when new videos are published.

---

## 🛠️ Installation & Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v16.11.0 or higher recommended)
* [npm](https://www.npmjs.com/) (usually bundled with Node.js)
* A Discord Bot Token (created via the [Discord Developer Portal](https://discord.com/developers/applications))

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
| `!rrpanel` | Roles | Send the interactive Reaction Roles panel. | Admin Role |
| `!vcpanel` | Voice | Show VC management panel for your dynamic voice channel. | VC Creator |
| `!ticket` | Tickets | Send the ticket system button panel. | Admin Role |
| `!close` | Tickets | Close the current ticket channel. | Staff / Admin |
| `!mute <@user>` | Moderation | Server mute/unmute a user in voice. | Mute Members / Admin |
| `!deafen <@user>` | Moderation | Server deafen/undeafen a user in voice. | Deafen Members / Admin |
| `!ping` | Utility | Replies with bot latency. | Everyone |
| `!say <text>` | Utility | Bot repeats your message. | Everyone |
| `!startlink <link> [chars] [int] [target]` | Utility | Broadcast randomized links at specific intervals. | Authorized IDs |
| `!stoplink <target>` | Utility | Stop broadcast intervals for target link. | Authorized IDs |
| `!sendlink <link> [chars] [int] [target]` | Utility | Broadcast randomized links at specific intervals (alias to `!startlink`). | Authorized IDs |
| `!stopsendlink <target>` | Utility | Stop broadcast intervals for target link (alias to `!stoplink`). | Authorized IDs |
| `!deleteall` | Utility | Clean up DM messages (DM only). | Developer ID |

---

## 📝 File Structure

* [index.js](file:///c:/Users/ahamm/Downloads/randm%20things/Dc%20bot/index.js) — Main entry point, sets up event listeners, command routers, slash registrations, and daily maintenance loops.
* [youtube.js](file:///c:/Users/ahamm/Downloads/randm%20things/Dc%20bot/youtube.js) — YouTube WebSub notifier middleware server.
* [commands/](file:///c:/Users/ahamm/Downloads/randm%20things/Dc%20bot/commands) — Dynamic command module loader directory.
* `tickets.json` — Local flat-file database stores (automatically excluded via `.gitignore`).
