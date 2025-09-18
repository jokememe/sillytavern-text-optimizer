const axios = require('axios');
const logger = require('./logger');

class LLMClient {
    constructor() {
        this.defaultTimeout = 30000;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    // 分类错误类型
    classifyError(error) {
        if (!error.response) {
            // 网络错误或请求未到达服务器
            if (error.code === 'ECONNREFUSED') {
                return { type: 'network', category: 'connection_refused', message: '无法连接到API服务器，请检查网络连接和服务器状态' };
            } else if (error.code === 'ETIMEDOUT') {
                return { type: 'network', category: 'timeout', message: '请求超时，请检查网络连接或增加超时时间' };
            } else if (error.code === 'ENOTFOUND') {
                return { type: 'network', category: 'dns_error', message: '无法解析API服务器地址，请检查URL是否正确' };
            } else {
                return { type: 'network', category: 'unknown_network', message: '网络错误，请检查网络连接' };
            }
        }

        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 401) {
            return { type: 'auth', category: 'invalid_token', message: 'API密钥无效或已过期，请检查API密钥配置' };
        } else if (status === 403) {
            return { type: 'auth', category: 'forbidden', message: '访问被拒绝，请检查API密钥权限' };
        } else if (status === 429) {
            return { type: 'rate_limit', category: 'too_many_requests', message: '请求过于频繁，请稍后再试' };
        } else if (status >= 500) {
            return { type: 'server', category: 'server_error', message: 'API服务器错误，请稍后再试' };
        } else if (status >= 400) {
            return { type: 'client', category: 'bad_request', message: '请求格式错误，请检查配置参数' };
        } else {
            return { type: 'unknown', category: 'unknown_error', message: '未知错误' };
        }
    }

    // 重试机制
    async retryWithBackoff(fn, maxRetries = this.maxRetries) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                const errorClassification = this.classifyError(error);
                
                // 对于某些错误类型不进行重试
                if (errorClassification.type === 'auth' || errorClassification.type === 'client') {
                    throw error;
                }
                
                logger.warn(`Attempt ${attempt} failed: ${errorClassification.message}`, {
                    attempt,
                    maxRetries,
                    errorType: errorClassification.type,
                    errorCategory: errorClassification.category
                });
                
                if (attempt < maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1); // 指数退避
                    logger.info(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    // 调用LLM API
    async callLLM(data, apiConfig) {
        return this.retryWithBackoff(async () => {
            try {
                const response = await axios({
                    method: 'post',
                    url: `${apiConfig.baseUrl}/chat/completions`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiConfig.apiKey}`
                    },
                    data: {
                        model: data.model || apiConfig.model,
                        messages: data.messages,
                        temperature: data.temperature || 0.7,
                        max_tokens: data.max_tokens || 2000,
                        stream: data.stream || false
                    },
                    timeout: apiConfig.timeout || this.defaultTimeout
                });
                
                logger.info(`LLM API call successful - Model: ${data.model || apiConfig.model}`, {
                    model: data.model || apiConfig.model,
                    responseTime: response.headers['x-response-time'] || 'N/A'
                });
                return response.data;
            } catch (error) {
                const errorClassification = this.classifyError(error);
                
                logger.error('LLM API call failed:', {
                    error: error.response?.data || error.message,
                    errorType: errorClassification.type,
                    errorCategory: errorClassification.category,
                    userMessage: errorClassification.message,
                    status: error.response?.status,
                    headers: error.response?.headers,
                    config: {
                        baseUrl: apiConfig.baseUrl,
                        model: data.model || apiConfig.model,
                        timeout: apiConfig.timeout || this.defaultTimeout
                    }
                });
                
                throw new Error(`${errorClassification.message} (${errorClassification.type}:${errorClassification.category})`);
            }
        });
    }

    // 获取模型列表
    async getModels(apiConfig) {
        return this.retryWithBackoff(async () => {
            try {
                const response = await axios({
                    method: 'get',
                    url: `${apiConfig.baseUrl}/models`,
                    headers: {
                        'Authorization': `Bearer ${apiConfig.apiKey}`
                    },
                    timeout: 10000
                });
                
                logger.info('Models retrieved successfully', {
                    modelCount: response.data.data?.length || 0,
                    responseTime: response.headers['x-response-time'] || 'N/A'
                });
                return response.data;
            } catch (error) {
                const errorClassification = this.classifyError(error);
                
                logger.error('Failed to get models:', {
                    error: error.response?.data || error.message,
                    errorType: errorClassification.type,
                    errorCategory: errorClassification.category,
                    userMessage: errorClassification.message,
                    status: error.response?.status,
                    headers: error.response?.headers,
                    config: {
                        baseUrl: apiConfig.baseUrl,
                        timeout: 10000
                    }
                });
                
                throw new Error(`${errorClassification.message} (${errorClassification.type}:${errorClassification.category})`);
            }
        });
    }

    // 测试连接
    async testConnection(apiConfig) {
        try {
            // 尝试获取模型列表来测试连接
            await this.getModels(apiConfig);
            logger.info('Connection test successful', {
                baseUrl: apiConfig.baseUrl,
                model: apiConfig.model
            });
            return { success: true, message: '连接测试成功' };
        } catch (error) {
            const errorClassification = this.classifyError(error);
            
            logger.error('Connection test failed:', {
                error: error.response?.data || error.message,
                errorType: errorClassification.type,
                errorCategory: errorClassification.category,
                userMessage: errorClassification.message,
                config: {
                    baseUrl: apiConfig.baseUrl,
                    model: apiConfig.model
                }
            });
            
            return {
                success: false,
                message: errorClassification.message,
                errorType: errorClassification.type,
                errorCategory: errorClassification.category,
                suggestions: this.getErrorSuggestions(errorClassification)
            };
        }
    }

    // 获取错误解决建议
    getErrorSuggestions(errorClassification) {
        const suggestions = [];
        
        switch (errorClassification.type) {
            case 'auth':
                suggestions.push('检查API密钥是否正确');
                suggestions.push('确认API密钥是否已过期');
                suggestions.push('验证API密钥是否有足够权限');
                break;
            case 'network':
                suggestions.push('检查网络连接是否正常');
                suggestions.push('确认API服务器地址是否正确');
                suggestions.push('检查防火墙设置');
                break;
            case 'rate_limit':
                suggestions.push('减少请求频率');
                suggestions.push('等待一段时间后再试');
                suggestions.push('考虑升级API计划');
                break;
            case 'server':
                suggestions.push('等待API服务器恢复');
                suggestions.push('查看API服务状态页面');
                suggestions.push('联系API服务提供商');
                break;
            case 'client':
                suggestions.push('检查请求参数是否正确');
                suggestions.push('确认API端点URL是否正确');
                suggestions.push('验证请求数据格式');
                break;
            default:
                suggestions.push('检查所有配置参数');
                suggestions.push('查看详细日志信息');
                suggestions.push('联系技术支持');
        }
        
        return suggestions;
    }

    // 流式调用LLM
    async streamLLM(data, apiConfig) {
        return this.retryWithBackoff(async () => {
            try {
                const response = await axios({
                    method: 'post',
                    url: `${apiConfig.baseUrl}/chat/completions`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiConfig.apiKey}`
                    },
                    data: {
                        model: data.model || apiConfig.model,
                        messages: data.messages,
                        temperature: data.temperature || 0.7,
                        max_tokens: data.max_tokens || 2000,
                        stream: true
                    },
                    responseType: 'stream',
                    timeout: apiConfig.timeout || this.defaultTimeout
                });
                
                logger.info(`Streaming LLM API call started - Model: ${data.model || apiConfig.model}`, {
                    model: data.model || apiConfig.model,
                    responseTime: response.headers['x-response-time'] || 'N/A'
                });
                return response.data;
            } catch (error) {
                const errorClassification = this.classifyError(error);
                
                logger.error('Streaming LLM API call failed:', {
                    error: error.response?.data || error.message,
                    errorType: errorClassification.type,
                    errorCategory: errorClassification.category,
                    userMessage: errorClassification.message,
                    status: error.response?.status,
                    headers: error.response?.headers,
                    config: {
                        baseUrl: apiConfig.baseUrl,
                        model: data.model || apiConfig.model,
                        timeout: apiConfig.timeout || this.defaultTimeout
                    }
                });
                
                throw new Error(`${errorClassification.message} (${errorClassification.type}:${errorClassification.category})`);
            }
        });
    }

    // 获取模型信息
    async getModelInfo(modelName, apiConfig) {
        try {
            const models = await this.getModels(apiConfig);
            const model = models.data.find(m => m.id === modelName);
            
            if (!model) {
                const error = new Error(`Model ${modelName} not found`);
                const errorClassification = this.classifyError(error);
                logger.error(`Failed to get model info for ${modelName}:`, {
                    error: error.message,
                    errorType: errorClassification.type,
                    errorCategory: errorClassification.category,
                    modelName,
                    availableModels: models.data.map(m => m.id)
                });
                throw error;
            }
            
            logger.info(`Model info retrieved successfully for ${modelName}`, {
                modelName,
                modelInfo: {
                    id: model.id,
                    owned_by: model.owned_by,
                    created: model.created
                }
            });
            
            return model;
        } catch (error) {
            const errorClassification = this.classifyError(error);
            logger.error(`Failed to get model info for ${modelName}:`, {
                error: error.response?.data || error.message,
                errorType: errorClassification.type,
                errorCategory: errorClassification.category,
                userMessage: errorClassification.message,
                modelName
            });
            throw error;
        }
    }

    // 检查模型是否可用
    async isModelAvailable(modelName, apiConfig) {
        try {
            const models = await this.getModels(apiConfig);
            const isAvailable = models.data.some(m => m.id === modelName);
            
            logger.info(`Model availability check for ${modelName}: ${isAvailable}`, {
                modelName,
                isAvailable,
                availableModels: models.data.map(m => m.id)
            });
            
            return isAvailable;
        } catch (error) {
            const errorClassification = this.classifyError(error);
            logger.error(`Failed to check model availability for ${modelName}:`, {
                error: error.response?.data || error.message,
                errorType: errorClassification.type,
                errorCategory: errorClassification.category,
                userMessage: errorClassification.message,
                modelName
            });
            return false;
        }
    }

    // 验证API配置
    validateApiConfig(apiConfig) {
        const errors = [];
        
        if (!apiConfig.baseUrl) {
            errors.push('API基础URL不能为空');
        } else if (!apiConfig.baseUrl.startsWith('http://') && !apiConfig.baseUrl.startsWith('https://')) {
            errors.push('API基础URL必须以http://或https://开头');
        }
        
        if (!apiConfig.apiKey) {
            errors.push('API密钥不能为空');
        } else if (apiConfig.apiKey.length < 10) {
            errors.push('API密钥长度不能少于10个字符');
        }
        
        if (!apiConfig.model) {
            errors.push('模型名称不能为空');
        }
        
        if (apiConfig.timeout && (isNaN(apiConfig.timeout) || apiConfig.timeout < 1000)) {
            errors.push('超时时间必须大于等于1000毫秒');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // 获取详细的连接诊断信息
    async getDiagnostics(apiConfig) {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            config: {
                baseUrl: apiConfig.baseUrl,
                hasApiKey: !!apiConfig.apiKey,
                apiKeyLength: apiConfig.apiKey ? apiConfig.apiKey.length : 0,
                model: apiConfig.model,
                timeout: apiConfig.timeout || this.defaultTimeout
            },
            tests: {},
            overall: {
                status: 'unknown',
                message: '诊断进行中...'
            }
        };

        // 验证配置
        const configValidation = this.validateApiConfig(apiConfig);
        diagnostics.tests.config = {
            status: configValidation.isValid ? 'passed' : 'failed',
            errors: configValidation.errors
        };

        if (!configValidation.isValid) {
            diagnostics.overall.status = 'failed';
            diagnostics.overall.message = '配置验证失败';
            return diagnostics;
        }

        // 测试网络连接
        try {
            const baseUrl = new URL(apiConfig.baseUrl);
            const connectivityTest = await this.testNetworkConnectivity(baseUrl.origin);
            diagnostics.tests.network = connectivityTest;
        } catch (error) {
            diagnostics.tests.network = {
                status: 'failed',
                error: '无效的URL格式',
                message: error.message
            };
        }

        // 测试API认证
        try {
            const authTest = await this.testApiAuthentication(apiConfig);
            diagnostics.tests.authentication = authTest;
        } catch (error) {
            diagnostics.tests.authentication = {
                status: 'failed',
                error: '认证测试失败',
                message: error.message
            };
        }

        // 测试模型列表获取
        try {
            const modelsTest = await this.testModelsEndpoint(apiConfig);
            diagnostics.tests.models = modelsTest;
        } catch (error) {
            diagnostics.tests.models = {
                status: 'failed',
                error: '模型列表测试失败',
                message: error.message
            };
        }

        // 确定整体状态
        const testResults = Object.values(diagnostics.tests);
        const passedTests = testResults.filter(test => test.status === 'passed').length;
        const totalTests = testResults.length;

        if (passedTests === totalTests) {
            diagnostics.overall.status = 'passed';
            diagnostics.overall.message = '所有测试通过';
        } else if (passedTests > 0) {
            diagnostics.overall.status = 'partial';
            diagnostics.overall.message = `部分测试通过 (${passedTests}/${totalTests})`;
        } else {
            diagnostics.overall.status = 'failed';
            diagnostics.overall.message = '所有测试失败';
        }

        return diagnostics;
    }

    // 测试网络连接
    async testNetworkConnectivity(baseUrl) {
        try {
            const response = await axios({
                method: 'head',
                url: baseUrl,
                timeout: 5000
            });
            
            return {
                status: 'passed',
                message: '网络连接正常',
                responseTime: response.headers['x-response-time'] || 'N/A',
                statusCode: response.status
            };
        } catch (error) {
            const errorClassification = this.classifyError(error);
            return {
                status: 'failed',
                message: errorClassification.message,
                errorType: errorClassification.type,
                errorCategory: errorClassification.category,
                suggestions: this.getErrorSuggestions(errorClassification)
            };
        }
    }

    // 测试API认证
    async testApiAuthentication(apiConfig) {
        try {
            const response = await axios({
                method: 'get',
                url: `${apiConfig.baseUrl}/models`,
                headers: {
                    'Authorization': `Bearer ${apiConfig.apiKey}`
                },
                timeout: 5000
            });
            
            return {
                status: 'passed',
                message: 'API认证成功',
                responseTime: response.headers['x-response-time'] || 'N/A'
            };
        } catch (error) {
            const errorClassification = this.classifyError(error);
            return {
                status: 'failed',
                message: errorClassification.message,
                errorType: errorClassification.type,
                errorCategory: errorClassification.category,
                suggestions: this.getErrorSuggestions(errorClassification)
            };
        }
    }

    // 测试模型列表端点
    async testModelsEndpoint(apiConfig) {
        try {
            const response = await this.getModels(apiConfig);
            
            return {
                status: 'passed',
                message: '模型列表获取成功',
                modelCount: response.data?.length || 0,
                models: response.data?.map(m => m.id) || []
            };
        } catch (error) {
            const errorClassification = this.classifyError(error);
            return {
                status: 'failed',
                message: errorClassification.message,
                errorType: errorClassification.type,
                errorCategory: errorClassification.category,
                suggestions: this.getErrorSuggestions(errorClassification)
            };
        }
    }
}

module.exports = new LLMClient();