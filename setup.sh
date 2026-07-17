#!/bin/bash
# ============================================================
#  Psybot Auto-Setup Script for Google Cloud e2-micro
#  Run: bash <(curl -s https://raw.githubusercontent.com/nihal-forreaal/Psybot-dcbot/main/setup.sh)
# ============================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}"
echo "=================================================="
echo "   Psybot Auto-Setup — Google Cloud Installer"
echo "=================================================="
echo -e "${NC}"

# ── 1. Update system
echo -e "${YELLOW}[1/7] Updating system...${NC}"
sudo apt-get update -y && sudo apt-get upgrade -y -q

# ── 2. Install Node.js 20
echo -e "${YELLOW}[2/7] Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null
sudo apt-get install -y nodejs 2>/dev/null
echo -e "${GREEN}Node.js $(node --version) installed ✓${NC}"

# ── 3. Install git + pm2
echo -e "${YELLOW}[3/7] Installing Git & PM2...${NC}"
sudo apt-get install -y git 2>/dev/null
sudo npm install -g pm2 -q
echo -e "${GREEN}PM2 $(pm2 --version) installed ✓${NC}"

# ── 4. Clone repo
echo -e "${YELLOW}[4/7] Cloning Psybot from GitHub...${NC}"
cd ~
if [ -d "Psybot-dcbot" ]; then
  echo "Folder exists, pulling latest..."
  cd Psybot-dcbot && git pull origin main
else
  git clone https://github.com/nihal-forreaal/Psybot-dcbot.git
  cd Psybot-dcbot
fi
echo -e "${GREEN}Repository cloned ✓${NC}"

# ── 5. Install npm packages
echo -e "${YELLOW}[5/7] Installing npm packages...${NC}"
npm install --production 2>/dev/null
echo -e "${GREEN}Packages installed ✓${NC}"

# ── 6. Create .env file
echo -e "${YELLOW}[6/7] Setting up environment variables...${NC}"
echo ""
echo -e "${CYAN}Please enter your bot credentials (from your .env file):${NC}"
echo ""

read -p "  Discord Bot TOKEN: " BOT_TOKEN
read -p "  PREFIX (default: ,): " PREFIX
PREFIX=${PREFIX:-,}
read -p "  TICKET_CATEGORY_ID: " TICKET_CATEGORY_ID
read -p "  FORUM_LOG_CHANNEL_ID: " FORUM_LOG_CHANNEL_ID
read -p "  JOIN_TO_CREATE_CHANNEL_ID: " JOIN_TO_CREATE_CHANNEL_ID
read -p "  MEMBER_LOG_CHANNEL_ID (optional): " MEMBER_LOG_CHANNEL_ID
read -p "  STATCACHE_INTERVAL (default: 300): " STATCACHE_INTERVAL
STATCACHE_INTERVAL=${STATCACHE_INTERVAL:-300}

cat > .env << EOF
TOKEN=${BOT_TOKEN}
PREFIX=${PREFIX}
TICKET_CATEGORY_ID=${TICKET_CATEGORY_ID}
FORUM_LOG_CHANNEL_ID=${FORUM_LOG_CHANNEL_ID}
JOIN_TO_CREATE_CHANNEL_ID=${JOIN_TO_CREATE_CHANNEL_ID}
MEMBER_LOG_CHANNEL_ID=${MEMBER_LOG_CHANNEL_ID}
STATCACHE_INTERVAL=${STATCACHE_INTERVAL}
EOF

echo -e "${GREEN}.env file created ✓${NC}"

# ── 7. Start with PM2
echo -e "${YELLOW}[7/7] Starting Psybot with PM2...${NC}"
pm2 delete psybot 2>/dev/null || true
pm2 start index.js --name psybot
pm2 save --force

# Auto-start on reboot
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME 2>/dev/null | tail -1 | bash 2>/dev/null || true

echo ""
echo -e "${GREEN}=================================================="
echo "   ✅ Psybot is now running 24/7 on Google Cloud!"
echo "=================================================="
echo -e "${NC}"
echo -e "  ${CYAN}pm2 status${NC}          — check if running"
echo -e "  ${CYAN}pm2 logs psybot${NC}     — see live logs"
echo -e "  ${CYAN}pm2 restart psybot${NC}  — restart bot"
echo ""
echo -e "${YELLOW}To update bot in future:${NC}"
echo -e "  cd ~/Psybot-dcbot && git pull && npm install && pm2 restart psybot"
echo ""
pm2 status
