const express = require('express');
const router = express.Router();
const axios = require('axios');
const configManager = require('../config/configManager');
const textOptimizer = require('../services/textOptimizer');
const logger = require('../services/logger');

// 代理端点 - 兼容OpenAI API格式
router.post('/v1/chat/completions', async (req, res) => {
    try {
        const config = configManager.getConfig();
        const { messages, stream, model, temperature, max_tokens, ...otherParams } = req.body;
        
        // 记录请求
        logger.info(`Proxy request received - Model: ${model}, Stream: ${stream}`);
        
        // 将自定义模型名称映射为实际模型名称
        const actualModel = configManager.getActualModelName(model);
        logger.info(`Model mapping: ${model} -> ${actualModel}`);
        
        // 如果是流式请求，直接转发
        if (stream) {
            // 更新请求体中的模型名称
            req.body.model = actualModel;
            return await handleStreamingRequest(req, res, config);
        }
        
        // 转发请求到目标API（使用实际模型名称）
        const response = await forwardRequest({
            messages,
            model: actualModel,
            temperature,
            max_tokens,
            ...otherParams
        }, config.api);
        
        // 从LLM生成的回复文本中提取需要优化的内容
        const optimizedResponse = await textOptimizer.optimizeResponse(
            response.data,
            config.textOptimization,
            config.api
        );
        
        // 返回优化后的回复
        res.json(optimizedResponse);
    } catch (error) {
        logger.error('Error in proxy endpoint:', error);
        res.status(500).json({ error: 'Proxy request failed' });
    }
});

// 处理流式请求
async function handleStreamingRequest(req, res, config) {
    try {
        const response = await axios({
            method: 'post',
            url: `${config.api.baseUrl}/chat/completions`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.api.apiKey}`
            },
            data: req.body,
            responseType: 'stream'
        });
        
        // 设置响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // 转发流式响应
        response.data.pipe(res);
    } catch (error) {
        logger.error('Error in streaming request:', error);
        res.status(500).json({ error: 'Streaming request failed' });
    }
}

// 转发请求到目标API
async function forwardRequest(data, apiConfig) {
    return await axios({
        method: 'post',
        url: `${apiConfig.baseUrl}/chat/completions`,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`
        },
        data: data,
        timeout: apiConfig.timeout
    });
}

// 模型列表端点
router.get('/v1/models', async (req, res) => {
    try {
        const config = configManager.getConfig();
        const response = await axios({
            method: 'get',
            url: `${config.api.baseUrl}/models`,
            headers: {
                'Authorization': `Bearer ${config.api.apiKey}`
            }
        });
        
        // 获取原始模型列表
        const originalModels = response.data.data || [];
        
        // 获取模型别名
        const modelAliases = configManager.getModelAliases();
        
        // 创建包含原始模型和自定义模型的列表
        const allModels = [...originalModels];
        
        // 添加自定义模型到列表
        Object.keys(modelAliases).forEach(customName => {
            // 检查是否已经存在相同ID的模型
            const existingModel = allModels.find(model => model.id === customName);
            if (!existingModel) {
                allModels.push({
                    id: customName,
                    object: 'model',
                    created: Math.floor(Date.now() / 1000),
                    owned_by: 'custom'
                });
            }
        });
        
        // 返回更新后的模型列表
        res.json({
            ...response.data,
            data: allModels
        });
    } catch (error) {
        logger.error('Error getting models:', error);
        res.status(500).json({ error: 'Failed to get models' });
    }
});

module.exports = router;