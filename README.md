# Quicker AI 聊天助手

一个为Quicker软件设计的AI聊天助手应用，能够执行命令、调用Quicker动作，并提供上下文感知能力。

## 功能特点

- **AI聊天**: 与OpenAI GPT模型进行对话交流
- **命令执行**: 允许AI助手执行系统命令并返回结果
- **Quicker动作集成**: 支持调用Quicker动作
- **上下文感知**: 可以捕获和使用桌面上下文
  - **窗口内容识别**: 识别当前窗口的文本内容
  - **程序信息获取**: 获取当前程序名称、路径和描述
  - **窗口属性采集**: 采集窗口位置和类名等元数据
- **AI思考可视化**: 展示AI助手的思考过程
- **可定制提示词**: 可自定义系统提示词以控制AI行为
- **响应式设计**: 适配各种屏幕尺寸

## 技术栈

- **前端**: HTML, CSS, JavaScript (原生)
- **AI接口**: OpenAI API
- **集成**: Quicker API

## 安装与使用

### 作为Quicker动作使用

1. 确保你已安装最新版本的[Quicker](https://getquicker.net/)
2. 导入Quicker动作（即将提供）
3. 配置你的OpenAI API密钥

### 本地开发

1. 克隆仓库:
```
git clone https://github.com/yourusername/quicker-ai-chat.git
```

2. 打开`index.html`或使用本地服务器:
```
cd quicker-ai-chat
python -m http.server
```

3. 在浏览器中访问 `http://localhost:8000`

## 配置

在设置面板中，你可以配置:

- OpenAI API密钥
- 模型选择 (如GPT-3.5, GPT-4等)
- 系统提示词
- 其他设置

## 模块结构

- **chat.js**: 聊天通信模块，处理AI通信和消息处理
- **command.js**: 命令执行模块，处理终端命令执行功能
- **action.js**: 动作执行模块，处理Quicker动作调用
- **context.js**: 上下文管理模块，处理桌面上下文捕获和使用
- **config.js**: 配置模块，管理应用设置和常量
- **ui.js**: UI管理模块，处理界面元素操作和交互
- **main.js**: 主程序入口，整合所有模块

## 在Quicker中使用

本应用需要在Quicker中开发以下子程序:

1. **RunCommand**: 执行系统命令并返回结果
2. **RunAction**: 运行指定的Quicker动作
3. **GetContextWithVisuals**: 获取当前桌面上下文，包括截图

## 自定义

你可以通过编辑以下文件来自定义应用:

- **css/styles.css**: 修改应用样式
- **js/config.js**: 更改默认配置

## 贡献

欢迎贡献代码和提出建议。请通过Issue或PR提交你的想法。

## 许可证

[MIT](LICENSE)

## 鸣谢

- [OpenAI](https://openai.com/) - 提供强大的AI模型
- [Quicker](https://getquicker.net/) - 提供Windows效率工具支持
- [Marked.js](https://marked.js.org/) - Markdown解析
- [Highlight.js](https://highlightjs.org/) - 代码高亮 