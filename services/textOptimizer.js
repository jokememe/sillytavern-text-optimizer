const llmClient = require('./llmClient');
const logger = require('./logger');

class TextOptimizer {
    constructor() {
        this.defaultTags = ['<|text|>', '<|/text|>'];
    }

    // 提取标签内的文本
    extractWrappedText(text, tags) {
        const [startTag, endTag] = tags || this.defaultTags;
        const regex = new RegExp(`${startTag}(.*?)${endTag}`, 'gs');
        const matches = [];
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                text: match[1].trim(),
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }
        
        return matches;
    }

    // 优化单个文本
    async optimizeSingleText(text, optimizationPrompt, apiConfig, optimizationApiConfig = null) {
        try {
            const prompt = `${optimizationPrompt}\n\n原文：${text}`;
            
            // 决定使用哪个API配置
            const effectiveApiConfig = optimizationApiConfig || apiConfig;
            
            const response = await llmClient.callLLM({
                model: effectiveApiConfig.model,
                messages: [
                    { role: 'system', content: '你是一个专业的文本优化助手，擅长优化文本使其更加流畅易读。' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2000
            }, effectiveApiConfig);
            
            return response.choices[0].message.content.trim();
        } catch (error) {
            logger.error('Error optimizing text:', error);
            throw new Error(`Failed to optimize text: ${error.message}`);
        }
    }

    // 提取并优化文本
    async extractAndOptimizeText(text, optimizationConfig, apiConfig) {
        const { wrapTags, optimizationPrompt, useSeparateOptimizationApi, optimizationApi } = optimizationConfig;
        const extractedTexts = this.extractWrappedText(text, wrapTags);
        
        if (extractedTexts.length === 0) {
            return {
                optimizedText: text,
                extractedTexts: []
            };
        }
        
        let optimizedText = text;
        const optimizations = [];
        
        // 决定使用哪个API配置
        const effectiveApiConfig = useSeparateOptimizationApi ? optimizationApi : apiConfig;
        
        // 从后往前替换，避免索引变化
        for (let i = extractedTexts.length - 1; i >= 0; i--) {
            const { text: originalText, startIndex, endIndex } = extractedTexts[i];
            
            try {
                const optimized = await this.optimizeSingleText(originalText, optimizationPrompt, apiConfig, effectiveApiConfig);
                
                // 替换原文中的文本
                optimizedText = optimizedText.substring(0, startIndex) +
                              optimized +
                              optimizedText.substring(endIndex);
                
                optimizations.push({
                    originalText,
                    optimizedText: optimized,
                    startIndex,
                    endIndex
                });
                
                logger.info(`Text optimized: "${originalText.substring(0, 50)}..." -> "${optimized.substring(0, 50)}..."`);
            } catch (error) {
                logger.error(`Failed to optimize text at position ${startIndex}:`, error);
                // 保持原文不变
            }
        }
        
        return {
            optimizedText,
            extractedTexts: optimizations
        };
    }

    // 直接优化文本（不提取标签）
    async optimizeText(text, optimizationConfig, apiConfig) {
        const { optimizationPrompt, useSeparateOptimizationApi, optimizationApi } = optimizationConfig;
        
        try {
            // 决定使用哪个API配置
            const effectiveApiConfig = useSeparateOptimizationApi ? optimizationApi : apiConfig;
            
            const optimized = await this.optimizeSingleText(text, optimizationPrompt, apiConfig, effectiveApiConfig);
            
            return {
                originalText: text,
                optimizedText: optimized,
                success: true
            };
        } catch (error) {
            logger.error('Error in direct text optimization:', error);
            return {
                originalText: text,
                optimizedText: text,
                success: false,
                error: error.message
            };
        }
    }

    // 批量优化文本
    async optimizeTextBatch(texts, optimizationConfig, apiConfig) {
        const results = [];
        
        for (const text of texts) {
            const result = await this.optimizeText(text, optimizationConfig, apiConfig);
            results.push(result);
        }
    
        return results;
    }
    
    // 优化LLM生成的回复文本
    async optimizeResponse(responseData, optimizationConfig, apiConfig) {
        // 从回复文本中提取消息内容
        const messageContent = this.extractMessageContent(responseData);
        
        // 如果消息内容中包含标签，提取标签内的内容进行优化
        if (this.containsTags(messageContent, optimizationConfig.wrapTags)) {
            const taggedContents = this.extractTaggedContent(messageContent, optimizationConfig.wrapTags);
            const optimizedContents = [];
            
            // 优化每个标签内的内容
            for (const content of taggedContents) {
                try {
                    const optimized = await this.optimizeSingleText(
                        content.text,
                        optimizationConfig.optimizationPrompt,
                        apiConfig,
                        optimizationConfig.useSeparateOptimizationApi ? optimizationConfig.optimizationApi : apiConfig
                    );
                    optimizedContents.push(optimized);
                } catch (error) {
                    logger.error(`Failed to optimize tagged content:`, error);
                    // 如果优化失败，保持原文不变
                    optimizedContents.push(content.text);
                }
            }
            
            // 用优化后的内容替换原始消息内容中的标签内容
            const optimizedMessageContent = this.replaceTaggedContent(
                messageContent,
                taggedContents,
                optimizedContents
            );
            
            // 更新回复数据中的消息内容
            return this.updateMessageContent(responseData, optimizedMessageContent);
        }
        
        // 如果消息内容中不包含标签，直接返回原始回复
        return responseData;
    }
    
    // 提取消息内容
    extractMessageContent(responseData) {
        // 根据OpenAI API的响应格式提取消息内容
        if (responseData.choices && responseData.choices.length > 0) {
            const message = responseData.choices[0].message;
            if (message && message.content) {
                return message.content;
            }
        }
        return '';
    }
    
    // 检查消息内容中是否包含标签
    containsTags(messageContent, wrapTags) {
        const [startTag, endTag] = wrapTags || this.defaultTags;
        return messageContent.includes(startTag) && messageContent.includes(endTag);
    }
    
    // 提取标签内的内容
    extractTaggedContent(messageContent, wrapTags) {
        const [startTag, endTag] = wrapTags || this.defaultTags;
        const regex = new RegExp(`${startTag}(.*?)${endTag}`, 'gs');
        const matches = [];
        let match;
        while ((match = regex.exec(messageContent)) !== null) {
            matches.push({
                text: match[1].trim(),
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }
        return matches;
    }
    
    // 替换标签内的内容
    replaceTaggedContent(messageContent, taggedContents, optimizedContents) {
        // 从后往前替换，避免索引变化
        let result = messageContent;
        for (let i = taggedContents.length - 1; i >= 0; i--) {
            const { startIndex, endIndex, text } = taggedContents[i];
            const optimizedContent = optimizedContents[i];
            
            // 从原始文本中提取标签
            const originalTaggedContent = messageContent.substring(startIndex, endIndex);
            const textStart = originalTaggedContent.indexOf(text);
            const startTag = originalTaggedContent.substring(0, textStart);
            const endTag = originalTaggedContent.substring(textStart + text.length);
            
            // 构建新的标签内容
            const newTaggedContent = startTag + optimizedContent + endTag;
            
            // 替换整个标签内容
            result = result.substring(0, startIndex) + newTaggedContent + result.substring(endIndex);
        }
        return result;
    }
    
    // 提取开始标签
    extractStartTag(messageContent, startIndex) {
        // 向前查找标签开始
        let tagStart = startIndex;
        while (tagStart >= 0 && messageContent[tagStart] !== '<' && messageContent[tagStart] !== '*') {
            tagStart--;
        }
        
        // 向后查找标签结束
        let tagEnd = startIndex;
        while (tagEnd < messageContent.length && messageContent[tagEnd] !== '>' && messageContent[tagEnd] !== '*') {
            tagEnd++;
        }
        
        return messageContent.substring(tagStart, tagEnd + 1);
    }
    
    // 提取结束标签
    extractEndTag(messageContent, endIndex) {
        // 向前查找标签开始
        let tagStart = endIndex;
        while (tagStart >= 0 && messageContent[tagStart] !== '<' && messageContent[tagStart] !== '*') {
            tagStart--;
        }
        
        // 向后查找标签结束
        let tagEnd = endIndex;
        while (tagEnd < messageContent.length && messageContent[tagEnd] !== '>' && messageContent[tagEnd] !== '*') {
            tagEnd++;
        }
        
        return messageContent.substring(tagStart, tagEnd + 1);
    }
    
    // 更新回复数据中的消息内容
    updateMessageContent(responseData, optimizedMessageContent) {
        if (responseData.choices && responseData.choices.length > 0) {
            const message = responseData.choices[0].message;
            if (message && message.content) {
                message.content = optimizedMessageContent;
            }
        }
        return responseData;
    }
    }
    
    module.exports = new TextOptimizer();