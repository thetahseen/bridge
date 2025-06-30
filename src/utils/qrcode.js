import QRCode from "qrcode"

export class QRCodeManager {
  constructor() {
    this.logger = null
  }

  async sendQRToTelegram(qrString, telegramBridge) {
    try {
      // Generate QR code as buffer
      const qrBuffer = await QRCode.toBuffer(qrString, {
        type: "png",
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })

      // Send to Telegram
      await telegramBridge.sendQRCode(qrBuffer)
    } catch (error) {
      console.error("Error generating/sending QR code:", error)
    }
  }
}
