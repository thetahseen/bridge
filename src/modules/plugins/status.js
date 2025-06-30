export default class StatusModule {
  constructor(database, config, logger) {
    this.database = database
    this.config = config
    this.logger = logger
    this.name = "status"
  }

  shouldProcess(messageInfo, contact) {
    return messageInfo.text.toLowerCase().includes("!status")
  }

  async process(messageInfo, contact) {
    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)

    const statusText = `📊 *Bot Status*

*Connection:* ${global.bot?.isConnected ? "✅ Connected" : "❌ Disconnected"}
*Uptime:* ${hours}h ${minutes}m
*Platform:* ${this.config.botName}
*Version:* ${this.config.botVersion}

*Database:* ✅ Active
*Telegram Bridge:* ${global.bot?.telegramBridge ? "✅ Active" : "❌ Inactive"}
*Modules Loaded:* ${global.bot?.moduleManager?.modules?.size || 0}`

    return {
      response: statusText,
    }
  }
}
