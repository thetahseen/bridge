export class TelegramBridge {
  constructor(telegramBot, database, logger) {
    this.bot = telegramBot
    this.database = database
    this.logger = logger
    this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    this.bridgeGroupId = null
  }

  async initialize() {
    this.setupEventHandlers()

    // Get bridge settings
    const settings = await this.database.getBridgeSettings()
    if (settings) {
      this.bridgeGroupId = settings.telegram_group_id
    }
  }

  setupEventHandlers() {
    this.bot.on("message", async (msg) => {
      try {
        await this.handleTelegramMessage(msg)
      } catch (error) {
        this.logger.error("Error handling Telegram message:", error)
      }
    })

    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id
      await this.bot.sendMessage(
        chatId,
        "🤖 *WhatsApp Telegram Bridge Bot*\n\n" +
          "Commands:\n" +
          "/status - Check connection status\n" +
          "/setbridge - Set this group as bridge\n" +
          "/qr - Get WhatsApp QR code\n" +
          "/help - Show this help message",
        { parse_mode: "Markdown" },
      )
    })

    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id
      const status = global.bot?.isConnected ? "✅ Connected" : "❌ Disconnected"
      await this.bot.sendMessage(chatId, `WhatsApp Status: ${status}`)
    })

    this.bot.onText(/\/setbridge/, async (msg) => {
      const chatId = msg.chat.id
      if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
        await this.database.setBridgeSettings(chatId.toString())
        this.bridgeGroupId = chatId.toString()
        await this.bot.sendMessage(chatId, "✅ This group is now set as the WhatsApp bridge!")
      } else {
        await this.bot.sendMessage(chatId, "❌ This command can only be used in groups!")
      }
    })

    this.bot.onText(/\/qr/, async (msg) => {
      const chatId = msg.chat.id
      await this.bot.sendMessage(chatId, "🔄 Requesting new QR code...")
      // The QR will be sent when WhatsApp generates it
    })
  }

  async handleTelegramMessage(msg) {
    // Handle replies to topics (for sending messages back to WhatsApp)
    if (msg.reply_to_message && msg.reply_to_message.forum_topic_created) {
      const topicName = msg.reply_to_message.forum_topic_created.name
      const contact = await this.database.db.get("SELECT * FROM contacts WHERE telegram_topic_id = ?", [
        msg.message_thread_id,
      ])

      if (contact && global.bot?.sock) {
        await global.bot.sock.sendMessage(contact.whatsapp_id, { text: msg.text })
        this.logger.info(`Sent message to WhatsApp: ${contact.whatsapp_id}`)
      }
    }
  }

  async sendWhatsAppMessageToTelegram(contact, message, messageType = "text") {
    if (!this.bridgeGroupId) return

    try {
      let topicId = contact.telegram_topic_id

      // Create topic if it doesn't exist
      if (!topicId) {
        const topicName = contact.name || contact.phone || contact.whatsapp_id.split("@")[0]
        const topic = await this.bot.createForumTopic(this.bridgeGroupId, topicName, {
          icon_color: 0x6fb9f0,
        })
        topicId = topic.message_thread_id
        await this.database.updateContactTopic(contact.whatsapp_id, topicId)
      }

      // Send message to topic
      const messageText = `📱 *${contact.name || "Unknown"}*\n${message}`
      await this.bot.sendMessage(this.bridgeGroupId, messageText, {
        message_thread_id: topicId,
        parse_mode: "Markdown",
      })
    } catch (error) {
      this.logger.error("Error sending message to Telegram:", error)
    }
  }

  async notifyConnectionStatus(isConnected) {
    if (this.adminChatId) {
      const status = isConnected ? "✅ Connected" : "❌ Disconnected"
      const message = `🤖 WhatsApp Bot Status: ${status}`
      await this.bot.sendMessage(this.adminChatId, message)
    }
  }

  async sendQRCode(qrCodeBuffer) {
    if (this.adminChatId) {
      await this.bot.sendPhoto(this.adminChatId, qrCodeBuffer, {
        caption: "📱 Scan this QR code with WhatsApp to connect",
      })
    }

    if (this.bridgeGroupId) {
      await this.bot.sendPhoto(this.bridgeGroupId, qrCodeBuffer, {
        caption: "📱 Scan this QR code with WhatsApp to connect",
      })
    }
  }
}
