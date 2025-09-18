// 全局变量
let currentConfig = {};
let currentLogs = [];

// DOM 元素
const elements = {
    // 标签页
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // 配置管理
    baseUrl: document.getElementById('baseUrl'),
    apiKey: document.getElementById('apiKey'),
    model: document.getElementById('model'),
    timeout: document.getElementById('timeout'),
    startTag: document.getElementById('startTag'),
    endTag: document.getElementById('endTag'),
    optimizationPrompt: document.getElementById('optimizationPrompt'),
    temperature: document.getElementById('temperature'),
    maxTokens: document.getElementById('maxTokens'),
    
    // 文本优化API设置
    useSeparateOptimizationApi: document.getElementById('useSeparateOptimizationApi'),
    optimizationApiSettings: document.getElementById('optimizationApiSettings'),
    optimizationBaseUrl: document.getElementById('optimizationBaseUrl'),
    optimizationApiKey: document.getElementById('optimizationApiKey'),
    optimizationModel: document.getElementById('optimizationModel'),
    optimizationTimeout: document.getElementById('optimizationTimeout'),
    refreshOptimizationModels: document.getElementById('refreshOptimizationModels'),
    testOptimizationConnection: document.getElementById('testOptimizationConnection'),
    
    // 模型别名管理
    customModelName: document.getElementById('customModelName'),
    actualModelSelect: document.getElementById('actualModelSelect'),
    modelAliasesList: document.getElementById('modelAliasesList'),
    
    // 按钮
    saveConfig: document.getElementById('saveConfig'),
    testConnection: document.getElementById('testConnection'),
    refreshModels: document.getElementById('refreshModels'),
    refreshModelsForAliases: document.getElementById('refreshModelsForAliases'),
    addModelAlias: document.getElementById('addModelAlias'),
    optimizeText: document.getElementById('optimizeText'),
    clearText: document.getElementById('clearText'),
    refreshLogs: document.getElementById('refreshLogs'),
    clearLogs: document.getElementById('clearLogs'),
    
    // 文本优化
    inputText: document.getElementById('inputText'),
    originalText: document.getElementById('originalText'),
    optimizedText: document.getElementById('optimizedText'),
    
    // 日志
    logContainer: document.getElementById('logContainer'),
    logLevel: document.getElementById('logLevel'),
    
    // 通知
    notification: document.getElementById('notification')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    loadConfig();
    loadLogs();
    loadModelAliases();
    bindEvents();
});

// 标签页初始化
function initializeTabs() {
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
}

// 切换标签页
function switchTab(tabId) {
    // 更新按钮状态
    elements.tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('data-tab') === tabId) {
            button.classList.add('active');
        }
    });
    
    // 更新内容显示
    elements.tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
            content.classList.add('active');
        }
    });
}

// 绑定事件
function bindEvents() {
    elements.saveConfig.addEventListener('click', saveConfig);
    elements.testConnection.addEventListener('click', testConnection);
    elements.refreshModels.addEventListener('click', refreshModels);
    elements.refreshModelsForAliases.addEventListener('click', refreshModelsForAliases);
    elements.addModelAlias.addEventListener('click', addModelAlias);
    elements.optimizeText.addEventListener('click', optimizeText);
    elements.clearText.addEventListener('click', clearText);
    elements.refreshLogs.addEventListener('click', loadLogs);
    elements.clearLogs.addEventListener('click', clearLogs);
    elements.logLevel.addEventListener('change', filterLogs);
    
    // 文本优化API设置事件
    elements.useSeparateOptimizationApi.addEventListener('change', toggleOptimizationApiSettings);
    elements.refreshOptimizationModels.addEventListener('click', refreshOptimizationModels);
    elements.testOptimizationConnection.addEventListener('click', testOptimizationConnection);
}

// API 请求函数
async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(`/api${endpoint}`, mergedOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        showNotification(error.message, 'error');
        throw error;
    }
}

// 加载配置
async function loadConfig() {
    try {
        console.log('Loading configuration...');
        const config = await apiRequest('/config');
        currentConfig = config;
        
        console.log('Configuration loaded:', {
            hasApiKey: !!config.api.apiKey,
            apiKeyLength: config.api.apiKey === '******' ? 0 : config.api.apiKey.length,
            baseUrl: config.api.baseUrl,
            model: config.api.model
        });
        
        // 检查API密钥状态
        let apiKeyStatus;
        try {
            apiKeyStatus = await apiRequest('/config/api-key-status');
            console.log('API key status:', apiKeyStatus);
        } catch (statusError) {
            console.error('Failed to check API key status:', statusError);
            apiKeyStatus = { hasApiKey: false };
        }
        
        // 填充表单
        elements.baseUrl.value = config.api.baseUrl || '';
        
        // 特殊处理API密钥字段
        // 如果返回的是掩码值，则保留掩码值表示已有密钥
        // 如果返回的是实际值，则填充到字段中
        if (config.api.apiKey === '******') {
            elements.apiKey.value = '******';
            console.log('API key field set to masked value');
        } else if (config.api.apiKey && config.api.apiKey.trim() !== '') {
            elements.apiKey.value = config.api.apiKey;
            console.log('API key field populated with actual value');
        } else {
            elements.apiKey.value = '';
            console.log('API key field cleared (empty value received)');
        }
        
        elements.model.value = config.api.model || '';
        elements.timeout.value = config.api.timeout || 30000;
        elements.startTag.value = config.textOptimization.wrapTags[0] || '<|text|>';
        elements.endTag.value = config.textOptimization.wrapTags[1] || '<|/text|>';
        elements.optimizationPrompt.value = config.textOptimization.optimizationPrompt || '请优化以下文本，使其更加流畅易读，保持原意不变：';
        elements.temperature.value = config.textOptimization.temperature || 0.7;
        elements.maxTokens.value = config.textOptimization.maxTokens || 2000;
        
        // 加载文本优化API设置
        elements.useSeparateOptimizationApi.checked = config.textOptimization.useSeparateOptimizationApi || false;
        toggleOptimizationApiSettings();
        
        if (config.textOptimization.optimizationApi) {
            elements.optimizationBaseUrl.value = config.textOptimization.optimizationApi.baseUrl || '';
            
            // 特殊处理优化API密钥字段
            if (config.textOptimization.optimizationApi.apiKey === '******') {
                elements.optimizationApiKey.value = '******';
            } else if (config.textOptimization.optimizationApi.apiKey) {
                elements.optimizationApiKey.value = config.textOptimization.optimizationApi.apiKey;
            } else {
                elements.optimizationApiKey.value = '';
            }
            
            elements.optimizationModel.value = config.textOptimization.optimizationApi.model || 'gpt-3.5-turbo';
            elements.optimizationTimeout.value = config.textOptimization.optimizationApi.timeout || 30000;
        }
        
        console.log('Form populated with configuration values');
        showNotification('配置加载成功', 'success');
        
        // 如果API密钥字段为空，但状态显示有密钥，说明是掩码
        if (!elements.apiKey.value && apiKeyStatus.hasApiKey) {
            setTimeout(() => {
                showNotification('API密钥已配置，但出于安全原因未显示', 'info');
            }, 1000);
        } else if (!elements.apiKey.value) {
            setTimeout(() => {
                showNotification('请输入API密钥以使用完整功能', 'info');
            }, 1000);
        }
    } catch (error) {
        console.error('Failed to load config:', error);
        showNotification('配置加载失败: ' + error.message, 'error');
    }
}

// 保存配置
async function saveConfig() {
    try {
        // 验证输入
        if (!elements.baseUrl.value.trim()) {
            showNotification('请输入API基础URL', 'error');
            return;
        }
        
        if (!elements.model.value.trim()) {
            showNotification('请选择或输入模型名称', 'error');
            return;
        }
        
        // 检查API密钥 - 如果是掩码值表示已有密钥，不需要重新输入
        if (!elements.apiKey.value.trim()) {
            showNotification('请输入API密钥', 'error');
            return;
        }
        
        // 如果API密钥是掩码值，说明用户没有修改，从当前配置中获取实际值
        let apiKeyToSave = elements.apiKey.value.trim();
        if (apiKeyToSave === '******') {
            // 保留原有的API密钥，不发送到后端
            apiKeyToSave = currentConfig.api.apiKey || '';
        }
        
        // 处理优化API密钥
        let optimizationApiKeyToSave = elements.optimizationApiKey.value.trim();
        if (optimizationApiKeyToSave === '******') {
            optimizationApiKeyToSave = currentConfig.textOptimization?.optimizationApi?.apiKey || '';
        }
        
        const config = {
            api: {
                baseUrl: elements.baseUrl.value.trim(),
                apiKey: apiKeyToSave,
                model: elements.model.value.trim(),
                timeout: parseInt(elements.timeout.value) || 30000
            },
            textOptimization: {
                wrapTags: [elements.startTag.value.trim(), elements.endTag.value.trim()],
                optimizationPrompt: elements.optimizationPrompt.value.trim(),
                temperature: parseFloat(elements.temperature.value) || 0.7,
                maxTokens: parseInt(elements.maxTokens.value) || 2000,
                useSeparateOptimizationApi: elements.useSeparateOptimizationApi.checked,
                optimizationApi: {
                    baseUrl: elements.optimizationBaseUrl.value.trim(),
                    apiKey: optimizationApiKeyToSave,
                    model: elements.optimizationModel.value.trim(),
                    timeout: parseInt(elements.optimizationTimeout.value) || 30000
                }
            }
        };
        
        // 添加服务器和日志配置（保持现有配置）
        const currentConfigData = await apiRequest('/config');
        config.server = currentConfigData.server;
        config.logging = currentConfigData.logging;
        config.modelAliases = currentConfigData.modelAliases;
        
        console.log('Saving config:', {
            hasApiKey: !!config.api.apiKey,
            apiKeyLength: config.api.apiKey.length,
            baseUrl: config.api.baseUrl,
            model: config.api.model
        });
        
        const result = await apiRequest('/config', {
            method: 'POST',
            body: JSON.stringify(config)
        });
        
        if (result.success) {
            currentConfig = config;
            showNotification('配置保存成功', 'success');
            
            // 重新加载配置以验证保存是否成功
            setTimeout(async () => {
                try {
                    const loadedConfig = await apiRequest('/config');
                    console.log('Config verification:', {
                        savedHasApiKey: !!config.api.apiKey,
                        loadedHasApiKey: loadedConfig.api.apiKey !== '',
                        baseUrlMatch: loadedConfig.api.baseUrl === config.api.baseUrl,
                        modelMatch: loadedConfig.api.model === config.api.model
                    });
                } catch (verifyError) {
                    console.error('Config verification failed:', verifyError);
                }
            }, 1000);
        } else {
            showNotification('配置保存失败: ' + (result.error || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('Failed to save config:', error);
        showNotification('配置保存失败: ' + error.message, 'error');
    }
}

// 测试连接
async function testConnection() {
    try {
        // 验证输入
        if (!elements.baseUrl.value.trim()) {
            showNotification('请输入API基础URL', 'error');
            return;
        }
        
        // 检查API密钥 - 如果是掩码值表示已有密钥，不需要重新输入
        if (!elements.apiKey.value.trim()) {
            showNotification('请输入API密钥', 'error');
            return;
        }
        
        // 如果API密钥是掩码值，说明用户没有修改，从当前配置中获取实际值
        let apiKeyToTest = elements.apiKey.value.trim();
        if (apiKeyToTest === '******') {
            apiKeyToTest = currentConfig.api.apiKey || '';
        }
        
        if (!elements.model.value.trim()) {
            showNotification('请选择或输入模型名称', 'error');
            return;
        }
        
        elements.testConnection.disabled = true;
        elements.testConnection.innerHTML = '<span class="loading"></span> 测试中...';
        
        const testData = {
            baseUrl: elements.baseUrl.value.trim(),
            apiKey: apiKeyToTest,
            model: elements.model.value.trim()
        };
        
        console.log('Testing connection with:', {
            baseUrl: testData.baseUrl,
            model: testData.model,
            apiKeyLength: testData.apiKey.length
        });
        
        const result = await apiRequest('/test-connection', {
            method: 'POST',
            body: JSON.stringify(testData)
        });
        
        if (result.success) {
            console.log('Connection test successful');
            showNotification('连接测试成功', 'success');
        } else {
            console.log('Connection test failed');
            
            // 根据错误类型提供具体的解决建议
            let errorMessage = result.message || '连接测试失败';
            let suggestions = [];
            
            if (result.errorType === 'auth') {
                errorMessage = 'API认证失败';
                suggestions = [
                    '检查API密钥是否正确',
                    '确认API密钥权限是否足够',
                    '验证API密钥是否已激活',
                    '如果密钥已过期，请获取新的API密钥'
                ];
            } else if (result.errorType === 'network') {
                errorMessage = '网络连接问题';
                suggestions = [
                    '检查网络连接是否正常',
                    '确认API服务器地址是否正确',
                    '检查防火墙设置',
                    '尝试使用不同的网络连接'
                ];
            } else if (result.errorType === 'rate_limit') {
                errorMessage = 'API请求频率限制';
                suggestions = [
                    '减少请求频率',
                    '等待一段时间后再试',
                    '考虑升级API计划',
                    '检查API使用配额'
                ];
            } else if (result.errorType === 'server') {
                errorMessage = 'API服务器错误';
                suggestions = [
                    '稍后重试',
                    '查看API服务状态页面',
                    '确认API服务是否正常运行',
                    '联系API服务提供商'
                ];
            } else {
                suggestions = result.suggestions || [
                    '检查所有配置参数',
                    '查看详细日志信息',
                    '尝试重新启动应用',
                    '联系技术支持'
                ];
            }
            
            // 显示详细的错误信息和解决建议
            showDetailedError(errorMessage, suggestions);
        }
    } catch (error) {
        console.error('Connection test failed:', error);
        
        // 根据错误类型提供具体的解决建议
        let errorMessage = '连接测试失败';
        let suggestions = [];
        
        if (error.message.includes('无效的令牌') || error.message.includes('invalid_token')) {
            errorMessage = 'API密钥无效或已过期';
            suggestions = [
                '检查API密钥是否正确复制',
                '确认API密钥是否已激活',
                '验证API密钥是否有足够权限',
                '如果密钥已过期，请获取新的API密钥'
            ];
        } else if (error.message.includes('网络') || error.message.includes('network')) {
            errorMessage = '网络连接问题';
            suggestions = [
                '检查网络连接是否正常',
                '确认API服务器地址是否正确',
                '检查防火墙设置',
                '尝试使用不同的网络连接'
            ];
        } else if (error.message.includes('timeout') || error.message.includes('超时')) {
            errorMessage = '请求超时';
            suggestions = [
                '增加API超时时间设置',
                '检查网络连接速度',
                '稍后重试',
                '确认API服务器是否正常运行'
            ];
        } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMessage = 'API认证失败';
            suggestions = [
                '检查API密钥是否正确',
                '确认API密钥权限是否足够',
                '验证API服务是否可用',
                '联系API服务提供商'
            ];
        } else if (error.message.includes('404')) {
            errorMessage = 'API端点不存在';
            suggestions = [
                '检查API基础URL是否正确',
                '确认API版本是否正确',
                '验证API服务是否支持模型列表功能',
                '查阅API文档确认正确的端点'
            ];
        } else if (error.message.includes('5')) {
            errorMessage = 'API服务器错误';
            suggestions = [
                '稍后重试',
                '查看API服务状态页面',
                '确认API服务是否正常运行',
                '联系API服务提供商'
            ];
        } else {
            suggestions = [
                '检查所有配置参数',
                '查看详细日志信息',
                '尝试重新启动应用',
                '联系技术支持'
            ];
        }
        
        // 显示详细的错误信息和解决建议
        showDetailedError(errorMessage, suggestions);
    } finally {
        elements.testConnection.disabled = false;
        elements.testConnection.textContent = '测试连接';
    }
}

// 刷新模型列表
async function refreshModels() {
    try {
        elements.refreshModels.disabled = true;
        elements.refreshModels.innerHTML = '<span class="loading"></span> 刷新中...';
        
        const result = await apiRequest('/models');
        
        // 更新模型选择器
        elements.model.innerHTML = '';
        if (result.data && result.data.length > 0) {
            result.data.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                elements.model.appendChild(option);
            });
            showNotification(`成功加载 ${result.data.length} 个模型`, 'success');
        } else {
            showNotification('未找到可用模型', 'warning');
        }
    } catch (error) {
        console.error('Failed to refresh models:', error);
        
        // 根据错误类型提供具体的解决建议
        let errorMessage = '模型列表刷新失败';
        let suggestions = [];
        
        if (error.message.includes('无效的令牌') || error.message.includes('invalid_token')) {
            errorMessage = 'API密钥无效或已过期';
            suggestions = [
                '检查API密钥是否正确复制',
                '确认API密钥是否已激活',
                '验证API密钥是否有足够权限',
                '如果密钥已过期，请获取新的API密钥'
            ];
        } else if (error.message.includes('网络') || error.message.includes('network')) {
            errorMessage = '网络连接问题';
            suggestions = [
                '检查网络连接是否正常',
                '确认API服务器地址是否正确',
                '检查防火墙设置',
                '尝试使用不同的网络连接'
            ];
        } else if (error.message.includes('timeout') || error.message.includes('超时')) {
            errorMessage = '请求超时';
            suggestions = [
                '增加API超时时间设置',
                '检查网络连接速度',
                '稍后重试',
                '确认API服务器是否正常运行'
            ];
        } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMessage = 'API认证失败';
            suggestions = [
                '检查API密钥是否正确',
                '确认API密钥权限是否足够',
                '验证API服务是否可用',
                '联系API服务提供商'
            ];
        } else if (error.message.includes('404')) {
            errorMessage = 'API端点不存在';
            suggestions = [
                '检查API基础URL是否正确',
                '确认API版本是否正确',
                '验证API服务是否支持模型列表功能',
                '查阅API文档确认正确的端点'
            ];
        } else if (error.message.includes('5')) {
            errorMessage = 'API服务器错误';
            suggestions = [
                '稍后重试',
                '查看API服务状态页面',
                '确认API服务是否正常运行',
                '联系API服务提供商'
            ];
        } else {
            suggestions = [
                '检查所有配置参数',
                '查看详细日志信息',
                '尝试重新启动应用',
                '联系技术支持'
            ];
        }
        
        // 显示详细的错误信息和解决建议
        showDetailedError(errorMessage, suggestions);
    } finally {
        elements.refreshModels.disabled = false;
        elements.refreshModels.textContent = '刷新模型列表';
    }
}

// 优化文本
async function optimizeText() {
    try {
        const text = elements.inputText.value.trim();
        if (!text) {
            showNotification('请输入模拟的LLM回复文本', 'error');
            return;
        }
        
        elements.optimizeText.disabled = true;
        elements.optimizeText.innerHTML = '<span class="loading"></span> 优化中...';
        
        const result = await apiRequest('/optimize', {
            method: 'POST',
            body: JSON.stringify({
                text: text,
                tags: [elements.startTag.value, elements.endTag.value],
                prompt: elements.optimizationPrompt.value
            })
        });
        
        // 显示结果
        elements.originalText.textContent = result.originalText;
        elements.optimizedText.textContent = result.optimizedText;
        
        if (result.success) {
            showNotification('LLM回复文本优化成功', 'success');
            
            // 显示优化说明
            if (result.extractedTexts && result.extractedTexts.length > 0) {
                setTimeout(() => {
                    showNotification(`成功优化了 ${result.extractedTexts.length} 处标签内容`, 'info');
                }, 1000);
            } else {
                setTimeout(() => {
                    showNotification('未检测到标签内容，请确保在模拟的LLM回复文本中使用正确的标签格式', 'warning');
                }, 1000);
            }
        } else {
            // 根据错误类型提供具体的解决建议
            let errorMessage = result.error || 'LLM回复文本优化失败';
            let suggestions = [
                '请确保输入的是模拟的LLM回复文本，而不是用户输入',
                '检查标签格式是否正确',
                '确认API配置是否正确'
            ];
            
            if (errorMessage.includes('无效的令牌') || errorMessage.includes('invalid_token')) {
                errorMessage = 'API密钥无效或已过期';
                suggestions = [
                    '检查API密钥是否正确复制',
                    '确认API密钥是否已激活',
                    '验证API密钥是否有足够权限',
                    '如果密钥已过期，请获取新的API密钥'
                ];
            } else if (errorMessage.includes('网络') || errorMessage.includes('network')) {
                errorMessage = '网络连接问题';
                suggestions = [
                    '检查网络连接是否正常',
                    '确认API服务器地址是否正确',
                    '检查防火墙设置',
                    '尝试使用不同的网络连接'
                ];
            } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
                errorMessage = '请求超时';
                suggestions = [
                    '增加API超时时间设置',
                    '检查网络连接速度',
                    '减少文本长度',
                    '稍后重试'
                ];
            } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
                errorMessage = 'API认证失败';
                suggestions = [
                    '检查API密钥是否正确',
                    '确认API密钥权限是否足够',
                    '验证API服务是否可用',
                    '联系API服务提供商'
                ];
            } else if (errorMessage.includes('404')) {
                errorMessage = 'API端点不存在';
                suggestions = [
                    '检查API基础URL是否正确',
                    '确认API版本是否正确',
                    '验证API服务是否支持文本优化功能',
                    '查阅API文档确认正确的端点'
                ];
            } else if (errorMessage.includes('5')) {
                errorMessage = 'API服务器错误';
                suggestions = [
                    '稍后重试',
                    '查看API服务状态页面',
                    '确认API服务是否正常运行',
                    '联系API服务提供商'
                ];
            } else if (errorMessage.includes('模型') || errorMessage.includes('model')) {
                errorMessage = '模型相关问题';
                suggestions = [
                    '检查所选模型是否可用',
                    '尝试使用其他模型',
                    '确认模型名称拼写正确',
                    '刷新模型列表获取最新可用模型'
                ];
            }
            
            // 显示详细的错误信息和解决建议
            showDetailedError(errorMessage, suggestions);
        }
    } catch (error) {
        console.error('LLM response text optimization failed:', error);
        
        // 根据错误类型提供具体的解决建议
        let errorMessage = 'LLM回复文本优化失败';
        let suggestions = [
            '请确保输入的是模拟的LLM回复文本，而不是用户输入',
            '检查标签格式是否正确',
            '确认API配置是否正确'
        ];
        
        if (error.message.includes('无效的令牌') || error.message.includes('invalid_token')) {
            errorMessage = 'API密钥无效或已过期';
            suggestions = [
                '检查API密钥是否正确复制',
                '确认API密钥是否已激活',
                '验证API密钥是否有足够权限',
                '如果密钥已过期，请获取新的API密钥'
            ];
        } else if (error.message.includes('网络') || error.message.includes('network')) {
            errorMessage = '网络连接问题';
            suggestions = [
                '检查网络连接是否正常',
                '确认API服务器地址是否正确',
                '检查防火墙设置',
                '尝试使用不同的网络连接'
            ];
        } else if (error.message.includes('timeout') || error.message.includes('超时')) {
            errorMessage = '请求超时';
            suggestions = [
                '增加API超时时间设置',
                '检查网络连接速度',
                '减少文本长度',
                '稍后重试'
            ];
        } else if (error.message.includes('401') || error.message.includes('403')) {
            errorMessage = 'API认证失败';
            suggestions = [
                '检查API密钥是否正确',
                '确认API密钥权限是否足够',
                '验证API服务是否可用',
                '联系API服务提供商'
            ];
        } else if (error.message.includes('404')) {
            errorMessage = 'API端点不存在';
            suggestions = [
                '检查API基础URL是否正确',
                '确认API版本是否正确',
                '验证API服务是否支持文本优化功能',
                '查阅API文档确认正确的端点'
            ];
        } else if (error.message.includes('5')) {
            errorMessage = 'API服务器错误';
            suggestions = [
                '稍后重试',
                '查看API服务状态页面',
                '确认API服务是否正常运行',
                '联系API服务提供商'
            ];
        }
        
        // 显示详细的错误信息和解决建议
        showDetailedError(errorMessage, suggestions);
    } finally {
        elements.optimizeText.disabled = false;
        elements.optimizeText.textContent = '优化文本';
    }
}

// 清空文本
function clearText() {
    elements.inputText.value = '';
    elements.originalText.textContent = '';
    elements.optimizedText.textContent = '';
}

// 加载日志
async function loadLogs() {
    try {
        const logs = await apiRequest('/logs');
        currentLogs = logs;
        displayLogs(logs);
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

// 显示日志
function displayLogs(logs) {
    const level = elements.logLevel.value;
    const filteredLogs = level === 'all' ? logs : logs.filter(log => log.level === level);
    
    elements.logContainer.innerHTML = filteredLogs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        return `
            <div class="log-entry ${log.level}">
                [${timestamp}] [${log.level.toUpperCase()}] ${log.message}
                ${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}
            </div>
        `;
    }).join('');
    
    // 滚动到底部
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

// 过滤日志
function filterLogs() {
    displayLogs(currentLogs);
}

// 清空日志
async function clearLogs() {
    try {
        await apiRequest('/logs', {
            method: 'DELETE'
        });
        
        currentLogs = [];
        elements.logContainer.innerHTML = '';
        showNotification('日志清空成功', 'success');
    } catch (error) {
        console.error('Failed to clear logs:', error);
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    elements.notification.textContent = message;
    elements.notification.className = `notification ${type}`;
    elements.notification.classList.add('show');
    
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 3000);
}

// 显示详细的错误信息和解决建议
function showDetailedError(errorMessage, suggestions = []) {
    // 创建错误详情弹窗
    const errorModal = document.createElement('div');
    errorModal.className = 'error-modal';
    errorModal.innerHTML = `
        <div class="error-modal-content">
            <div class="error-modal-header">
                <h3>错误详情</h3>
                <button class="error-modal-close">&times;</button>
            </div>
            <div class="error-modal-body">
                <div class="error-message">
                    <strong>错误信息:</strong>
                    <p>${errorMessage}</p>
                </div>
                ${suggestions.length > 0 ? `
                    <div class="error-suggestions">
                        <strong>解决建议:</strong>
                        <ul>
                            ${suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                <div class="error-actions">
                    <button class="btn-primary" onclick="this.closest('.error-modal').remove()">确定</button>
                    <button class="btn-secondary" onclick="window.open('/api/logs', '_blank')">查看日志</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加样式
    if (!document.querySelector('#error-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'error-modal-styles';
        style.textContent = `
            .error-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            
            .error-modal-content {
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }
            
            .error-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e5e5e5;
            }
            
            .error-modal-header h3 {
                margin: 0;
                color: #333;
            }
            
            .error-modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .error-modal-close:hover {
                color: #333;
            }
            
            .error-modal-body {
                padding: 20px;
            }
            
            .error-message {
                margin-bottom: 20px;
            }
            
            .error-message p {
                margin: 10px 0 0 0;
                color: #d32f2f;
                font-weight: 500;
            }
            
            .error-suggestions {
                margin-bottom: 20px;
            }
            
            .error-suggestions ul {
                margin: 10px 0 0 0;
                padding-left: 20px;
            }
            
            .error-suggestions li {
                margin: 8px 0;
                line-height: 1.5;
            }
            
            .error-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .error-actions button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
            }
            
            .btn-primary {
                background-color: #2196F3;
                color: white;
            }
            
            .btn-primary:hover {
                background-color: #1976D2;
            }
            
            .btn-secondary {
                background-color: #f5f5f5;
                color: #333;
            }
            
            .btn-secondary:hover {
                background-color: #e0e0e0;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 添加关闭事件
    const closeButton = errorModal.querySelector('.error-modal-close');
    closeButton.addEventListener('click', () => {
        errorModal.remove();
    });
    
    // 点击背景关闭
    errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            errorModal.remove();
        }
    });
    
    // 添加到页面
    document.body.appendChild(errorModal);
}

// 工具函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 自动保存配置（防抖）
const autoSaveConfig = debounce(() => {
    saveConfig();
}, 2000);

// 监听配置变化
[elements.baseUrl, elements.apiKey, elements.model, elements.timeout, 
 elements.startTag, elements.endTag, elements.optimizationPrompt, 
 elements.temperature, elements.maxTokens].forEach(element => {
    element.addEventListener('input', autoSaveConfig);
});

// 定期刷新日志
setInterval(loadLogs, 30000); // 每30秒刷新一次

// 模型别名管理函数
async function loadModelAliases() {
    try {
        const config = await apiRequest('/config');
        const modelAliases = config.modelAliases || {};
        displayModelAliases(modelAliases);
    } catch (error) {
        console.error('Failed to load model aliases:', error);
    }
}

function displayModelAliases(modelAliases) {
    elements.modelAliasesList.innerHTML = '';
    
    if (Object.keys(modelAliases).length === 0) {
        elements.modelAliasesList.innerHTML = '<p>暂无模型别名</p>';
        return;
    }
    
    Object.entries(modelAliases).forEach(([customName, actualModel]) => {
        const aliasItem = document.createElement('div');
        aliasItem.className = 'model-alias-item';
        aliasItem.innerHTML = `
            <div class="alias-info">
                <strong>${customName}</strong> → ${actualModel}
            </div>
            <div class="alias-actions">
                <button class="btn-secondary btn-small edit-alias" data-custom="${customName}" data-actual="${actualModel}">编辑</button>
                <button class="btn-danger btn-small delete-alias" data-custom="${customName}">删除</button>
            </div>
        `;
        elements.modelAliasesList.appendChild(aliasItem);
    });
    
    // 绑定编辑和删除事件
    document.querySelectorAll('.edit-alias').forEach(button => {
        button.addEventListener('click', (e) => {
            const customName = e.target.getAttribute('data-custom');
            const actualModel = e.target.getAttribute('data-actual');
            editModelAlias(customName, actualModel);
        });
    });
    
    document.querySelectorAll('.delete-alias').forEach(button => {
        button.addEventListener('click', (e) => {
            const customName = e.target.getAttribute('data-custom');
            deleteModelAlias(customName);
        });
    });
}

async function refreshModelsForAliases() {
    try {
        elements.refreshModelsForAliases.disabled = true;
        elements.refreshModelsForAliases.innerHTML = '<span class="loading"></span> 刷新中...';
        
        const result = await apiRequest('/models');
        
        // 更新实际模型选择器
        elements.actualModelSelect.innerHTML = '<option value="">选择实际模型</option>';
        result.data.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            elements.actualModelSelect.appendChild(option);
        });
        
        showNotification('模型列表刷新成功', 'success');
    } catch (error) {
        console.error('Failed to refresh models for aliases:', error);
    } finally {
        elements.refreshModelsForAliases.disabled = false;
        elements.refreshModelsForAliases.textContent = '刷新模型列表';
    }
}

async function addModelAlias() {
    try {
        const customName = elements.customModelName.value.trim();
        const actualModel = elements.actualModelSelect.value;
        
        if (!customName) {
            showNotification('请输入自定义模型名称', 'error');
            return;
        }
        
        if (!actualModel) {
            showNotification('请选择实际模型', 'error');
            return;
        }
        
        const config = await apiRequest('/config');
        const modelAliases = config.modelAliases || {};
        
        // 检查是否已存在
        if (modelAliases[customName]) {
            showNotification('该自定义模型名称已存在', 'error');
            return;
        }
        
        // 添加新的别名
        modelAliases[customName] = actualModel;
        
        // 保存配置
        const updateConfig = {
            ...config,
            modelAliases
        };
        
        await apiRequest('/config', {
            method: 'POST',
            body: JSON.stringify(updateConfig)
        });
        
        // 清空输入
        elements.customModelName.value = '';
        elements.actualModelSelect.value = '';
        
        // 重新加载别名列表
        await loadModelAliases();
        
        showNotification('模型别名添加成功', 'success');
    } catch (error) {
        console.error('Failed to add model alias:', error);
    }
}

// 切换优化API设置显示/隐藏
function toggleOptimizationApiSettings() {
    const isChecked = elements.useSeparateOptimizationApi.checked;
    elements.optimizationApiSettings.style.display = isChecked ? 'block' : 'none';
    
    // 如果启用单独API，验证必填字段
    if (isChecked) {
        if (!elements.optimizationBaseUrl.value.trim()) {
            showNotification('请输入优化API地址', 'info');
        }
        if (!elements.optimizationApiKey.value.trim() && elements.optimizationApiKey.value !== '******') {
            showNotification('请输入优化API密钥', 'info');
        }
        if (!elements.optimizationModel.value.trim()) {
            showNotification('请选择优化API模型', 'info');
        }
    }
}

// 刷新优化API模型列表
async function refreshOptimizationModels() {
    try {
        if (!elements.useSeparateOptimizationApi.checked) {
            showNotification('请先启用单独的优化API', 'error');
            return;
        }
        
        if (!elements.optimizationBaseUrl.value.trim()) {
            showNotification('请输入优化API地址', 'error');
            return;
        }
        
        if (!elements.optimizationApiKey.value.trim() && elements.optimizationApiKey.value !== '******') {
            showNotification('请输入优化API密钥', 'error');
            return;
        }
        
        elements.refreshOptimizationModels.disabled = true;
        elements.refreshOptimizationModels.innerHTML = '<span class="loading"></span> 刷新中...';
        
        // 处理优化API密钥
        let optimizationApiKeyToTest = elements.optimizationApiKey.value.trim();
        if (optimizationApiKeyToTest === '******') {
            optimizationApiKeyToTest = currentConfig.textOptimization?.optimizationApi?.apiKey || '';
        }
        
        const testData = {
            baseUrl: elements.optimizationBaseUrl.value.trim(),
            apiKey: optimizationApiKeyToTest,
            model: elements.optimizationModel.value.trim(),
            timeout: 10000
        };
        
        const result = await apiRequest('/models', {
            method: 'POST',
            body: JSON.stringify(testData)
        });
        
        // 更新优化API模型选择器
        elements.optimizationModel.innerHTML = '';
        result.data.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            elements.optimizationModel.appendChild(option);
        });
        
        showNotification('优化API模型列表刷新成功', 'success');
    } catch (error) {
        console.error('Failed to refresh optimization models:', error);
        showNotification('优化API模型列表刷新失败: ' + error.message, 'error');
    } finally {
        elements.refreshOptimizationModels.disabled = false;
        elements.refreshOptimizationModels.textContent = '刷新模型列表';
    }
}

// 测试优化API连接
async function testOptimizationConnection() {
    try {
        if (!elements.useSeparateOptimizationApi.checked) {
            showNotification('请先启用单独的优化API', 'error');
            return;
        }
        
        if (!elements.optimizationBaseUrl.value.trim()) {
            showNotification('请输入优化API地址', 'error');
            return;
        }
        
        if (!elements.optimizationApiKey.value.trim() && elements.optimizationApiKey.value !== '******') {
            showNotification('请输入优化API密钥', 'error');
            return;
        }
        
        if (!elements.optimizationModel.value.trim()) {
            showNotification('请选择优化API模型', 'error');
            return;
        }
        
        elements.testOptimizationConnection.disabled = true;
        elements.testOptimizationConnection.innerHTML = '<span class="loading"></span> 测试中...';
        
        // 处理优化API密钥
        let optimizationApiKeyToTest = elements.optimizationApiKey.value.trim();
        if (optimizationApiKeyToTest === '******') {
            optimizationApiKeyToTest = currentConfig.textOptimization?.optimizationApi?.apiKey || '';
        }
        
        const testData = {
            baseUrl: elements.optimizationBaseUrl.value.trim(),
            apiKey: optimizationApiKeyToTest,
            model: elements.optimizationModel.value.trim(),
            timeout: 10000
        };
        
        console.log('Testing optimization connection with:', {
            baseUrl: testData.baseUrl,
            model: testData.model,
            apiKeyLength: testData.apiKey.length
        });
        
        const result = await apiRequest('/test-connection', {
            method: 'POST',
            body: JSON.stringify(testData)
        });
        
        if (result.success) {
            console.log('Optimization connection test successful');
            showNotification('优化API连接测试成功', 'success');
        } else {
            console.log('Optimization connection test failed');
            showNotification('优化API连接测试失败，请检查API密钥和配置', 'error');
        }
    } catch (error) {
        console.error('Optimization connection test failed:', error);
        showNotification('优化API连接测试失败: ' + error.message, 'error');
    } finally {
        elements.testOptimizationConnection.disabled = false;
        elements.testOptimizationConnection.textContent = '测试优化API连接';
    }
}

function editModelAlias(customName, actualModel) {
    elements.customModelName.value = customName;
    elements.actualModelSelect.value = actualModel;
    
    // 更改按钮文本为更新
    elements.addModelAlias.textContent = '更新别名';
    elements.addModelAlias.onclick = async () => {
        try {
            const newCustomName = elements.customModelName.value.trim();
            const newActualModel = elements.actualModelSelect.value;
            
            if (!newCustomName) {
                showNotification('请输入自定义模型名称', 'error');
                return;
            }
            
            if (!newActualModel) {
                showNotification('请选择实际模型', 'error');
                return;
            }
            
            const config = await apiRequest('/config');
            const modelAliases = config.modelAliases || {};
            
            // 如果自定义名称改变，删除旧的
            if (newCustomName !== customName) {
                delete modelAliases[customName];
            }
            
            // 添加新的别名
            modelAliases[newCustomName] = newActualModel;
            
            // 保存配置
            const updateConfig = {
                ...config,
                modelAliases
            };
            
            await apiRequest('/config', {
                method: 'POST',
                body: JSON.stringify(updateConfig)
            });
            
            // 清空输入
            elements.customModelName.value = '';
            elements.actualModelSelect.value = '';
            
            // 恢复按钮文本和功能
            elements.addModelAlias.textContent = '添加别名';
            elements.addModelAlias.onclick = addModelAlias;
            
            // 重新加载别名列表
            await loadModelAliases();
            
            showNotification('模型别名更新成功', 'success');
        } catch (error) {
            console.error('Failed to update model alias:', error);
        }
    };
}

async function deleteModelAlias(customName) {
    if (!confirm(`确定要删除模型别名 "${customName}" 吗？`)) {
        return;
    }
    
    try {
        const config = await apiRequest('/config');
        const modelAliases = config.modelAliases || {};
        
        // 删除别名
        delete modelAliases[customName];
        
        // 保存配置
        const updateConfig = {
            ...config,
            modelAliases
        };
        
        await apiRequest('/config', {
            method: 'POST',
            body: JSON.stringify(updateConfig)
        });
        
        // 重新加载别名列表
        await loadModelAliases();
        
        showNotification('模型别名删除成功', 'success');
    } catch (error) {
        console.error('Failed to delete model alias:', error);
    }
}