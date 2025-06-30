import sqlite3 from "sqlite3"
import { promisify } from "util"
import fs from "fs"
import path from "path"

export class DatabaseManager {
  constructor() {
    this.db = null
    this.dbPath = process.env.DATABASE_PATH || "./data/bot.db"
  }

  async initialize() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    this.db = new sqlite3.Database(this.dbPath)

    // Promisify database methods
    this.db.run = promisify(this.db.run.bind(this.db))
    this.db.get = promisify(this.db.get.bind(this.db))
    this.db.all = promisify(this.db.all.bind(this.db))

    await this.createTables()
  }

  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                whatsapp_id TEXT UNIQUE NOT NULL,
                telegram_topic_id INTEGER,
                name TEXT,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

      `CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id INTEGER,
                message_id TEXT,
                content TEXT,
                message_type TEXT,
                platform TEXT,
                direction TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (contact_id) REFERENCES contacts (id)
            )`,

      `CREATE TABLE IF NOT EXISTS bridge_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_group_id TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

      `CREATE TABLE IF NOT EXISTS modules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                config TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
    ]

    for (const table of tables) {
      await this.db.run(table)
    }
  }

  async getContact(whatsappId) {
    return await this.db.get("SELECT * FROM contacts WHERE whatsapp_id = ?", [whatsappId])
  }

  async createContact(whatsappId, name, phone) {
    const result = await this.db.run("INSERT INTO contacts (whatsapp_id, name, phone) VALUES (?, ?, ?)", [
      whatsappId,
      name,
      phone,
    ])
    return result.lastID
  }

  async updateContactTopic(whatsappId, topicId) {
    await this.db.run(
      "UPDATE contacts SET telegram_topic_id = ?, updated_at = CURRENT_TIMESTAMP WHERE whatsapp_id = ?",
      [topicId, whatsappId],
    )
  }

  async saveMessage(contactId, messageId, content, messageType, platform, direction) {
    await this.db.run(
      "INSERT INTO messages (contact_id, message_id, content, message_type, platform, direction) VALUES (?, ?, ?, ?, ?, ?)",
      [contactId, messageId, content, messageType, platform, direction],
    )
  }

  async getBridgeSettings() {
    return await this.db.get("SELECT * FROM bridge_settings WHERE is_active = 1 LIMIT 1")
  }

  async setBridgeSettings(telegramGroupId) {
    await this.db.run("DELETE FROM bridge_settings")
    await this.db.run("INSERT INTO bridge_settings (telegram_group_id) VALUES (?)", [telegramGroupId])
  }

  async getActiveModules() {
    return await this.db.all("SELECT * FROM modules WHERE is_active = 1")
  }

  async saveModule(name, config = "{}") {
    await this.db.run("INSERT OR REPLACE INTO modules (name, config) VALUES (?, ?)", [name, config])
  }

  async close() {
    if (this.db) {
      this.db.close()
    }
  }
}
