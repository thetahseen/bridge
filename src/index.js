import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys"
import TelegramBot from "node-telegram-bot-api"
import { Boom } from "@hapi/boom"
import pino from "pino"
import dotenv from "dotenv"
import { DatabaseManager } from "./database/manager.js"
import { TelegramBridge } from "./bridges/telegram.js"
import { ModuleManager } from "./modules/manager.js"
import { QRCodeManager } from "./utils/qrcode.js"
import { MessageHandler } from "./handlers/message.js"
import fs from "fs"
import { PairingManager } from "./utils/pairing.js"

dotenv.config()

class WhatsAppTelegramBot {
  constructor() {
    this.logger = pino({ level: process.env.DEBUG === "true" ? "debug" : "info" })
    this.sock = null
    this.telegramBot = null
    this.database = null
    this.telegramBridge = null
    this.moduleManager = null
    this.qrManager = null
    this.pairingManager = null
    this.messageHandler = null
    this.isConnected = false
    this.state = null
    this.saveCreds = null
  }

  async initialize() {
    try {
      this.logger.info("Initializing WhatsApp Telegram Bridge Bot...")

      // Initialize database
      this.database = new DatabaseManager()
      await this.database.initialize()

      // Initialize QR code manager
      this.qrManager = new QRCodeManager()

      // Initialize Telegram bot
      if (process.env.TELEGRAM_BOT_TOKEN) {
        this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })
        this.telegramBridge = new TelegramBridge(this.telegramBot, this.database, this.logger)
        await this.telegramBridge.initialize()
      }

      // Initialize module manager
      this.moduleManager = new ModuleManager(this.database, this.logger)
      await this.moduleManager.loadModules()

      // Initialize message handler
      this.messageHandler = new MessageHandler(this.database, this.telegramBridge, this.moduleManager, this.logger)

      // Initialize pairing manager
      this.pairingManager = new PairingManager(this.logger)

      // Start WhatsApp connection
      await this.connectWhatsApp()
    } catch (error) {
      this.logger.error("Failed to initialize bot:", error)
      process.exit(1)
    }
  }

  async connectWhatsApp() {
    const sessionPath = process.env.WHATSAPP_SESSION_PATH || "./sessions"

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version, isLatest } = await fetchLatestBaileysVersion()

    // Ensure session directory exists
    const ensureSessionDirectoryExists = (sessionPath) => {
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true })
      }
    }

    ensureSessionDirectoryExists(sessionPath)

    this.state = state
    this.saveCreds = saveCreds

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: !process.env.PAIRING_NUMBER, // Only print QR if no pairing number
      logger: this.logger,
      browser: ["WhatsApp Bridge Bot", "Chrome", "1.0.0"],
    })

    // Handle pairing code if phone number is provided
    if (process.env.PAIRING_NUMBER && !this.sock.authState.creds.registered) {
      const phoneNumber = process.env.PAIRING_NUMBER.replace(/[^0-9]/g, "")
      this.logger.info(`Requesting pairing code for ${phoneNumber}...`)

      try {
        const code = await this.sock.requestPairingCode(phoneNumber)
        this.logger.info(`Pairing code: ${code}`)

        // Send pairing code to Telegram
        if (this.telegramBridge) {
          await this.telegramBridge.sendPairingCode(phoneNumber, code)
        }
      } catch (error) {
        this.logger.error("Error requesting pairing code:", error)
      }
    }

    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr && this.telegramBridge && !process.env.PAIRING_NUMBER) {
        // Send QR code to Telegram only if not using pairing code
        await this.qrManager.sendQRToTelegram(qr, this.telegramBridge)
      }

      if (connection === "close") {
        const shouldReconnect =
          Boom.isBoom(lastDisconnect?.error) && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
        this.logger.info("Connection closed due to", lastDisconnect?.error, ", reconnecting:", shouldReconnect)

        this.isConnected = false
        if (this.telegramBridge) {
          await this.telegramBridge.notifyConnectionStatus(false)
        }

        if (shouldReconnect) {
          setTimeout(() => this.connectWhatsApp(), 5000)
        }
      } else if (connection === "open") {
        this.logger.info("WhatsApp connection opened")
        this.isConnected = true
        if (this.telegramBridge) {
          await this.telegramBridge.notifyConnectionStatus(true)
        }
      }
    })

    this.sock.ev.on("creds.update", saveCreds)

    this.sock.ev.on("messages.upsert", async (m) => {
      if (m.type === "notify") {
        for (const msg of m.messages) {
          await this.messageHandler.handleWhatsAppMessage(msg, this.sock)
        }
      }
    })
  }

  async shutdown() {
    this.logger.info("Shutting down bot...")

    if (this.sock) {
      await this.sock.logout()
    }

    if (this.telegramBot) {
      await this.telegramBot.stopPolling()
    }

    if (this.database) {
      await this.database.close()
    }

    process.exit(0)
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  if (global.bot) {
    await global.bot.shutdown()
  }
})

process.on("SIGTERM", async () => {
  if (global.bot) {
    await global.bot.shutdown()
  }
})

// Start the bot
const bot = new WhatsAppTelegramBot()
global.bot = bot
bot.initialize().catch(console.error)
