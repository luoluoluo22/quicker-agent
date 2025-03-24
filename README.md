# Quicker Open Chat

一个基于Quicker平台的聊天应用，支持多种AI模型对话。

## 配置说明

1. 复制 `config.template.json` 为 `config.json`
2. 在 `config.json` 中填入您的API密钥和其他配置信息
3. 确保 `config.json` 已被添加到 `.gitignore` 中，不会被提交到代码仓库

## 功能特点

- 支持多种AI模型
- 支持代码块显示
- 支持流式响应
- 支持自定义提示词
- 完整的错误处理和日志记录

## 使用说明

1. 在Quicker中创建新动作
2. 将代码复制到动作中
3. 配置相应的API密钥和模型参数
4. 运行动作开始对话

## 注意事项

- 请勿在代码中直接硬编码API密钥
- 定期检查日志文件大小
- 建议定期备份配置文件 