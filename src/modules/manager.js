import fs from "fs"
import path from "path"

export class ModuleManager {
  constructor(database, logger) {
    this.database = database
    this.logger = logger
    this.modules = new Map()
    this.modulesPath = "./src/modules/plugins"
  }

  async loadModules() {
    // Ensure modules directory exists
    if (!fs.existsSync(this.modulesPath)) {
      fs.mkdirSync(this.modulesPath, { recursive: true })

      // Create example module
      await this.createExampleModule()
    }

    const moduleFiles = fs.readdirSync(this.modulesPath).filter((file) => file.endsWith(".js") && !file.startsWith("_"))

    for (const file of moduleFiles) {
      try {
        const modulePath = path.join(process.cwd(), this.modulesPath, file)
        const moduleClass = await import(`file://${modulePath}`)
        const moduleName = path.basename(file, ".js")

        const moduleInstance = new moduleClass.default(this.database, this.logger)
        this.modules.set(moduleName, moduleInstance)

        // Save to database
        await this.database.saveModule(moduleName)

        this.logger.info(`Loaded module: ${moduleName}`)
      } catch (error) {
        this.logger.error(`Failed to load module ${file}:`, error)
      }
    }
  }

  async processMessage(messageInfo, contact) {
    let processedMessage = { ...messageInfo }

    for (const [name, module] of this.modules) {
      try {
        if (module.shouldProcess && module.shouldProcess(messageInfo, contact)) {
          const result = await module.process(messageInfo, contact)
          if (result) {
            processedMessage = { ...processedMessage, ...result }
          }
        }
      } catch (error) {
        this.logger.error(`Error in module ${name}:`, error)
      }
    }

    return processedMessage
  }

  async createExampleModule() {
    const exampleModule = `export default class EchoModule {
    constructor(database, logger) {
        this.database = database;
        this.logger = logger;
        this.name = 'echo';
    }

    shouldProcess(messageInfo, contact) {
        return messageInfo.text.startsWith('!echo');
    }

    async process(messageInfo, contact) {
        const text = messageInfo.text.replace('!echo', '').trim();
        return {
            response: \`Echo: \${text}\`
        };
    }
}`

    fs.writeFileSync(path.join(this.modulesPath, "echo.js"), exampleModule)
  }
}
