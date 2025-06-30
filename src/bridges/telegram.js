export class TelegramBridge {
  constructor(telegramBot, database, config, logger) {
    this.bot = telegramBot
    this.database = database
    this.config = config
    this.logger = logger
    this.adminChatId = config.telegramAdminChatId
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
        `🤖 *${this.config.botName} v${this.config.botVersion}*\n\n` +
          "Commands:\n" +
          "/status - Check connection status\n" +
          "/setbridge - Set this group as bridge\n" +
          "/qr - Get WhatsApp QR code\n" +
          "/pair [phone] - Get pairing code for phone number\n" +
          "/unpair - Disconnect WhatsApp\n" +
          "/config - Show current configuration\n" +
          "/help - Show this help message\n\n" +
          "*Connection Methods:*\n" +
          "• QR Code: Use /qr command\n" +
          "• Pairing Code: Use /pair [your_phone_number]",
        { parse_mode: "Markdown" },
      )
    })

    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id
      const status = global.bot?.isConnected ? "✅ Connected" : "❌ Disconnected"
      const uptime = process.uptime()
      const hours = Math.floor(uptime / 3600)
      const minutes = Math.floor((uptime % 3600) / 60)

      const statusMessage =
        `📊 *Bot Status*\n\n` +
        `*Connection:* ${status}\n` +
        `*Uptime:* ${hours}h ${minutes}m\n` +
        `*Version:* ${this.config.botVersion}\n` +
        `*Modules:* ${global.bot?.moduleManager?.modules?.size || 0} loaded\n` +
        `*Bridge:* ${this.bridgeGroupId ? "✅ Active" : "❌ Not set"}`

      await this.bot.sendMessage(chatId, statusMessage, { parse_mode: "Markdown" })
    })

    this.bot.onText(/\/config/, async (msg) => {
      const chatId = msg.chat.id
      if (chatId.toString() !== this.adminChatId) {
        await this.bot.sendMessage(chatId, "❌ This command is only available to administrators.")
        return
      }

      const configInfo =
        `⚙️ *Configuration*\n\n` +
        `*Bot Name:* ${this.config.botName}\n` +
        `*Debug Mode:* ${this.config.isDebugMode ? "✅" : "❌"}\n` +
        `*Auto Reconnect:* ${this.config.get("bot.autoReconnect") ? "✅" : "❌"}\n` +
        `*Modules Enabled:* ${this.config.get("modules.enabled") ? "✅" : "❌"}\n` +
        `*Bridge Enabled:* ${this.config.get("bridge.enabled") ? "✅" : "❌"}\n` +
        `*Database Backups:* ${this.config.get("database.backupEnabled") ? "✅" : "❌"}`

      await this.bot.sendMessage(chatId, configInfo, { parse_mode: "Markdown" })
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
    })

    this.bot.onText(/\/pair (.+)/, async (msg, match) => {
      const chatId = msg.chat.id
      const phoneNumber = match[1].replace(/[^0-9]/g, "")

      if (!phoneNumber) {
        await this.bot.sendMessage(chatId, "❌ Please provide a valid phone number.\nExample: /pair 1234567890")
        return
      }

      try {
        await this.bot.sendMessage(chatId, "🔄 Requesting pairing code, please wait...")

        if (global.bot?.sock) {
          if (global.bot.sock.authState.creds.registered) {
            await this.bot.sendMessage(chatId, "❌ WhatsApp is already connected. Use /unpair first to disconnect.")
            return
          }

          await new Promise((resolve) => setTimeout(resolve, 2000))

          const code = await global.bot.sock.requestPairingCode(phoneNumber)
          await this.sendPairingCode(phoneNumber, code)
          await this.bot.sendMessage(chatId, "✅ Pairing code sent! Check the messages above.")
        } else {
          await this.bot.sendMessage(chatId, "❌ WhatsApp connection not ready. Please wait and try again.")
        }
      } catch (error) {
        this.logger.error("Error requesting pairing code:", error)
        await this.bot.sendMessage(chatId, `❌ Failed to generate pairing code: ${error.message}`)
      }
    })

    this.bot.onText(/\/unpair/, async (msg) => {
      const chatId = msg.chat.id
      try {
        if (global.bot?.sock) {
          await global.bot.sock.logout()
          await this.bot.sendMessage(chatId, "✅ WhatsApp has been disconnected. You can now pair with a new number.")
        } else {
          await this.bot.sendMessage(chatId, "❌ No active WhatsApp connection found.")
        }
      } catch (error) {
        this.logger.error("Error disconnecting WhatsApp:", error)
        await this.bot.sendMessage(chatId, "❌ Failed to disconnect WhatsApp.")
      }
    })
  }

  async handleTelegramMessage(msg) {
    if (msg.reply_to_message && msg.reply_to_message.forum_topic_created) {
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
    if (!this.bridgeGroupId || !this.config.get("bridge.enabled")) return

    try {
      let topicId = contact.telegram_topic_id

      if (!topicId && this.config.get("bridge.createTopics")) {
        const topicName = contact.name || contact.phone || contact.whatsapp_id.split("@")[0]
        const topic = await this.bot.createForumTopic(this.bridgeGroupId, topicName, {
          icon_color: this.config.get("bridge.topicIconColor"),
        })
        topicId = topic.message_thread_id
        await this.database.updateContactTopic(contact.whatsapp_id, topicId)
      }

      const messageFormat = this.config.get("bridge.messageFormat")
      const messageText = messageFormat.replace("{name}", contact.name || "Unknown").replace("{message}", message)

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
      const message = `🤖 ${this.config.botName} Status: ${status}`
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

  async sendPairingCode(phoneNumber, code) {
    const message =
      `📱 *WhatsApp Pairing Code*\n\n` +
      `Phone: +${phoneNumber}\n` +
      `Code: \`${code}\`\n\n` +
      `Enter this code in WhatsApp to connect your account.`

    if (this.adminChatId) {
      await this.bot.sendMessage(this.adminChatId, message, {
        parse_mode: "Markdown",
      })
    }

    if (this.bridgeGroupId) {
      await this.bot.sendMessage(this.bridgeGroupId, message, {
        parse_mode: "Markdown",
      })
    }
  }
}
