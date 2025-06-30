# WhatsApp Telegram Bridge Bot

A powerful, modular WhatsApp bot with Telegram bridge functionality built with Node.js and Baileys.

## Features

- 🔗 **Telegram Bridge**: Forward WhatsApp messages to Telegram groups with topic organization
- 🧩 **Modular Architecture**: Easy to extend with custom modules
- 💾 **Database Integration**: SQLite database with automatic backups
- 📱 **QR Code & Pairing Support**: Connect via QR code or phone number pairing
- 🎯 **Topic Management**: Automatic topic creation for each WhatsApp contact
- 🔄 **Bi-directional Communication**: Reply from Telegram topics to send WhatsApp messages
- ⚙️ **Centralized Configuration**: JSON-based configuration system
- ⚡ **Lightweight**: Minimal dependencies and efficient performance

## Quick Start

### 1. Installation

\`\`\`bash
npm install
npm run setup
\`\`\`

### 2. Configuration

Edit the `config.json` file with your settings:

\`\`\`json
{
  "telegram": {
    "botToken": "your_telegram_bot_token_here",
    "adminChatId": "your_telegram_chat_id_here"
  },
  "whatsapp": {
    "pairingNumber": "1234567890"
  },
  "bot": {
    "name": "My WhatsApp Bot",
    "debug": false
  }
}
\`\`\`

### 3. Getting Telegram Bot Token

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token to your `config.json` file

### 4. Start the Bot

\`\`\`bash
npm start
\`\`\`

### 5. Connect WhatsApp

You have two options to connect WhatsApp:

#### Option A: QR Code (Default)
1. Scan the QR code that appears in terminal
2. Or use `/qr` command in Telegram to get QR code

#### Option B: Pairing Code (Alternative)
1. Set your phone number in `config.json`:
   \`\`\`json
   {
     "whatsapp": {
       "pairingNumber": "1234567890"
     }
   }
   \`\`\`
2. Or use Telegram command: `/pair 1234567890`
3. Enter the 8-digit code in WhatsApp on your phone

### 6. Set up Telegram Bridge

1. Add your bot to a Telegram group
2. Send `/setbridge` command in the group
3. The group will now receive WhatsApp messages as topics

## Configuration

The bot uses a centralized `config.json` file for all settings:

### Main Configuration Sections

- **telegram**: Telegram bot settings
- **whatsapp**: WhatsApp connection settings
- **database**: Database and backup settings
- **bot**: General bot behavior
- **modules**: Module management
- **bridge**: Telegram bridge settings
- **security**: Security and access control
- **logging**: Logging configuration
- **advanced**: Advanced connection settings

### Configuration Migration

If you have an existing `.env` file, the bot will automatically migrate settings to `config.json` on first run.

## Usage

### Telegram Commands

- `/start` - Show welcome message and commands
- `/status` - Check connection status and bot info
- `/config` - Show current configuration (admin only)
- `/setbridge` - Set current group as bridge (group only)
- `/qr` - Request new QR code for WhatsApp
- `/pair [phone]` - Get pairing code for phone number
- `/unpair` - Disconnect current WhatsApp session
- `/help` - Show help message

### WhatsApp Commands

Default modules provide these commands:
- `!echo [message]` - Echo your message
- `!help` - Show available commands
- `!status` - Show bot status
- `!pair [phone]` - Get pairing code for phone number

## Creating Custom Modules

Create a new file in `src/modules/plugins/` directory:

\`\`\`javascript
export default class MyCustomModule {
    constructor(database, config, logger) {
        this.database = database;
        this.config = config;
        this.logger = logger;
        this.name = 'my-module';
    }

    shouldProcess(messageInfo, contact) {
        return messageInfo.text.startsWith('!mycommand');
    }

    async process(messageInfo, contact) {
        return {
            response: \`Hello from \${this.config.botName}!\`,
            text: 'Modified message text'
        };
    }
}
\`\`\`

### Module Configuration

Control which modules load in `config.json`:

\`\`\`json
{
  "modules": {
    "enabled": true,
    "autoLoad": true,
    "defaultModules": ["help", "status", "echo", "pairing", "my-module"]
  }
}
\`\`\`

## Database Features

- **Automatic Backups**: Configurable backup intervals
- **Contact Management**: Automatic contact creation and tracking
- **Message History**: Complete message logging
- **Settings Storage**: Persistent bot settings

## Security Features

- **User Access Control**: Allow/block specific users
- **Admin Commands**: Restricted admin-only commands
- **Rate Limiting**: Prevent message spam
- **Secure Configuration**: Centralized security settings

## Advanced Features

### Proxy Support
\`\`\`json
{
  "advanced": {
    "useProxy": true,
    "proxyUrl": "http://proxy:8080"
  }
}
\`\`\`

### Custom Message Formatting
\`\`\`json
{
  "bridge": {
    "messageFormat": "📱 *{name}*\\n{message}"
  }
}
\`\`\`

### Logging Configuration
\`\`\`json
{
  "logging": {
    "enabled": true,
    "logToFile": true,
    "logLevel": "debug"
  }
}
\`\`\`

## Troubleshooting

### Configuration Issues
1. Check `config.json` syntax with a JSON validator
2. Ensure all required fields are filled
3. Use `/config` command to verify settings

### Connection Issues
1. Clear sessions: `rm -rf sessions/`
2. Check proxy settings if behind firewall
3. Verify phone number format for pairing

### Module Issues
1. Check module syntax and exports
2. Verify module is in `defaultModules` list
3. Check logs for detailed error messages

## Development

### Running in Development Mode
\`\`\`bash
npm run dev
\`\`\`

### Debug Mode
Set `"debug": true` in `config.json` for detailed logging.

### Configuration Management
\`\`\`javascript
import config from './config.js'

// Get values
const botName = config.botName
const isDebug = config.isDebugMode

// Set values
config.set('bot.debug', true)

// Validate configuration
const errors = config.validate()
\`\`\`

## License

MIT License - feel free to use and modify as needed.

---

**Note**: This bot is for educational and personal use. Make sure to comply with WhatsApp's Terms of Service and Telegram's Bot API terms.
