export default class PairingModule {
  constructor(database, logger) {
    this.database = database
    this.logger = logger
    this.name = "pairing"
  }

  shouldProcess(messageInfo, contact) {
    return messageInfo.text.toLowerCase().startsWith("!pair") || messageInfo.text.toLowerCase().startsWith("!connect")
  }

  async process(messageInfo, contact) {
    const parts = messageInfo.text.split(" ")

    if (parts.length < 2) {
      return {
        response: `📱 *Pairing Code Help*

To connect WhatsApp using pairing code:
• Send: \`!pair [your_phone_number]\`
• Example: \`!pair +1234567890\`

Or use Telegram commands:
• \`/pair [phone_number]\` - Get pairing code
• \`/qr\` - Get QR code instead

*Note:* You can only pair one WhatsApp account at a time.`,
      }
    }

    const phoneNumber = parts[1].replace(/[^0-9]/g, "")

    if (!phoneNumber || phoneNumber.length < 10) {
      return {
        response: "❌ Please provide a valid phone number.\nExample: !pair +1234567890",
      }
    }

    try {
      if (global.bot?.sock && !global.bot.sock.authState.creds.registered) {
        const code = await global.bot.sock.requestPairingCode(phoneNumber)
        return {
          response: `📱 *Pairing Code Generated*

Phone: +${phoneNumber}
Code: \`${code}\`

Enter this code in WhatsApp to connect your account.
The code will expire in a few minutes.`,
        }
      } else {
        return {
          response: "❌ WhatsApp is already connected or not ready for pairing. Use !status to check connection.",
        }
      }
    } catch (error) {
      this.logger.error("Error in pairing module:", error)
      return {
        response: "❌ Failed to generate pairing code. Please try again later or contact administrator.",
      }
    }
  }
}
