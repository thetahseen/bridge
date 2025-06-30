import QRCode from "qrcode"

export class QRCodeManager {
  constructor(config, logger) {
    this.config = config
    this.logger = logger
  }

  async sendQRToTelegram(qrString, telegramBridge) {
    try {
      const qrBuffer = await QRCode.toBuffer(qrString, {
        type: "png",
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })

      await telegramBridge.sendQRCode(qrBuffer)
    } catch (error) {
      this.logger.error("Error generating/sending QR code:", error)
    }
  }
}
