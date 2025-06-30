import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys"
import TelegramBot from "node-telegram-bot-api"
import pino from "pino"
import config from "../config.js"
import { DatabaseManager } from "./database/manager.js"
import { TelegramBridge } from "./bridges/telegram.js"
import { ModuleManager } from "./modules/manager.js"
import { QRCodeManager } from "./utils/qrcode.js"
import { MessageHandler } from "./handlers/message.js"
import fs from "fs"
import { PairingManager } from "./utils/pairing.js"

class WhatsAppTelegramBot {
  constructor() {
    this.logger = pino({ level: config.logLevel })
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
    this.reconnectAttempts = 0
  }

  async initialize() {
    try {
      this.logger.info(`Initializing ${config.botName} v${config.botVersion}...`)

      // Validate configuration
      const configErrors = config.validate()
      if (configErrors.length > 0) {
        this.logger.error("Configuration errors:", configErrors)
        console.log("\n❌ Configuration errors found:")
        configErrors.forEach((error) => console.log(`  • ${error}`))
        console.log("\nPlease fix config.json and restart the bot.\n")
        process.exit(1)
      }

      // Initialize database
      this.database = new DatabaseManager(config)
      await this.database.initialize()

      // Initialize QR code manager
      this.qrManager = new QRCodeManager(config, this.logger)

      // Initialize Telegram bot
      if (config.telegramBotToken) {
        this.telegramBot = new TelegramBot(config.telegramBotToken, { polling: true })
        this.telegramBridge = new TelegramBridge(this.telegramBot, this.database, config, this.logger)
        await this.telegramBridge.initialize()
      } else {
        this.logger.warn("Telegram bot token not provided, bridge functionality disabled")
      }

      // Initialize module manager
      if (config.get("modules.enabled")) {
        this.moduleManager = new ModuleManager(this.database, config, this.logger)
        await this.moduleManager.loadModules()
      }

      // Initialize message handler
      this.messageHandler = new MessageHandler(
        this.database,
        this.telegramBridge,
        this.moduleManager,
        config,
        this.logger,
      )

      // Initialize pairing manager
      this.pairingManager = new PairingManager(config, this.logger)

      // Start WhatsApp connection
      await this.connectWhatsApp()
    } catch (error) {
      this.logger.error("Failed to initialize bot:", error)
      process.exit(1)
    }
  }

  async connectWhatsApp() {
    try {
      const { version, isLatest } = await fetchLatestBaileysVersion()

      // Ensure session directory exists
      if (!fs.existsSync(config.whatsappSessionPath)) {
        fs.mkdirSync(config.whatsappSessionPath, { recursive: true })
      }

      const { state, saveCreds } = await useMultiFileAuthState(config.whatsappSessionPath)
      this.state = state
      this.saveCreds = saveCreds

      this.logger.info(`Using Baileys version: ${version.join(".")}, isLatest: ${isLatest}`)

      this.sock = makeWASocket({
        version,
        auth: this.state,
        printQRInTerminal: config.get("whatsapp.printQRInTerminal") && !config.whatsappPairingNumber,
        logger: this.logger,
        browser: config.get("whatsapp.browser"),
        connectTimeoutMs: config.get("whatsapp.connectTimeoutMs"),
        defaultQueryTimeoutMs: config.get("whatsapp.defaultQueryTimeoutMs"),
        keepAliveIntervalMs: config.get("whatsapp.keepAliveIntervalMs"),
        retryRequestDelayMs: config.get("whatsapp.retryRequestDelayMs"),
        maxMsgRetryCount: config.get("whatsapp.maxMsgRetryCount"),
        markOnlineOnConnect: config.get("whatsapp.markOnlineOnConnect"),
        syncFullHistory: config.get("whatsapp.syncFullHistory"),
        generateHighQualityLinkPreview: config.get("whatsapp.generateHighQualityLinkPreview"),
      })

      // Handle pairing code if phone number is provided
      if (config.whatsappPairingNumber && !this.sock.authState.creds.registered) {
        const phoneNumber = config.whatsappPairingNumber.replace(/[^0-9]/g, "")
        this.logger.info(`Requesting pairing code for ${phoneNumber}...`)

        setTimeout(async () => {
          try {
            const code = await this.sock.requestPairingCode(phoneNumber)
            this.logger.info(`Pairing code: ${code}`)

            if (this.telegramBridge) {
              await this.telegramBridge.sendPairingCode(phoneNumber, code)
            }
          } catch (error) {
            this.logger.error("Error requesting pairing code:", error)
          }
        }, 3000)
      }

      this.sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update

        this.logger.info("Connection update:", { connection, isNewLogin })

        if (qr && this.telegramBridge && !config.whatsappPairingNumber) {
          await this.qrManager.sendQRToTelegram(qr, this.telegramBridge)
        }

        if (connection === "close") {
          const shouldReconnect = this.shouldReconnect(lastDisconnect)

          this.logger.info("Connection closed", {
            error: lastDisconnect?.error?.message,
            statusCode: lastDisconnect?.error?.output?.statusCode,
            shouldReconnect,
            attempts: this.reconnectAttempts,
          })

          this.isConnected = false
          if (this.telegramBridge) {
            await this.telegramBridge.notifyConnectionStatus(false)
          }

          if (shouldReconnect && config.get("bot.autoReconnect")) {
            this.reconnectAttempts++
            if (this.reconnectAttempts <= config.get("bot.maxReconnectAttempts")) {
              this.logger.info(
                `Reconnecting in ${config.get("bot.reconnectDelay")}ms... (attempt ${this.reconnectAttempts})`,
              )
              setTimeout(() => this.connectWhatsApp(), config.get("bot.reconnectDelay"))
            } else {
              this.logger.error("Max reconnection attempts reached. Stopping bot.")
              process.exit(1)
            }
          }
        } else if (connection === "connecting") {
          this.logger.info("Connecting to WhatsApp...")
        } else if (connection === "open") {
          this.logger.info("WhatsApp connection opened successfully")
          this.isConnected = true
          this.reconnectAttempts = 0 // Reset counter on successful connection
          if (this.telegramBridge) {
            await this.telegramBridge.notifyConnectionStatus(true)
          }
        }
      })

      this.sock.ev.on("creds.update", this.saveCreds)

      this.sock.ev.on("messages.upsert", async (m) => {
        if (m.type === "notify") {
          for (const msg of m.messages) {
            await this.messageHandler.handleWhatsAppMessage(msg, this.sock)
          }
        }
      })
    } catch (error) {
      this.logger.error("Error in connectWhatsApp:", error)
      if (config.get("bot.autoReconnect")) {
        setTimeout(() => this.connectWhatsApp(), 10000)
      }
    }
  }

  shouldReconnect(lastDisconnect) {
    if (!lastDisconnect?.error) return true

    const statusCode = lastDisconnect.error.output?.statusCode

    const noReconnectCodes = [
      DisconnectReason.loggedOut,
      DisconnectReason.badSession,
      DisconnectReason.multideviceMismatch,
    ]

    if (noReconnectCodes.includes(statusCode)) {
      this.logger.info(`Not reconnecting due to: ${statusCode}`)
      return false
    }

    return true
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

    setTimeout(() => {
      process.exit(0)
    }, config.get("advanced.gracefulShutdownTimeout"))
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
