import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log("🚀 Setting up WhatsApp Telegram Bridge Bot...\n")

// Create necessary directories
const directories = ["data", "sessions", "src/modules/plugins", "logs"]

directories.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`✅ Created directory: ${dir}`)
  }
})

// Copy .env.example to .env if it doesn't exist
if (!fs.existsSync(".env")) {
  fs.copyFileSync(".env.example", ".env")
  console.log("✅ Created .env file from template")
  console.log("⚠️  Please edit .env file with your configuration")
} else {
  console.log("ℹ️  .env file already exists")
}

// Create example custom module
const exampleCustomModule = `export default class WelcomeModule {
    constructor(database, logger) {
        this.database = database;
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
            response: \`👋 Welcome! I'm a WhatsApp bot with Telegram bridge functionality. 
            
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
console.log("1. Edit .env file with your Telegram bot token")
console.log("2. Run: npm start")
console.log("3. Scan QR code with WhatsApp")
console.log("4. Set up Telegram bridge group with /setbridge command")
console.log("\nFor more modules, add them to src/modules/plugins/")
