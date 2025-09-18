const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const proxyRoutes = require('./routes/proxy');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));

// 路由
app.use('/api', apiRoutes);
app.use('/proxy', proxyRoutes);

// 根路径重定向到index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`SillyTavern Text Optimizer server running on port ${PORT}`);
});