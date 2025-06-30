import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import config from "../config.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log("🚀 Setting up WhatsApp Telegram Bridge Bot...\n")

// Create necessary directories
const directories = ["data", "sessions", "src/modules/plugins", "logs", "data/backups"]

directories.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`✅ Created directory: ${dir}`)
  }
})

// Check if config.json exists, if not it will be created automatically
if (!fs.existsSync("config.json")) {
  console.log("✅ Created config.json file from defaults")
  console.log("⚠️  Please edit config.json with your configuration")
} else {
  console.log("ℹ️  config.json file already exists")
}

// Migrate from .env if it exists
if (fs.existsSync(".env")) {
  console.log("📦 Found .env file, migrating to config.json...")
  config.migrateFromEnv()
}

// Create example custom module
const exampleCustomModule = `export default class WelcomeModule {
    constructor(database, config, logger) {
        this.database = database;
        this.config = config;
        this.logger = logger;
        this.name = 'welcome';
    }

    shouldProcess(messageInfo, contact) {
        // Process first message from new contacts
        return messageInfo.text.toLowerCase().includes('hello') || 
               messageInfo.text.toLowerCase().includes('hi');
    }

    async process(messageInfo, contact) {
        return {
            response: \`👋 Welcome! I'm \${this.config.botName} with Telegram bridge functionality. 
            
Available commands:
• !echo [message] - Echo your message
• !help - Show help
• !status - Bot status\`
        };
    }
}`

const customModulePath = "src/modules/plugins/welcome.js"
if (!fs.existsSync(customModulePath)) {
  fs.writeFileSync(customModulePath, exampleCustomModule)
  console.log("✅ Created example welcome module")
}

console.log("\n🎉 Setup complete!")
console.log("\nNext steps:")
console.log("1. Edit config.json with your Telegram bot token and admin chat ID")
console.log("2. Run: npm start")
console.log("3. Scan QR code with WhatsApp or use pairing code")
console.log("4. Set up Telegram bridge group with /setbridge command")
console.log("\nFor more modules, add them to src/modules/plugins/")
console.log("\nConfiguration file: config.json")
