const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, 'config.json');
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            // 检查配置文件是否存在
            if (!fs.existsSync(this.configPath)) {
                console.log('Config file not found, creating default config:', this.configPath);
                this.config = this.getDefaultConfig();
                this.saveConfig();
                return this.config;
            }
            
            // 检查文件是否可读
            try {
                fs.accessSync(this.configPath, fs.constants.R_OK);
            } catch (accessError) {
                console.error('Config file is not readable:', accessError);
                return this.getDefaultConfig();
            }
            
            // 读取配置文件
            const configData = fs.readFileSync(this.configPath, 'utf8');
            
            // 验证JSON格式
            try {
                const parsedConfig = JSON.parse(configData);
                
                // 验证必要的配置字段
                if (!this.validateConfig(parsedConfig)) {
                    console.warn('Config validation failed, using default config');
                    return this.getDefaultConfig();
                }
                
                console.log('Configuration loaded successfully from:', this.configPath);
                return parsedConfig;
            } catch (parseError) {
                console.error('Failed to parse config file:', parseError);
                
                // 尝试恢复备份文件
                const backupPath = this.configPath + '.backup';
                if (fs.existsSync(backupPath)) {
                    try {
                        const backupData = fs.readFileSync(backupPath, 'utf8');
                        const backupConfig = JSON.parse(backupData);
                        console.log('Recovered config from backup file');
                        return backupConfig;
                    } catch (backupError) {
                        console.error('Failed to recover from backup:', backupError);
                    }
                }
                
                return this.getDefaultConfig();
            }
        } catch (error) {
            console.error('Error loading config:', error);
            return this.getDefaultConfig();
        }
    }

    saveConfig() {
        try {
            // 确保配置目录存在
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            // 检查文件是否可写
            try {
                fs.accessSync(configDir, fs.constants.W_OK);
            } catch (accessError) {
                console.error('Config directory is not writable:', accessError);
                return false;
            }
            
            // 备份现有配置文件（如果存在）
            if (fs.existsSync(this.configPath)) {
                const backupPath = this.configPath + '.backup';
                fs.copyFileSync(this.configPath, backupPath);
            }
            
            // 写入新配置
            const configData = JSON.stringify(this.config, null, 2);
            fs.writeFileSync(this.configPath, configData, 'utf8');
            
            // 验证文件是否成功写入
            const verifyData = fs.readFileSync(this.configPath, 'utf8');
            if (verifyData !== configData) {
                console.error('Config file verification failed');
                return false;
            }
            
            console.log('Configuration saved successfully to:', this.configPath);
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    getConfig() {
        // 返回配置的深拷贝，避免外部修改影响内部状态
        return JSON.parse(JSON.stringify(this.config));
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.saveConfig();
    }
    
    // 获取实际的API密钥（不受掩码值影响）
    getActualApiKey() {
        return this.config.api.apiKey || '';
    }

    getDefaultConfig() {
        return {
            api: {
                baseUrl: "https://api.openai.com/v1",
                apiKey: "",
                model: "gpt-3.5-turbo",
                timeout: 30000
            },
            textOptimization: {
                wrapTags: ["<|text|>", "<|/text|>"],
                optimizationPrompt: "请优化以下文本，使其更加流畅易读，保持原意不变：",
                temperature: 0.7,
                maxTokens: 2000,
                useSeparateOptimizationApi: false,
                optimizationApi: {
                    baseUrl: "https://api.openai.com/v1",
                    apiKey: "",
                    model: "gpt-3.5-turbo",
                    timeout: 30000
                }
            },
            server: {
                port: 3000,
                enableCors: true
            },
            logging: {
                level: "info",
                enableConsole: true,
                enableFile: false,
                filePath: "./logs/app.log"
            },
            modelAliases: {}
        };
    }

    // 获取模型别名
    getModelAliases() {
        return this.config.modelAliases || {};
    }

    // 添加模型别名
    addModelAlias(customName, actualModel) {
        if (!this.config.modelAliases) {
            this.config.modelAliases = {};
        }
        this.config.modelAliases[customName] = actualModel;
        return this.saveConfig();
    }

    // 删除模型别名
    removeModelAlias(customName) {
        if (this.config.modelAliases && this.config.modelAliases[customName]) {
            delete this.config.modelAliases[customName];
            return this.saveConfig();
        }
        return false;
    }

    // 更新模型别名
    updateModelAlias(customName, actualModel) {
        if (this.config.modelAliases && this.config.modelAliases[customName]) {
            this.config.modelAliases[customName] = actualModel;
            return this.saveConfig();
        }
        return false;
    }

    // 获取实际模型名称
    getActualModelName(modelName) {
        if (this.config.modelAliases && this.config.modelAliases[modelName]) {
            return this.config.modelAliases[modelName];
        }
        return modelName;
    }

    // 验证配置
    validateConfig(config) {
        try {
            const validation = this.validateConfigDetailed(config);
            return validation.isValid;
        } catch (error) {
            console.error('Config validation error:', error);
            return false;
        }
    }

    // 详细的配置验证，返回详细结果
    validateConfigDetailed(config) {
        const errors = [];
        const warnings = [];
        
        // 检查必要的顶级配置
        if (!config || typeof config !== 'object') {
            errors.push('配置必须是一个对象');
            return { isValid: false, errors, warnings };
        }
        
        // 验证API配置
        if (!config.api || typeof config.api !== 'object') {
            errors.push('API配置缺失或格式错误');
        } else {
            const apiValidation = this.validateApiConfig(config.api);
            errors.push(...apiValidation.errors);
            warnings.push(...apiValidation.warnings);
        }
        
        // 验证文本优化配置
        if (!config.textOptimization || typeof config.textOptimization !== 'object') {
            errors.push('文本优化配置缺失或格式错误');
        } else {
            const textOptValidation = this.validateTextOptimizationConfig(config.textOptimization);
            errors.push(...textOptValidation.errors);
            warnings.push(...textOptValidation.warnings);
        }
        
        // 验证服务器配置
        if (!config.server || typeof config.server !== 'object') {
            errors.push('服务器配置缺失或格式错误');
        } else {
            const serverValidation = this.validateServerConfig(config.server);
            errors.push(...serverValidation.errors);
            warnings.push(...serverValidation.warnings);
        }
        
        // 验证日志配置
        if (!config.logging || typeof config.logging !== 'object') {
            errors.push('日志配置缺失或格式错误');
        } else {
            const loggingValidation = this.validateLoggingConfig(config.logging);
            errors.push(...loggingValidation.errors);
            warnings.push(...loggingValidation.warnings);
        }
        
        // 验证模型别名配置
        if (!config.modelAliases || typeof config.modelAliases !== 'object') {
            errors.push('模型别名配置缺失或格式错误');
        } else {
            const aliasesValidation = this.validateModelAliasesConfig(config.modelAliases);
            errors.push(...aliasesValidation.errors);
            warnings.push(...aliasesValidation.warnings);
        }
        
        // 验证配置项之间的一致性
        const consistencyValidation = this.validateConfigConsistency(config);
        errors.push(...consistencyValidation.errors);
        warnings.push(...consistencyValidation.warnings);
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            hasWarnings: warnings.length > 0
        };
    }

    // 验证API配置
    validateApiConfig(apiConfig) {
        const errors = [];
        const warnings = [];
        
        // 验证必要的API字段
        const requiredApiFields = ['baseUrl', 'apiKey', 'model', 'timeout'];
        for (const field of requiredApiFields) {
            if (!(field in apiConfig)) {
                errors.push(`缺少必需的API字段: ${field}`);
            }
        }
        
        // 验证baseUrl
        if (apiConfig.baseUrl) {
            if (typeof apiConfig.baseUrl !== 'string') {
                errors.push('API基础URL必须是字符串');
            } else if (!apiConfig.baseUrl.trim()) {
                errors.push('API基础URL不能为空');
            } else if (!apiConfig.baseUrl.startsWith('http://') && !apiConfig.baseUrl.startsWith('https://')) {
                errors.push('API基础URL必须以http://或https://开头');
            } else if (!this.isValidUrl(apiConfig.baseUrl)) {
                errors.push('API基础URL格式无效');
            } else if (apiConfig.baseUrl.includes('localhost') || apiConfig.baseUrl.includes('127.0.0.1')) {
                warnings.push('使用本地地址作为API基础URL可能影响生产环境使用');
            }
        }
        
        // 验证apiKey
        if (apiConfig.apiKey) {
            if (typeof apiConfig.apiKey !== 'string') {
                errors.push('API密钥必须是字符串');
            } else if (apiConfig.apiKey.trim() === '') {
                warnings.push('API密钥为空，将无法使用API功能');
            } else if (apiConfig.apiKey.length < 10) {
                warnings.push('API密钥长度较短，可能不是有效的密钥');
            } else if (apiConfig.apiKey === '******') {
                warnings.push('API密钥为掩码值，请确保实际密钥已正确配置');
            }
        }
        
        // 验证model
        if (apiConfig.model) {
            if (typeof apiConfig.model !== 'string') {
                errors.push('模型名称必须是字符串');
            } else if (!apiConfig.model.trim()) {
                errors.push('模型名称不能为空');
            } else if (!/^[a-zA-Z0-9\-_\.]+$/.test(apiConfig.model)) {
                warnings.push('模型名称包含特殊字符，请确认格式正确');
            }
        }
        
        // 验证timeout
        if (apiConfig.timeout !== undefined) {
            if (typeof apiConfig.timeout !== 'number') {
                errors.push('超时时间必须是数字');
            } else if (isNaN(apiConfig.timeout)) {
                errors.push('超时时间不能是NaN');
            } else if (apiConfig.timeout < 1000) {
                errors.push('超时时间必须大于等于1000毫秒');
            } else if (apiConfig.timeout > 300000) {
                warnings.push('超时时间较长（超过5分钟），可能导致请求响应缓慢');
            }
        }
        
        return { errors, warnings };
    }

    // 验证文本优化配置
    validateTextOptimizationConfig(textOptConfig) {
        const errors = [];
        const warnings = [];
        
        // 验证必要的文本优化字段
        const requiredTextFields = ['wrapTags', 'optimizationPrompt', 'temperature', 'maxTokens', 'useSeparateOptimizationApi'];
        for (const field of requiredTextFields) {
            if (!(field in textOptConfig)) {
                errors.push(`缺少必需的文本优化字段: ${field}`);
            }
        }
        
        // 验证wrapTags
        if (textOptConfig.wrapTags) {
            if (!Array.isArray(textOptConfig.wrapTags)) {
                errors.push('文本包装标签必须是数组');
            } else if (textOptConfig.wrapTags.length !== 2) {
                errors.push('文本包装标签数组必须包含2个元素');
            } else {
                textOptConfig.wrapTags.forEach((tag, index) => {
                    if (typeof tag !== 'string') {
                        errors.push(`文本包装标签[${index}]必须是字符串`);
                    } else if (!tag.trim()) {
                        errors.push(`文本包装标签[${index}]不能为空`);
                    }
                });
            }
        }
        
        // 验证optimizationPrompt
        if (textOptConfig.optimizationPrompt) {
            if (typeof textOptConfig.optimizationPrompt !== 'string') {
                errors.push('优化提示必须是字符串');
            } else if (!textOptConfig.optimizationPrompt.trim()) {
                warnings.push('优化提示为空，将使用默认优化逻辑');
            }
        }
        
        // 验证temperature
        if (textOptConfig.temperature !== undefined) {
            if (typeof textOptConfig.temperature !== 'number') {
                errors.push('温度参数必须是数字');
            } else if (isNaN(textOptConfig.temperature)) {
                errors.push('温度参数不能是NaN');
            } else if (textOptConfig.temperature < 0 || textOptConfig.temperature > 2) {
                errors.push('温度参数必须在0到2之间');
            }
        }
        
        // 验证maxTokens
        if (textOptConfig.maxTokens !== undefined) {
            if (typeof textOptConfig.maxTokens !== 'number') {
                errors.push('最大令牌数必须是数字');
            } else if (isNaN(textOptConfig.maxTokens)) {
                errors.push('最大令牌数不能是NaN');
            } else if (textOptConfig.maxTokens < 1 || textOptConfig.maxTokens > 100000) {
                errors.push('最大令牌数必须在1到100000之间');
            }
        }
        
        // 验证useSeparateOptimizationApi
        if (textOptConfig.useSeparateOptimizationApi !== undefined) {
            if (typeof textOptConfig.useSeparateOptimizationApi !== 'boolean') {
                errors.push('使用单独优化API标志必须是布尔值');
            } else if (textOptConfig.useSeparateOptimizationApi) {
                // 如果使用单独API，验证optimizationApi配置
                if (!textOptConfig.optimizationApi) {
                    errors.push('启用单独优化API时必须提供optimizationApi配置');
                } else {
                    const optApiValidation = this.validateApiConfig(textOptConfig.optimizationApi);
                    errors.push(...optApiValidation.errors.map(err => `优化API: ${err}`));
                    warnings.push(...optApiValidation.warnings.map(warn => `优化API: ${warn}`));
                }
            }
        }
        
        return { errors, warnings };
    }

    // 验证服务器配置
    validateServerConfig(serverConfig) {
        const errors = [];
        const warnings = [];
        
        // 验证port
        if (serverConfig.port !== undefined) {
            if (typeof serverConfig.port !== 'number') {
                errors.push('服务器端口必须是数字');
            } else if (isNaN(serverConfig.port)) {
                errors.push('服务器端口不能是NaN');
            } else if (serverConfig.port < 1 || serverConfig.port > 65535) {
                errors.push('服务器端口必须在1到65535之间');
            } else if (serverConfig.port < 1024) {
                warnings.push('使用特权端口（小于1024）可能需要管理员权限');
            } else if (serverConfig.port === 3000) {
                warnings.push('使用默认端口3000，请确保端口未被占用');
            }
        }
        
        // 验证enableCors
        if (serverConfig.enableCors !== undefined) {
            if (typeof serverConfig.enableCors !== 'boolean') {
                errors.push('CORS启用标志必须是布尔值');
            }
        }
        
        return { errors, warnings };
    }

    // 验证日志配置
    validateLoggingConfig(loggingConfig) {
        const errors = [];
        const warnings = [];
        
        // 验证level
        if (loggingConfig.level) {
            const validLevels = ['error', 'warn', 'info', 'debug'];
            if (typeof loggingConfig.level !== 'string') {
                errors.push('日志级别必须是字符串');
            } else if (!validLevels.includes(loggingConfig.level)) {
                errors.push(`日志级别必须是以下之一: ${validLevels.join(', ')}`);
            }
        }
        
        // 验证enableConsole
        if (loggingConfig.enableConsole !== undefined) {
            if (typeof loggingConfig.enableConsole !== 'boolean') {
                errors.push('控制台日志启用标志必须是布尔值');
            }
        }
        
        // 验证enableFile
        if (loggingConfig.enableFile !== undefined) {
            if (typeof loggingConfig.enableFile !== 'boolean') {
                errors.push('文件日志启用标志必须是布尔值');
            } else if (loggingConfig.enableFile && !loggingConfig.filePath) {
                errors.push('启用文件日志时必须提供文件路径');
            }
        }
        
        // 验证filePath
        if (loggingConfig.filePath) {
            if (typeof loggingConfig.filePath !== 'string') {
                errors.push('日志文件路径必须是字符串');
            } else if (!loggingConfig.filePath.trim()) {
                errors.push('日志文件路径不能为空');
            } else if (!loggingConfig.filePath.endsWith('.log')) {
                warnings.push('日志文件路径建议以.log结尾');
            }
        }
        
        return { errors, warnings };
    }

    // 验证模型别名配置
    validateModelAliasesConfig(aliasesConfig) {
        const errors = [];
        const warnings = [];
        
        if (typeof aliasesConfig !== 'object') {
            errors.push('模型别名配置必须是对象');
            return { errors, warnings };
        }
        
        for (const [customName, actualModel] of Object.entries(aliasesConfig)) {
            if (typeof customName !== 'string' || !customName.trim()) {
                errors.push(`模型别名名称无效: ${customName}`);
            }
            
            if (typeof actualModel !== 'string' || !actualModel.trim()) {
                errors.push(`模型别名"${customName}"对应的实际模型无效: ${actualModel}`);
            }
            
            if (customName === actualModel) {
                warnings.push(`模型别名"${customName}"与实际模型相同，可能造成混淆`);
            }
            
            if (customName.includes(' ') || actualModel.includes(' ')) {
                warnings.push(`模型别名"${customName}"或实际模型"${actualModel}"包含空格，可能导致问题`);
            }
        }
        
        return { errors, warnings };
    }

    // 验证配置项之间的一致性
    validateConfigConsistency(config) {
        const errors = [];
        const warnings = [];
        
        // 检查API和优化API配置的一致性
        if (config.textOptimization && config.textOptimization.useSeparateOptimizationApi) {
            if (config.textOptimization.optimizationApi) {
                if (config.textOptimization.optimizationApi.baseUrl === config.api.baseUrl) {
                    warnings.push('优化API与主API使用相同的URL，考虑是否需要单独配置');
                }
                
                if (config.textOptimization.optimizationApi.apiKey === config.api.apiKey) {
                    warnings.push('优化API与主API使用相同的密钥，考虑是否需要单独配置');
                }
            }
        }
        
        // 检查模型别名的一致性
        if (config.modelAliases && config.api.model) {
            if (config.modelAliases[config.api.model]) {
                warnings.push(`默认模型"${config.api.model}"也被定义为别名，可能造成混淆`);
            }
        }
        
        // 检查超时设置的一致性
        if (config.api.timeout && config.textOptimization && config.textOptimization.optimizationApi) {
            if (config.textOptimization.optimizationApi.timeout > config.api.timeout * 2) {
                warnings.push('优化API超时时间远大于主API超时时间，可能影响用户体验');
            }
        }
        
        return { errors, warnings };
    }

    // 验证URL格式
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // 获取配置健康状态
    getConfigHealth() {
        const config = this.getConfig();
        const validation = this.validateConfigDetailed(config);
        
        const health = {
            status: validation.isValid ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            validation: validation,
            summary: {
                totalErrors: validation.errors.length,
                totalWarnings: validation.warnings.length,
                criticalIssues: validation.errors.filter(e => e.includes('必需') || e.includes('必须')).length
            },
            recommendations: this.generateConfigRecommendations(validation)
        };
        
        return health;
    }

    // 生成配置建议
    generateConfigRecommendations(validation) {
        const recommendations = [];
        
        if (validation.errors.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'errors',
                message: '存在配置错误，请修复后重新启动应用',
                items: validation.errors
            });
        }
        
        if (validation.warnings.length > 0) {
            recommendations.push({
                priority: 'medium',
                category: 'warnings',
                message: '存在配置警告，建议优化以提高系统稳定性',
                items: validation.warnings
            });
        }
        
        // 基于特定错误类型提供建议
        const hasApiKeyIssues = validation.errors.some(e => e.includes('API密钥')) ||
                               validation.warnings.some(w => w.includes('API密钥'));
        if (hasApiKeyIssues) {
            recommendations.push({
                priority: 'high',
                category: 'api_key',
                message: 'API密钥配置问题',
                items: [
                    '检查API密钥是否正确复制',
                    '确认API密钥是否已激活',
                    '验证API密钥是否有足够权限'
                ]
            });
        }
        
        const hasNetworkIssues = validation.errors.some(e => e.includes('URL') || e.includes('baseUrl'));
        if (hasNetworkIssues) {
            recommendations.push({
                priority: 'high',
                category: 'network',
                message: '网络配置问题',
                items: [
                    '检查API服务器地址是否正确',
                    '确认网络连接是否正常',
                    '验证防火墙设置'
                ]
            });
        }
        
        return recommendations;
    }

    // 获取所有模型名称（包括别名和实际模型）
    getAllModelNames() {
        const aliases = this.getModelAliases();
        const actualModels = Object.values(aliases);
        const allModels = new Set([...Object.keys(aliases), ...actualModels]);
        return Array.from(allModels);
    }
}

module.exports = new ConfigManager();