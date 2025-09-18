const express = require('express');
const router = express.Router();
const configManager = require('../config/configManager');
const textOptimizer = require('../services/textOptimizer');
const llmClient = require('../services/llmClient');
const logger = require('../services/logger');

// 获取配置
router.get('/config', (req, res) => {
    try {
        const config = configManager.getConfig();
        logger.debug('Config requested, current config:', {
            hasApiKey: !!config.api?.apiKey,
            apiKeyLength: config.api?.apiKey?.length || 0,
            baseUrl: config.api?.baseUrl,
            model: config.api?.model
        });
        
        // 检查是否有API密钥
        const hasApiKey = config.api.apiKey && config.api.apiKey.trim() !== '';
        
        // 不返回API密钥等敏感信息，但提供是否有密钥的指示
        const safeConfig = {
            ...config,
            api: {
                ...config.api,
                apiKey: hasApiKey ? '******' : ''
            }
        };
        
        // 处理文本优化API的掩码值
        if (safeConfig.textOptimization && safeConfig.textOptimization.optimizationApi) {
            const hasOptimizationApiKey = safeConfig.textOptimization.optimizationApi.apiKey &&
                                        safeConfig.textOptimization.optimizationApi.apiKey.trim() !== '';
            safeConfig.textOptimization.optimizationApi.apiKey = hasOptimizationApiKey ? '******' : '';
        }
        
        logger.info('Configuration retrieved successfully', { hasApiKey });
        res.json(safeConfig);
    } catch (error) {
        logger.error('Error getting config:', error);
        res.status(500).json({ error: 'Failed to get configuration' });
    }
});

// 检查API密钥状态
router.get('/config/api-key-status', (req, res) => {
    try {
        const config = configManager.getConfig();
        const hasApiKey = config.api.apiKey && config.api.apiKey.trim() !== '';
        
        logger.info('API key status checked', { hasApiKey });
        res.json({
            hasApiKey,
            message: hasApiKey ? 'API密钥已配置' : 'API密钥未配置'
        });
    } catch (error) {
        logger.error('Error checking API key status:', error);
        res.status(500).json({ error: 'Failed to check API key status' });
    }
});

// 获取模型别名
router.get('/model-aliases', (req, res) => {
    try {
        const modelAliases = configManager.getModelAliases();
        res.json(modelAliases);
    } catch (error) {
        logger.error('Error getting model aliases:', error);
        res.status(500).json({ error: 'Failed to get model aliases' });
    }
});

// 添加模型别名
router.post('/model-aliases', (req, res) => {
    try {
        const { customName, actualModel } = req.body;
        
        if (!customName || !actualModel) {
            return res.status(400).json({ error: 'Custom name and actual model are required' });
        }
        
        const success = configManager.addModelAlias(customName, actualModel);
        
        if (success) {
            res.json({ success: true, message: 'Model alias added successfully' });
        } else {
            res.status(500).json({ error: 'Failed to add model alias' });
        }
    } catch (error) {
        logger.error('Error adding model alias:', error);
        res.status(500).json({ error: 'Failed to add model alias' });
    }
});

// 更新模型别名
router.put('/model-aliases/:customName', (req, res) => {
    try {
        const { customName } = req.params;
        const { actualModel } = req.body;
        
        if (!actualModel) {
            return res.status(400).json({ error: 'Actual model is required' });
        }
        
        const success = configManager.updateModelAlias(customName, actualModel);
        
        if (success) {
            res.json({ success: true, message: 'Model alias updated successfully' });
        } else {
            res.status(404).json({ error: 'Model alias not found' });
        }
    } catch (error) {
        logger.error('Error updating model alias:', error);
        res.status(500).json({ error: 'Failed to update model alias' });
    }
});

// 删除模型别名
router.delete('/model-aliases/:customName', (req, res) => {
    try {
        const { customName } = req.params;
        
        const success = configManager.removeModelAlias(customName);
        
        if (success) {
            res.json({ success: true, message: 'Model alias deleted successfully' });
        } else {
            res.status(404).json({ error: 'Model alias not found' });
        }
    } catch (error) {
        logger.error('Error deleting model alias:', error);
        res.status(500).json({ error: 'Failed to delete model alias' });
    }
});

// 保存配置
router.post('/config', (req, res) => {
    try {
        const newConfig = req.body;
        
        // 记录请求体用于调试
        logger.debug('Config save request received:', {
            hasApiKey: !!newConfig.api?.apiKey,
            apiKeyLength: newConfig.api?.apiKey?.length || 0,
            baseUrl: newConfig.api?.baseUrl,
            model: newConfig.api?.model
        });
        
        // 验证请求数据
        if (!newConfig || typeof newConfig !== 'object') {
            logger.error('Invalid config data received:', newConfig);
            return res.status(400).json({ error: 'Invalid configuration data' });
        }
        
        // 验证必要的配置字段
        if (!newConfig.api || !newConfig.api.baseUrl || !newConfig.api.model) {
            logger.error('Missing required API configuration fields:', newConfig);
            return res.status(400).json({ error: 'Missing required API configuration fields' });
        }
        
        // 验证API密钥
        if (!newConfig.api.apiKey || newConfig.api.apiKey.trim() === '') {
            logger.warn('Empty API key received, but allowing save as user might be testing');
        } else if (newConfig.api.apiKey === '******') {
            // 如果是掩码值，保持原有的API密钥不变
            const currentConfig = configManager.getConfig();
            if (currentConfig.api && currentConfig.api.apiKey && currentConfig.api.apiKey !== '******') {
                newConfig.api.apiKey = currentConfig.api.apiKey;
                logger.info('Masked API key detected, preserving existing key');
            }
        }
        
        // 处理文本优化API的掩码值
        if (newConfig.textOptimization && newConfig.textOptimization.optimizationApi) {
            if (newConfig.textOptimization.optimizationApi.apiKey === '******') {
                const currentConfig = configManager.getConfig();
                if (currentConfig.textOptimization &&
                    currentConfig.textOptimization.optimizationApi &&
                    currentConfig.textOptimization.optimizationApi.apiKey &&
                    currentConfig.textOptimization.optimizationApi.apiKey !== '******') {
                    newConfig.textOptimization.optimizationApi.apiKey = currentConfig.textOptimization.optimizationApi.apiKey;
                    logger.info('Masked optimization API key detected, preserving existing key');
                }
            }
        }
        
        // 验证配置格式
        if (!configManager.validateConfig(newConfig)) {
            logger.error('Config validation failed:', newConfig);
            return res.status(400).json({ error: 'Invalid configuration format' });
        }
        
        const success = configManager.updateConfig(newConfig);
        
        if (success) {
            logger.info('Configuration saved successfully');
            res.json({ success: true, message: 'Configuration saved successfully' });
        } else {
            logger.error('Failed to save configuration');
            res.status(500).json({ error: 'Failed to save configuration' });
        }
    } catch (error) {
        logger.error('Error saving config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// 获取模型列表
router.get('/models', async (req, res) => {
    try {
        const config = configManager.getConfig();
        
        // 创建API配置的副本，确保使用实际的API密钥
        let apiKey = config.api.apiKey;
        
        // 如果API密钥是掩码值，从内存中获取实际值
        if (apiKey === '******') {
            // 使用getActualApiKey方法获取实际API密钥
            apiKey = configManager.getActualApiKey();
            
            logger.info('Using actual API key from memory for masked value', {
                hasApiKey: !!apiKey,
                apiKeyLength: apiKey ? apiKey.length : 0
            });
        }
        
        const apiConfig = {
            ...config.api,
            apiKey: apiKey
        };
        
        // 验证API密钥是否有效
        if (!apiConfig.apiKey || apiConfig.apiKey.trim() === '') {
            logger.error('Invalid API key when trying to get models');
            return res.status(400).json({
                error: '无效的API密钥',
                message: '请配置有效的API密钥以获取模型列表',
                suggestions: [
                    '检查API密钥是否正确配置',
                    '确认API密钥是否已激活',
                    '验证API密钥是否有足够权限'
                ]
            });
        }
        
        logger.info('Getting models with API config', {
            baseUrl: apiConfig.baseUrl,
            model: apiConfig.model,
            hasApiKey: !!apiConfig.apiKey,
            apiKeyLength: apiConfig.apiKey.length
        });
        
        const models = await llmClient.getModels(apiConfig);
        res.json(models);
    } catch (error) {
        logger.error('Error getting models:', error);
        res.status(500).json({
            error: 'Failed to get models',
            message: error.message,
            suggestions: [
                '检查API密钥是否正确',
                '确认API服务器地址是否正确',
                '验证网络连接是否正常',
                '查看日志获取详细信息'
            ]
        });
    }
});

// 获取模型列表（POST方法，支持自定义API配置）
router.post('/models', async (req, res) => {
    try {
        const { baseUrl, apiKey, model, timeout } = req.body;
        const apiConfig = {
            baseUrl,
            apiKey,
            model,
            timeout: timeout || 10000
        };
        
        const models = await llmClient.getModels(apiConfig);
        res.json(models);
    } catch (error) {
        logger.error('Error getting models with custom config:', error);
        res.status(500).json({ error: 'Failed to get models' });
    }
});

// 测试连接
router.post('/test-connection', async (req, res) => {
    try {
        const { baseUrl, apiKey, model } = req.body;
        const testConfig = {
            baseUrl,
            apiKey,
            model,
            timeout: 10000
        };
        
        logger.info('Starting connection test', {
            baseUrl,
            model,
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey ? apiKey.length : 0
        });
        
        const connectionResult = await llmClient.testConnection(testConfig);
        res.json(connectionResult);
    } catch (error) {
        logger.error('Error testing connection:', {
            error: error.message,
            stack: error.stack,
            config: {
                baseUrl: req.body.baseUrl,
                model: req.body.model,
                hasApiKey: !!req.body.apiKey
            }
        });
        res.status(500).json({
            error: 'Failed to test connection',
            message: error.message,
            suggestions: ['请检查网络连接', '确认API配置是否正确', '查看日志获取详细信息']
        });
    }
});

// 获取详细的连接诊断信息
router.post('/diagnostics', async (req, res) => {
    try {
        const { baseUrl, apiKey, model, timeout } = req.body;
        const diagnosticConfig = {
            baseUrl,
            apiKey,
            model,
            timeout: timeout || 10000
        };
        
        logger.info('Starting diagnostics test', {
            baseUrl,
            model,
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey ? apiKey.length : 0,
            timeout
        });
        
        const diagnostics = await llmClient.getDiagnostics(diagnosticConfig);
        res.json(diagnostics);
    } catch (error) {
        logger.error('Error running diagnostics:', {
            error: error.message,
            stack: error.stack,
            config: {
                baseUrl: req.body.baseUrl,
                model: req.body.model,
                hasApiKey: !!req.body.apiKey,
                timeout: req.body.timeout
            }
        });
        res.status(500).json({
            error: 'Failed to run diagnostics',
            message: error.message,
            suggestions: ['请检查网络连接', '确认API配置是否正确', '查看日志获取详细信息']
        });
    }
});

// 验证API配置
router.post('/validate-config', async (req, res) => {
    try {
        const { baseUrl, apiKey, model, timeout } = req.body;
        const configToValidate = {
            baseUrl,
            apiKey,
            model,
            timeout: timeout || 10000
        };
        
        logger.info('Validating API configuration', {
            baseUrl,
            model,
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey ? apiKey.length : 0,
            timeout
        });
        
        const validation = llmClient.validateApiConfig(configToValidate);
        
        logger.info('Configuration validation result', {
            isValid: validation.isValid,
            errors: validation.errors
        });
        
        res.json(validation);
    } catch (error) {
        logger.error('Error validating configuration:', {
            error: error.message,
            stack: error.stack,
            config: {
                baseUrl: req.body.baseUrl,
                model: req.body.model,
                hasApiKey: !!req.body.apiKey,
                timeout: req.body.timeout
            }
        });
        res.status(500).json({
            error: 'Failed to validate configuration',
            message: error.message,
            suggestions: ['请检查配置格式', '确认所有必填字段已填写', '查看日志获取详细信息']
        });
    }
});

// 文本优化
router.post('/optimize', async (req, res) => {
    try {
        const { text, tags, prompt } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        
        const config = configManager.getConfig();
        const optimizationConfig = {
            ...config.textOptimization,
            wrapTags: tags || config.textOptimization.wrapTags,
            optimizationPrompt: prompt || config.textOptimization.optimizationPrompt
        };
        
        // 处理优化API的掩码值
        if (optimizationConfig.useSeparateOptimizationApi && optimizationConfig.optimizationApi) {
            if (optimizationConfig.optimizationApi.apiKey === '******') {
                // 如果是掩码值，使用实际值
                optimizationConfig.optimizationApi.apiKey = config.textOptimization.optimizationApi.apiKey;
            }
        }
        
        const result = await textOptimizer.optimizeText(text, optimizationConfig, config.api);
        res.json(result);
    } catch (error) {
        logger.error('Error optimizing text:', error);
        res.status(500).json({ error: 'Failed to optimize text' });
    }
});

// 获取日志
router.get('/logs', (req, res) => {
    try {
        const logs = logger.getLogs();
        res.json(logs);
    } catch (error) {
        logger.error('Error getting logs:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

module.exports = router;