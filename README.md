# 🤖 Psybot

Psybot is a clean, minimal Discord bot scaffolded with `discord.js` (v14). It serves as a premium, lightweight starter template with dynamic command loading and structured event handlers.

---

## 🌟 Key Features

* **Dynamic Command Loader**: Automatically loads prefix commands from the `commands/` directory.
* **Structured Event Handlers**: Separates event logic into dedicated modules inside the `handlers/` directory.
* **Modern Boilerplate**: Pre-configured with essential Discord gateway intents and partials.

---

## 🛠️ Installation & Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v20.0.0 or higher recommended)
* [npm](https://www.npmjs.com/)

### Setup Instructions

1. **Clone or navigate to the repository:**
   ```bash
   cd psybot-dcbot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Rename `.env.example` to `.env` (or update your existing `.env` file) and fill out your Discord bot credentials:
   ```env
    TOKEN=YOUR_DISCORD_BOT_TOKEN
    PREFIX=,
    ```

4. **Launch the Bot:**
   ```bash
   npm start
   ```

---

## 📄 Command Directory

Commands are loaded dynamically from the `commands/` directory.

| Command | Description | Usage |
| :--- | :--- | :--- |
| `,ping` | Replies with bot latency / API ping. | `,ping` |
| `,ticket` | Spawns the Support Ticket Portal panel (Admins/Moderators). | `,ticket` |
| `,close` | Safely closes the active ticket channel (Admins/Moderators). | `,close` |
| `,rrpanel` | Spawns the Auto Role panel. | `,rrpanel` |
| `,vcpanel` | Spawns the Custom VC Panel for owner controls. | `,vcpanel` |
| `/youtube` | Displays the official YouTube channel link (Slash command). | `/youtube` |

---

## 📝 File Structure

* [index.js](file:///C:/Users/ahamm/.gemini/antigravity-ide/scratch/psybot-dcbot/index.js) — Main entry point, sets up Client, loads command collections, and registers event handlers.
* [commands/](file:///C:/Users/ahamm/.gemini/antigravity-ide/scratch/psybot-dcbot/commands) — Directory where prefix and slash commands are stored.
* [handlers/](file:///C:/Users/ahamm/.gemini/antigravity-ide/scratch/psybot-dcbot/handlers) — Core event handlers (e.g., `messageCreate`, `interactionCreate`).
