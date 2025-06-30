import fs from "fs"
import path from "path"

export class ModuleManager {
  constructor(database, config, logger) {
    this.database = database
    this.config = config
    this.logger = logger
    this.modules = new Map()
    this.modulesPath = config.get("modules.pluginsPath")
  }

  async loadModules() {
    if (!fs.existsSync(this.modulesPath)) {
      fs.mkdirSync(this.modulesPath, { recursive: true })
      await this.createExampleModule()
    }

    const moduleFiles = fs.readdirSync(this.modulesPath).filter((file) => file.endsWith(".js") && !file.startsWith("_"))

    for (const file of moduleFiles) {
      try {
        const modulePath = path.join(process.cwd(), this.modulesPath, file)
        const moduleClass = await import(`file://${modulePath}`)
        const moduleName = path.basename(file, ".js")

        // Check if module is in default modules list or if auto-load is enabled
        const defaultModules = this.config.get("modules.defaultModules")
        const autoLoad = this.config.get("modules.autoLoad")

        if (autoLoad || defaultModules.includes(moduleName)) {
          const moduleInstance = new moduleClass.default(this.database, this.config, this.logger)
          this.modules.set(moduleName, moduleInstance)

          await this.database.saveModule(moduleName)
          this.logger.info(`Loaded module: ${moduleName}`)
        }
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
    constructor(database, config, logger) {
        this.database = database;
        this.config = config;
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
