const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        this.currentLevel = 2; // info
    }

    // 记录日志
    log(level, message, data = null) {
        if (this.logLevels[level] <= this.currentLevel) {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                level,
                message,
                data
            };
            
            // 添加到内存日志
            this.logs.push(logEntry);
            
            // 限制日志数量
            if (this.logs.length > this.maxLogs) {
                this.logs = this.logs.slice(-this.maxLogs);
            }
            
            // 控制台输出
            if (this.shouldLogToConsole()) {
                this.logToConsole(logEntry);
            }
            
            // 文件输出
            if (this.shouldLogToFile()) {
                this.logToFile(logEntry);
            }
        }
    }

    // 错误日志
    error(message, data = null) {
        this.log('error', message, data);
    }

    // 警告日志
    warn(message, data = null) {
        this.log('warn', message, data);
    }

    // 信息日志
    info(message, data = null) {
        this.log('info', message, data);
    }

    // 调试日志
    debug(message, data = null) {
        this.log('debug', message, data);
    }

    // 获取所有日志
    getLogs() {
        return this.logs;
    }

    // 获取特定级别的日志
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }

    // 清空日志
    clearLogs() {
        this.logs = [];
    }

    // 设置日志级别
    setLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.currentLevel = this.logLevels[level];
        }
    }

    // 控制台输出
    logToConsole(logEntry) {
        const { timestamp, level, message, data } = logEntry;
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        
        switch (level) {
            case 'error':
                console.error(prefix, message, data || '');
                break;
            case 'warn':
                console.warn(prefix, message, data || '');
                break;
            case 'info':
                console.info(prefix, message, data || '');
                break;
            case 'debug':
                console.debug(prefix, message, data || '');
                break;
            default:
                console.log(prefix, message, data || '');
        }
    }

    // 文件输出
    logToFile(logEntry) {
        try {
            let config;
            try {
                config = require('../config/configManager').getConfig();
            } catch (configError) {
                console.error('Failed to load config for logging:', configError);
                return;
            }
            
            if (!config || !config.logging || !config.logging.filePath) {
                console.warn('Logging configuration not found, skipping file logging');
                return;
            }
            
            const logFilePath = config.logging.filePath;
            
            // 确保日志目录存在
            const logDir = path.dirname(logFilePath);
            if (!fs.existsSync(logDir)) {
                try {
                    fs.mkdirSync(logDir, { recursive: true });
                } catch (mkdirError) {
                    console.error('Failed to create log directory:', mkdirError);
                    return;
                }
            }
            
            // 检查文件是否可写
            try {
                if (!fs.existsSync(logFilePath)) {
                    fs.writeFileSync(logFilePath, '', 'utf8');
                }
                fs.accessSync(logDir, fs.constants.W_OK);
            } catch (accessError) {
                console.error('Log file is not writable:', accessError);
                return;
            }
            
            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(logFilePath, logLine, 'utf8');
        } catch (error) {
            console.error('Failed to write log to file:', error);
        }
    }

    // 是否应该输出到控制台
    shouldLogToConsole() {
        try {
            const config = require('../config/configManager').getConfig();
            if (!config || !config.logging) {
                console.warn('Logging configuration not found, using default console logging');
                return true;
            }
            return config.logging.enableConsole !== false; // 默认启用
        } catch (error) {
            console.error('Error checking console logging setting:', error);
            return true; // 默认启用
        }
    }

    // 是否应该输出到文件
    shouldLogToFile() {
        try {
            const config = require('../config/configManager').getConfig();
            if (!config || !config.logging) {
                console.warn('Logging configuration not found, disabling file logging');
                return false;
            }
            return config.logging.enableFile === true; // 默认禁用
        } catch (error) {
            console.error('Error checking file logging setting:', error);
            return false; // 默认禁用
        }
    }

    // 获取最近的日志
    getRecentLogs(count = 100) {
        return this.logs.slice(-count);
    }

    // 获取错误日志
    getErrorLogs() {
        return this.getLogsByLevel('error');
    }

    // 获取警告日志
    getWarningLogs() {
        return this.getLogsByLevel('warn');
    }

    // 获取信息日志
    getInfoLogs() {
        return this.getLogsByLevel('info');
    }

    // 获取调试日志
    getDebugLogs() {
        return this.getLogsByLevel('debug');
    }
}

module.exports = new Logger();