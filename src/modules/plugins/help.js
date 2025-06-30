export default class HelpModule {
  constructor(database, config, logger) {
    this.database = database
    this.config = config
    this.logger = logger
    this.name = "help"
  }

  shouldProcess(messageInfo, contact) {
    return messageInfo.text.toLowerCase().includes("!help") || messageInfo.text.toLowerCase().includes("help")
  }

  async process(messageInfo, contact) {
    const helpText = `🤖 *${this.config.botName} Help*

*Available Commands:*
• \`!echo [message]\` - Echo your message
• \`!help\` - Show this help message
• \`!status\` - Check bot status
• \`!pair [phone]\` - Get pairing code

*Features:*
• Messages are bridged to Telegram
• Automatic contact management
• Modular plugin system

*Bot Status:* ${global.bot?.isConnected ? "✅ Online" : "❌ Offline"}

Need more help? Contact the administrator.`

    return {
      response: helpText,
    }
  }
}
