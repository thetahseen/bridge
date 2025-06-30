import { makeWASocket, DisconnectReason } from "@whiskeysockets/baileys"
import TelegramBot from "node-telegram-bot-api"
import Boom from "@hapi/boom"
import pino from "pino"
import dotenv from "dotenv"
import { DatabaseManager } from "./database/manager.js"
import { TelegramBridge } from "./bridges/telegram.js"
import { ModuleManager } from "./modules/manager.js"
import { QRCodeManager } from "./utils/qrcode.js"
import { MessageHandler } from "./handlers/message.js"
import fs from "fs"
import path from "path"

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
    this.messageHandler = null
    this.isConnected = false
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

      // Start WhatsApp connection
      await this.connectWhatsApp()
    } catch (error) {
      this.logger.error("Failed to initialize bot:", error)
      process.exit(1)
    }
  }

  async connectWhatsApp() {
    const sessionPath = process.env.WHATSAPP_SESSION_PATH || "./sessions"

    // Ensure session directory exists
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true })
    }

    const { state, saveCreds } = await this.useMultiFileAuthState(sessionPath)

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: this.logger,
      browser: ["WhatsApp Bridge Bot", "Chrome", "1.0.0"],
    })

    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr && this.telegramBridge) {
        // Send QR code to Telegram
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

  async useMultiFileAuthState(sessionPath) {
    const existingFiles = fs.readdirSync(sessionPath)
    const creds = existingFiles.find((file) => file.endsWith(".json"))
    if (creds) {
      const credsData = JSON.parse(fs.readFileSync(path.join(sessionPath, creds), "utf-8"))
      return {
        state: credsData,
        saveCreds: (newState) => {
          fs.writeFileSync(path.join(sessionPath, creds), JSON.stringify(newState, null, 2))
        },
      }
    } else {
      return {
        state: {},
        saveCreds: (newState) => {
          const credsFile = path.join(sessionPath, "creds.json")
          fs.writeFileSync(credsFile, JSON.stringify(newState, null, 2))
        },
      }
    }
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
