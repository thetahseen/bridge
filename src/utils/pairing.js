export class PairingManager {
  constructor(logger) {
    this.logger = logger
  }

  validatePhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, "")

    // Check if it's a valid length (typically 10-15 digits)
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      return null
    }

    return cleanNumber
  }

  formatPhoneNumber(phoneNumber) {
    const cleaned = this.validatePhoneNumber(phoneNumber)
    if (!cleaned) return null

    // Add country code if not present
    if (cleaned.length === 10) {
      // Assume US number, add +1
      return `1${cleaned}`
    }

    return cleaned
  }

  async requestPairingCode(sock, phoneNumber) {
    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber)
      if (!formattedNumber) {
        throw new Error("Invalid phone number format")
      }

      this.logger.info(`Requesting pairing code for: +${formattedNumber}`)
      const code = await sock.requestPairingCode(formattedNumber)

      return {
        phoneNumber: formattedNumber,
        code: code,
        success: true,
      }
    } catch (error) {
      this.logger.error("Error requesting pairing code:", error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  formatPairingCode(code) {
    // Format pairing code for better readability (e.g., "12345678" -> "1234-5678")
    if (code.length === 8) {
      return `${code.slice(0, 4)}-${code.slice(4)}`
    }
    return code
  }
}
