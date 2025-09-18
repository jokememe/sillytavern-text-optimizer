# SillyTavern Text Optimizer

一个用于优化 LLM 生成回复文本的代理服务器，专门为 SillyTavern 设计。

## 功能特点

- 🎯 **精准优化**: 只优化 LLM 生成的回复文本，不影响用户输入
- 🏷️ **标签系统**: 使用标签标识需要优化的文本部分
- 🔧 **灵活配置**: 支持自定义标签、优化提示和 API 设置
- 🚀 **独立 API**: 支持使用不同的 API 进行文本优化
- 🌐 **Web 界面**: 提供直观的 Web 界面进行配置和测试
- 📊 **实时预览**: 可以预览优化效果

## 工作原理

1. 用户向 SillyTavern 发送对话请求
2. SillyTavern 将对话请求发送到代理服务
3. 代理服务将请求转发给 LLM API
4. LLM API 生成回复文本
5. 代理服务从 LLM 生成的回复文本中提取标签内的内容
6. 代理服务使用 LLM API 优化提取的内容
7. 代理服务用优化后的内容替换原始回复文本中的标签内容
8. 代理服务将优化后的回复文本返回给 SillyTavern
9. SillyTavern 将优化后的回复文本显示给用户

## 安装

### 使用 Docker（推荐）

```bash
# 克隆仓库
git clone https://github.com/your-username/sillytavern-text-optimizer.git
cd sillytavern-text-optimizer

# 构建并运行容器
docker-compose up -d
```

### 手动安装

```bash
# 克隆仓库
git clone https://github.com/your-username/sillytavern-text-optimizer.git
cd sillytavern-text-optimizer

# 安装依赖
npm install

# 启动服务
npm start
```

## 配置

### 基本配置

编辑 `config/config.json` 文件：

```json
{
  "apiBase": "https://api.openai.com/v1",
  "apiKey": "your-api-key",
  "model": "gpt-3.5-turbo",
  "startTag": "*",
  "endTag": "*",
  "optimizationPrompt": "请优化以下文本，使其更加流畅易读，但不改变原意：",
  "port": 3000,
  "modelAliases": {
    "chat-model": "gpt-3.5-turbo",
    "advanced-model": "gpt-4",
    "fast-model": "gpt-3.5-turbo-16k"
  },
  "useSeparateOptimizationApi": false,
  "optimizationApi": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "your-optimization-api-key",
    "model": "gpt-3.5-turbo",
    "timeout": 30000
  },
  "tagUsageDescription": "标签应用于LLM生成的回复文本中需要优化的部分。例如，如果回复文本是'你好，*我是AI助手*，很高兴认识您'，则'*我是AI助手*'部分将被优化。"
}
```

### 配置说明

- `apiBase`: LLM API 的基础 URL
- `apiKey`: LLM API 的密钥
- `model`: 默认使用的模型
- `startTag` 和 `endTag`: 用于标识需要优化文本的标签
- `optimizationPrompt`: 优化文本时使用的提示词
- `port`: 服务器端口
- `modelAliases`: 模型别名映射
- `useSeparateOptimizationApi`: 是否使用独立的 API 进行文本优化
- `optimizationApi`: 独立优化 API 的配置

## 使用方法

### 标签使用

在 LLM 生成的回复文本中，使用标签标识需要优化的部分：

```
你好，*我是AI助手*，很高兴认识您。*我可以帮助您解答问题*，请随时提问。
```

在这个例子中，`*我是AI助手*` 和 `*我可以帮助您解答问题*` 将被优化。

### Web 界面

访问 `http://localhost:3000` 打开 Web 界面：

1. **配置管理**: 查看和修改配置
2. **优化测试**: 测试文本优化效果
3. **实时预览**: 预览优化前后的文本对比

### 与 SillyTavern 集成

1. 在 SillyTavern 中，将 API 地址设置为 `http://localhost:3000/v1`
2. 确保 LLM 在生成回复时使用标签标识需要优化的部分
3. 代理服务器会自动优化标签内的内容

## API 端点

- `GET /`: Web 界面
- `GET /config`: 获取当前配置
- `POST /config`: 更新配置
- `POST /optimize`: 优化文本
- `POST /v1/*`: 代理所有 OpenAI API 请求

## 开发

```bash
# 安装开发依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- 初始版本
- 支持标签式文本优化
- 提供 Web 界面
- 支持独立优化 API