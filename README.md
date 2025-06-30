# WhatsApp Telegram Bridge Bot

A powerful, modular WhatsApp bot with Telegram bridge functionality built with Node.js and Baileys.

## Features

- 🔗 **Telegram Bridge**: Forward WhatsApp messages to Telegram groups with topic organization
- 🧩 **Modular Architecture**: Easy to extend with custom modules
- 💾 **Database Integration**: SQLite database for storing contacts and messages
- 📱 **QR Code Support**: Automatic QR code generation and sharing via Telegram
- 🎯 **Topic Management**: Automatic topic creation for each WhatsApp contact
- 🔄 **Bi-directional Communication**: Reply from Telegram topics to send WhatsApp messages
- ⚡ **Lightweight**: Minimal dependencies and efficient performance

## Quick Start

### 1. Installation

\`\`\`bash
# Clone or download the project
npm install
npm run setup
\`\`\`

### 2. Configuration

Edit the `.env` file with your settings:

\`\`\`env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_ADMIN_CHAT_ID=your_telegram_chat_id_here
DATABASE_PATH=./data/bot.db
BOT_NAME=WhatsApp Bridge Bot
DEBUG=false
WHATSAPP_SESSION_PATH=./sessions
\`\`\`

### 3. Getting Telegram Bot Token

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token to your `.env` file

### 4. Start the Bot

\`\`\`bash
npm start
\`\`\`

### 5. Connect WhatsApp

1. Scan the QR code that appears in terminal
2. Or use `/qr` command in Telegram to get QR code

### 6. Set up Telegram Bridge

1. Add your bot to a Telegram group
2. Send `/setbridge` command in the group
3. The group will now receive WhatsApp messages as topics

## Usage

### Telegram Commands

- `/start` - Show welcome message and commands
- `/status` - Check WhatsApp connection status
- `/setbridge` - Set current group as bridge (group only)
- `/qr` - Request new QR code for WhatsApp
- `/help` - Show help message

### WhatsApp Commands

Default modules provide these commands:
- `!echo [message]` - Echo your message
- `!help` - Show available commands
- `!status` - Show bot status

## Creating Custom Modules

Create a new file in `src/modules/plugins/` directory:

\`\`\`javascript
export default class MyCustomModule {
    constructor(database, logger) {
        this.database = database;
        this.logger = logger;
        this.name = 'my-module';
    }

    shouldProcess(messageInfo, contact) {
        // Return true if this module should process the message
        return messageInfo.text.startsWith('!mycommand');
    }

    async process(messageInfo, contact) {
        // Process the message and return response
        return {
            response: 'Hello from my custom module!',
            // You can also modify the message before it goes to Telegram
            text: 'Modified message text'
        };
    }
}
\`\`\`

### Module API

Your module class should implement:

- `constructor(database, logger)` - Initialize with database and logger
- `shouldProcess(messageInfo, contact)` - Return boolean if module should handle message
- `process(messageInfo, contact)` - Process message and return result object

The `process` method can return:
- `response` - Text to send back to WhatsApp user
- `text` - Modified message text for Telegram bridge
- Any other properties to modify the message

### Database Access

Use `this.database` in your modules:

\`\`\`javascript
// Get contact info
const contact = await this.database.getContact(whatsappId);

// Save custom data
await this.database.db.run('INSERT INTO my_table VALUES (?)', [value]);

// Query custom data
const result = await this.database.db.get('SELECT * FROM my_table WHERE id = ?', [id]);
\`\`\`

## Project Structure

\`\`\`
├── src/
│   ├── index.js              # Main bot file
│   ├── database/
│   │   └── manager.js        # Database management
│   ├── bridges/
│   │   └── telegram.js       # Telegram bridge functionality
│   ├── handlers/
│   │   └── message.js        # Message handling logic
│   ├── modules/
│   │   ├── manager.js        # Module management
│   │   └── plugins/          # Custom modules directory
│   └── utils/
│       └── qrcode.js         # QR code utilities
├── scripts/
│   └── setup.js              # Setup script
├── data/                     # Database files
├── sessions/                 # WhatsApp session data
└── logs/                     # Log files
\`\`\`

## Database Schema

The bot uses SQLite with these tables:

- `contacts` - WhatsApp contacts and their Telegram topic IDs
- `messages` - Message history
- `bridge_settings` - Telegram bridge configuration
- `modules` - Loaded modules information

## Troubleshooting

### WhatsApp Connection Issues

1. Delete `sessions/` folder and restart
2. Make sure WhatsApp Web is not open elsewhere
3. Check if your phone has internet connection

### Telegram Bridge Not Working

1. Verify bot token in `.env`
2. Make sure bot is admin in the group
3. Check if group supports topics (supergroups only)

### Module Not Loading

1. Check file syntax and exports
2. Look at logs for error messages
3. Ensure file is in `src/modules/plugins/` directory

## Development

### Running in Development Mode

\`\`\`bash
npm run dev
\`\`\`

### Debug Mode

Set `DEBUG=true` in `.env` for detailed logging.

### Contributing

1. Fork the repository
2. Create your feature branch
3. Add your module to `src/modules/plugins/`
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs in the console
3. Create an issue with detailed information

---

**Note**: This bot is for educational and personal use. Make sure to comply with WhatsApp's Terms of Service and Telegram's Bot API terms.
