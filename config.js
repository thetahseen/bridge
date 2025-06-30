import fs from "fs"
import path from "path"

class Config {
  constructor() {
    this.configPath = "./config.json"
    this.defaultConfig = {
      // Telegram Bot Configuration
      telegram: {
        botToken: "6817290645:AAGHqXG76oU0fZe0pBqySe01VoJ39k75lUk",
        adminChatId: "6387028671",
        bridgeGroupId: "",
      },

      // WhatsApp Configuration
      whatsapp: {
        sessionPath: "./sessions",
        pairingNumber: "", // Set to empty string to disable pairing code
        printQRInTerminal: true,
        browser: ["WhatsApp Bridge Bot", "Chrome", "1.0.0"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 1000,
        maxMsgRetryCount: 5,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      },

      // Database Configuration
      database: {
        path: "./data/bot.db",
        backupEnabled: true,
        backupInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        maxBackups: 7,
      },

      // Bot Configuration
      bot: {
        name: "WhatsApp Bridge Bot",
        version: "1.0.0",
        debug: false,
        logLevel: "info", // debug, info, warn, error
        autoReconnect: true,
        maxReconnectAttempts: 10,
        reconnectDelay: 5000,
      },

      // Module Configuration
      modules: {
        enabled: true,
        pluginsPath: "./src/modules/plugins",
        autoLoad: true,
        defaultModules: ["help", "status", "echo", "pairing"],
      },

      // Bridge Configuration
      bridge: {
        enabled: true,
        createTopics: true,
        topicIconColor: 0x6fb9f0,
        messageFormat: "📱 *{name}*\n{message}",
        forwardMedia: true,
        forwardDocuments: true,
      },

      // Security Configuration
      security: {
        allowedUsers: [], // Empty array means all users allowed
        blockedUsers: [],
        adminUsers: ["6387028671"], // Your admin chat ID
        rateLimitEnabled: true,
        maxMessagesPerMinute: 30,
      },

      // Logging Configuration
      logging: {
        enabled: true,
        logToFile: true,
        logPath: "./logs",
        maxLogSize: "10MB",
        maxLogFiles: 5,
        logFormat: "json", // json or text
      },

      // Advanced Configuration
      advanced: {
        useProxy: false,
        proxyUrl: "",
        userAgent: "WhatsApp Bridge Bot/1.0.0",
        connectionRetries: 3,
        healthCheckInterval: 30000, // 30 seconds
        gracefulShutdownTimeout: 10000, // 10 seconds
      },
    }

    this.config = this.loadConfig()
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, "utf8")
        const loadedConfig = JSON.parse(configData)

        // Merge with default config to ensure all properties exist
        return this.mergeDeep(this.defaultConfig, loadedConfig)
      } else {
        // Create default config file
        this.saveConfig(this.defaultConfig)
        console.log("✅ Created default config.json file")
        console.log("⚠️  Please edit config.json with your settings")
        return this.defaultConfig
      }
    } catch (error) {
      console.error("Error loading config:", error)
      console.log("Using default configuration")
      return this.defaultConfig
    }
  }

  saveConfig(config = this.config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
      return true
    } catch (error) {
      console.error("Error saving config:", error)
      return false
    }
  }

  mergeDeep(target, source) {
    const output = Object.assign({}, target)
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) Object.assign(output, { [key]: source[key] })
          else output[key] = this.mergeDeep(target[key], source[key])
        } else {
          Object.assign(output, { [key]: source[key] })
        }
      })
    }
    return output
  }

  isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item)
  }

  get(path) {
    return path.split(".").reduce((obj, key) => obj?.[key], this.config)
  }

  set(path, value) {
    const keys = path.split(".")
    const lastKey = keys.pop()
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) obj[key] = {}
      return obj[key]
    }, this.config)

    target[lastKey] = value
    this.saveConfig()
  }

  // Convenience getters for commonly used config values
  get telegramBotToken() {
    return this.get("telegram.botToken")
  }

  get telegramAdminChatId() {
    return this.get("telegram.adminChatId")
  }

  get whatsappSessionPath() {
    return this.get("whatsapp.sessionPath")
  }

  get whatsappPairingNumber() {
    return this.get("whatsapp.pairingNumber")
  }

  get databasePath() {
    return this.get("database.path")
  }

  get isDebugMode() {
    return this.get("bot.debug")
  }

  get logLevel() {
    return this.get("bot.logLevel")
  }

  get botName() {
    return this.get("bot.name")
  }

  get botVersion() {
    return this.get("bot.version")
  }

  // Validation methods
  validate() {
    const errors = []

    if (!this.telegramBotToken) {
      errors.push("Telegram bot token is required")
    }

    if (!this.telegramAdminChatId) {
      errors.push("Telegram admin chat ID is required")
    }

    if (!fs.existsSync(path.dirname(this.databasePath))) {
      try {
        fs.mkdirSync(path.dirname(this.databasePath), { recursive: true })
      } catch (error) {
        errors.push(`Cannot create database directory: ${error.message}`)
      }
    }

    if (!fs.existsSync(this.whatsappSessionPath)) {
      try {
        fs.mkdirSync(this.whatsappSessionPath, { recursive: true })
      } catch (error) {
        errors.push(`Cannot create session directory: ${error.message}`)
      }
    }

    return errors
  }

  // Environment variable migration (for backward compatibility)
  migrateFromEnv() {
    const envMappings = {
      TELEGRAM_BOT_TOKEN: "telegram.botToken",
      TELEGRAM_ADMIN_CHAT_ID: "telegram.adminChatId",
      WHATSAPP_SESSION_PATH: "whatsapp.sessionPath",
      PAIRING_NUMBER: "whatsapp.pairingNumber",
      DATABASE_PATH: "database.path",
      BOT_NAME: "bot.name",
      DEBUG: "bot.debug",
    }

    let migrated = false
    Object.entries(envMappings).forEach(([envVar, configPath]) => {
      if (process.env[envVar]) {
        let value = process.env[envVar]

        // Convert string booleans
        if (value === "true") value = true
        if (value === "false") value = false

        this.set(configPath, value)
        migrated = true
      }
    })

    if (migrated) {
      console.log("✅ Migrated environment variables to config.json")
      this.saveConfig()
    }

    return migrated
  }

  // Export configuration for external tools
  export() {
    return JSON.stringify(this.config, null, 2)
  }

  // Import configuration
  import(configString) {
    try {
      const importedConfig = JSON.parse(configString)
      this.config = this.mergeDeep(this.defaultConfig, importedConfig)
      this.saveConfig()
      return true
    } catch (error) {
      console.error("Error importing config:", error)
      return false
    }
  }

  // Reset to default configuration
  reset() {
    this.config = { ...this.defaultConfig }
    this.saveConfig()
    console.log("✅ Configuration reset to defaults")
  }
}

// Create and export singleton instance
const config = new Config()

// Auto-migrate from .env if it exists
if (fs.existsSync(".env")) {
  console.log("📦 Found .env file, attempting migration...")
  config.migrateFromEnv()
}

export default config
