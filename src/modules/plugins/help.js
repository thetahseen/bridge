export default class HelpModule {
  constructor(database, logger) {
    this.database = database
    this.logger = logger
    this.name = "help"
  }

  shouldProcess(messageInfo, contact) {
    return messageInfo.text.toLowerCase().includes("!help") || messageInfo.text.toLowerCase().includes("help")
  }

  async process(messageInfo, contact) {
    const helpText = `🤖 *WhatsApp Bot Help*

*Available Commands:*
• \`!echo [message]\` - Echo your message
• \`!help\` - Show this help message
• \`!status\` - Check bot status

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
