export class MessageHandler {
  constructor(database, telegramBridge, moduleManager, logger) {
    this.database = database
    this.telegramBridge = telegramBridge
    this.moduleManager = moduleManager
    this.logger = logger
  }

  async handleWhatsAppMessage(message, sock) {
    try {
      const messageInfo = this.extractMessageInfo(message)
      if (!messageInfo) return

      // Get or create contact
      let contact = await this.database.getContact(messageInfo.from)
      if (!contact) {
        const contactId = await this.database.createContact(
          messageInfo.from,
          messageInfo.pushName || "Unknown",
          messageInfo.from.split("@")[0],
        )
        contact = await this.database.getContact(messageInfo.from)
      }

      // Save message to database
      await this.database.saveMessage(
        contact.id,
        message.key.id,
        messageInfo.text,
        messageInfo.type,
        "whatsapp",
        "incoming",
      )

      // Process through modules
      const processedMessage = await this.moduleManager.processMessage(messageInfo, contact)

      // Send to Telegram bridge
      if (this.telegramBridge) {
        await this.telegramBridge.sendWhatsAppMessageToTelegram(
          contact,
          processedMessage.text || messageInfo.text,
          messageInfo.type,
        )
      }

      // Handle module responses
      if (processedMessage.response) {
        await sock.sendMessage(messageInfo.from, { text: processedMessage.response })
      }
    } catch (error) {
      this.logger.error("Error handling WhatsApp message:", error)
    }
  }

  extractMessageInfo(message) {
    if (!message.message) return null

    const messageTypes = ["conversation", "extendedTextMessage", "imageMessage", "videoMessage", "audioMessage"]
    let messageType = "unknown"
    let text = ""

    for (const type of messageTypes) {
      if (message.message[type]) {
        messageType = type
        if (type === "conversation") {
          text = message.message[type]
        } else if (type === "extendedTextMessage") {
          text = message.message[type].text
        } else if (["imageMessage", "videoMessage", "audioMessage"].includes(type)) {
          text = message.message[type].caption || `[${type.replace("Message", "")}]`
        }
        break
      }
    }

    return {
      from: message.key.remoteJid,
      text,
      type: messageType,
      pushName: message.pushName,
      timestamp: message.messageTimestamp,
    }
  }
}
