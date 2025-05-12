import { CONFIG, MAX_HISTORY_MESSAGES, AI_THINKING } from './config.js'
import { readStream, addMessage } from './utils.js'
import { settingsManager } from './settings.js'
import { contextManager } from './context.js'
import { toggleManager } from './toggle.js'
import { actionManager } from './action.js'

const hljs = window.hljs;
// 聊天管理器初始化标记
const CHAT_MANAGER_INITIALIZED = 'quicker_chat_manager_initialized'

// 添加新的正则表达式来匹配上下文窗口读写工具标签
const readContextWindowRegex = /<readContextWindow>([\s\S]*?)<\/readContextWindow>/gs;
const writeToContextWindowRegex = /<writeToContextWindow>([\s\S]*?)<\/writeToContextWindow>/gs;

class ChatManager {
    constructor() {
        // 初始化属性为 null
        this.messagesContainer = null
        this.messageInput = null
        this.sendButton = null
        this.clearButton = null
        this.messages = []
        this.isProcessing = false
        this.lastMessageSent = 0  // 添加时间戳来防止重复发送
        this.lastCommandResult = null // 存储最后一个命令执行结果
        this.lastActionResult = null // 存储最后一个动作执行结果
        this.lastFailedUserMessage = null;
        this.isRetrying = false;
        this.abortController = null; // 新增：用于中断fetch
        
        // 检查是否已经初始化过
        if (window[CHAT_MANAGER_INITIALIZED]) {
            console.log('ChatManager: 检测到已初始化，跳过重复初始化')
            return
        }
        
        // 延迟初始化事件监听器，等待 DOM 完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeEventListeners())
        } else {
            this.initializeEventListeners()
        }

        // 设置初始化标记
        window[CHAT_MANAGER_INITIALIZED] = true
    }

    initializeEventListeners() {
        // 检查是否已经初始化过
        if (window[CHAT_MANAGER_INITIALIZED] && this.sendButton) {
            console.log('ChatManager: 事件监听器已初始化，跳过重复初始化')
            return
        }

        // 获取所需的 DOM 元素
        this.messagesContainer = document.getElementById('chat-container')
        this.messageInput = document.getElementById('message-input')
        this.sendButton = document.getElementById('send-button')
        this.clearButton = document.getElementById('clear-messages')

        if (!this.messagesContainer || !this.messageInput || !this.sendButton) {
            console.error('Required DOM elements not found for ChatManager')
            return
        }

        console.log('ChatManager: 正在初始化事件监听器')

        // 统一处理发送消息的函数
        const handleSendMessage = async () => {
            console.log('ChatManager: handleSendMessage 被调用')
            
            // 防止短时间内重复发送
            const now = Date.now()
            if (now - this.lastMessageSent < 800) {
                console.warn(`ChatManager: 防止重复发送 - 时间间隔太短 (${now - this.lastMessageSent}ms)`)
                return
            }
            
            const message = this.messageInput.value.trim()
            console.log(`ChatManager: 准备发送消息 [${message.substring(0, 20)}${message.length > 20 ? '...' : ''}]`)
            
            if (message && !this.isProcessing) {
                this.lastMessageSent = now
                await this.sendMessage(message)
                this.messageInput.value = ''
            } else {
                if (!message) {
                    console.log('ChatManager: 消息为空，不发送')
                }
                if (this.isProcessing) {
                    console.log('ChatManager: 正在处理上一条消息，不发送')
                }
            }
        }

        // 移除所有现有的事件监听器
        const oldSendButton = this.sendButton.cloneNode(true)
        this.sendButton.parentNode.replaceChild(oldSendButton, this.sendButton)
        this.sendButton = oldSendButton

        const oldMessageInput = this.messageInput.cloneNode(true)
        this.messageInput.parentNode.replaceChild(oldMessageInput, this.messageInput)
        this.messageInput = oldMessageInput

        // 发送按钮点击事件
        console.log('ChatManager: 添加发送按钮点击事件监听器')
        this.sendButton.addEventListener('click', (event) => {
            console.log('ChatManager: 发送按钮被点击')
            event.preventDefault()
            handleSendMessage()
        })

        // 消息输入框回车事件
        console.log('ChatManager: 添加消息输入框回车事件监听器')
        this.messageInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                console.log('ChatManager: Enter 键被按下')
                event.preventDefault()
                handleSendMessage()
            }
        })

        // 清空按钮点击事件
        if (this.clearButton) {
            const oldClearButton = this.clearButton.cloneNode(true)
            if (this.clearButton.parentNode) {
                this.clearButton.parentNode.replaceChild(oldClearButton, this.clearButton)
                this.clearButton = oldClearButton
            }
            
            console.log('ChatManager: 添加清空按钮点击事件监听器')
            this.clearButton.addEventListener('click', () => {
                console.log('ChatManager: 清空按钮被点击')
                this.clearMessages()
            })
        }
    }

    // 添加消息到界面
    addMessage(role, content) {
        // 创建消息元素
        const messageDiv = document.createElement('div')
        messageDiv.className = 'message-animation max-w-3xl mx-auto mb-4'
        
        // 根据角色确定样式和头像
        const isUser = role === 'user'
        
        messageDiv.innerHTML = `
            <div class="bg-white p-5 rounded-2xl shadow-sm">
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <i class="fas ${isUser ? 'fa-user' : 'fa-robot'} text-gray-500"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-gray-500 mb-1">${isUser ? '用户' : 'AI 助手'}</p>
                        <div class="text-gray-700 message-content">${isUser ? content : ''}</div>
                    </div>
                </div>
            </div>
        `
        
        // 添加到消息容器
        this.messagesContainer.appendChild(messageDiv)
        
        // 添加到消息历史
        this.messages.push({ role: isUser ? 'user' : 'assistant', content })
        
        // 滚动到底部
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
        
        return messageDiv
    }

    // 在ChatManager类中添加一个新的辅助方法来生成上下文信息文本
    generateContextInfoText(contextState) {
        let contextInfoText = '';
        
        if (contextState && contextState.isActive && contextState.metadata) {
            console.log('ChatManager: 准备上下文信息用于替换占位符');
            
            // 构建当前上下文信息文本
            let contextInfo = [];
            
            // 添加当前活动窗口信息
            contextInfo.push('=== 当前活动窗口信息 ===');
            contextInfo.push(`- 当前窗口标题: ${contextState.title || '未知'}`);
            
            // 添加进程相关信息
            if (contextState.metadata.processName) {
                contextInfo.push(`- 当前程序: ${contextState.metadata.processName}`);
            }
            
            if (contextState.metadata.processPath) {
                contextInfo.push(`- 程序路径: ${contextState.metadata.processPath}`);
            }
            
            if (contextState.metadata.processDescription) {
                contextInfo.push(`- 程序描述: ${contextState.metadata.processDescription}`);
            }
            
            // 添加窗口属性信息
            if (contextState.metadata.windowClass) {
                contextInfo.push(`- 窗口类名: ${contextState.metadata.windowClass}`);
            }
            
            if (contextState.metadata.windowRect) {
                contextInfo.push(`- 窗口位置: ${JSON.stringify(contextState.metadata.windowRect)}`);
            }
            
            // 添加Windows系统版本号（如果有）
            if (contextState.metadata.windowsOsVersion) {
                contextInfo.push(`- Windows版本: ${contextState.metadata.windowsOsVersion}`);
            }
            
            // 添加选中的文本（如果有）
            if (contextState.metadata.selectedText) {
                contextInfo.push(`- 选中的文本: ${contextState.metadata.selectedText}`);
            }
            
            // 添加屏幕分辨率信息（如果可用）
            try {
                const screenWidth = window.screen.width;
                const screenHeight = window.screen.height;
                if (screenWidth && screenHeight) {
                    contextInfo.push(`- 屏幕分辨率: ${screenWidth}x${screenHeight}`);
                }
            } catch (error) {
                console.warn('ChatManager: 获取屏幕分辨率时出错:', error);
            }
            
            // 添加可用动作信息
            try {
                const isActionEnabled = toggleManager.isActionExecutionEnabled();
                if (isActionEnabled) {
                    const availableActions = actionManager.getActions().map(action => action.name);
                    if (availableActions && availableActions.length > 0) {
                        contextInfo.push('');
                        contextInfo.push('=== 可用动作信息 ===');
                        contextInfo.push(`- 可用动作数量: ${availableActions.length}`);
                        contextInfo.push('- 可用动作列表:');
                        availableActions.forEach((action, index) => {
                            if (index < 10) { // 限制显示前10个
                                contextInfo.push(`  * ${action}`);
                            } else if (index === 10) {
                                contextInfo.push(`  * ... 等${availableActions.length - 10}个其他动作`);
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn('ChatManager: 获取可用动作时出错:', error);
            }
            
            // 添加命令执行状态
            try {
                const isCommandEnabled = toggleManager.isCommandExecutionEnabled();
                contextInfo.push('');
                contextInfo.push('=== 功能状态信息 ===');
                contextInfo.push(`- 命令执行功能: ${isCommandEnabled ? '已启用' : '未启用'}`);
                contextInfo.push(`- 动作执行功能: ${toggleManager.isActionExecutionEnabled() ? '已启用' : '未启用'}`);
            } catch (error) {
                console.warn('ChatManager: 获取功能状态时出错:', error);
            }
            
            // 组装为文本
            contextInfoText = contextInfo.join('\n');
            console.log('ChatManager: 已生成上下文信息用于替换占位符');
        } else {
            contextInfoText = '当前没有活动的窗口上下文信息。';
            console.log('ChatManager: 没有活动的上下文或元数据');
        }
        
        return contextInfoText;
    }

    // 发送消息
    async sendMessage(text) {
        console.log('ChatManager: sendMessage 被调用', text)
        if (this.isProcessing && !this.isRetrying) {
            console.warn('ChatManager: 消息处理中，忽略请求')
            return
        }
        if (!this.isRetrying) {
            this.removeRetryOption();
            this.lastFailedUserMessage = null;
        }
        this.isProcessing = true
        this.messageInput.disabled = true
        // 切换发送按钮为"停止"
        if (this.sendButton) {
            this.sendButton.textContent = '停止';
            this.sendButton.classList.add('bg-red-500', 'text-white');
            this.sendButton.classList.remove('bg-gray-800', 'hover:bg-gray-700', 'bg-white', 'hover:bg-gray-100', 'text-gray-800');
            this.sendButton.onclick = () => {
                if (this.abortController) {
                    this.abortController.abort();
                }
            };
        }
        // 创建AbortController
        this.abortController = new AbortController();
        try {
            // 检测是否有动作命令，但仅做日志记录，不直接执行
            const userActionMatch = text.match(/^执行动作[：:]\s*(.+)$/);
            if (userActionMatch && userActionMatch[1]) {
                const actionName = userActionMatch[1].trim();
                console.log(`ChatManager: 检测到动作命令，动作名称: "${actionName}"，将交由AI处理`);
            }
            
            // 添加用户消息到界面
            console.log('ChatManager: 添加用户消息到界面')
            this.addMessage('user', text)
            
            // 保持消息历史在限制范围内
            if (this.messages.length > MAX_HISTORY_MESSAGES) {
                console.log(`ChatManager: 裁剪消息历史 (${this.messages.length} -> ${MAX_HISTORY_MESSAGES})`)
                this.messages = this.messages.slice(-MAX_HISTORY_MESSAGES)
            }

            // 获取当前设置
            console.log('ChatManager: 获取设置')
            const settings = settingsManager.getCurrentSettings()

            // 获取上下文状态
            console.log('ChatManager: 获取上下文状态')
            const contextState = contextManager.getContextState()
            
            // 构建系统提示词
            console.log('ChatManager: 构建系统提示词')
            const systemPrompts = []
            
            // 添加AI思考提示词
            if (AI_THINKING.enabled) {
                console.log('ChatManager: 添加AI思考提示词到系统提示词')
                
                // 获取上下文信息，用于替换占位符
                const contextInfoText = this.generateContextInfoText(contextState);
                
                // 替换占位符
                let systemPromptWithContext = AI_THINKING.systemPrompt.replace('{{CONTEXT_INFO}}', contextInfoText);
                console.log('ChatManager: 已替换系统提示词中的占位符');
                
                // 添加到系统提示词数组
                systemPrompts.push(systemPromptWithContext);
            } else {
                console.log('ChatManager: AI思考功能未启用，跳过添加系统提示词');
            }
            
            // 添加上次命令结果（如果有）
            if (this.lastCommandResult) {
                console.log('ChatManager: 添加上次命令执行结果到系统提示词')
                systemPrompts.push(`上次命令执行结果:\n${this.lastCommandResult}`)
            }
            
            // 添加上次动作结果（如果有）
            if (this.lastActionResult) {
                console.log('ChatManager: 添加上次动作执行结果到系统提示词')
                systemPrompts.push(`上次动作执行结果:\n${this.lastActionResult}`)
            }
            
            // 添加命令执行提示词（如果功能开启）
            let isCommandEnabled = false;
            try {
                // 首先检查按钮的UI状态
                const cmdButton = document.getElementById('toggle-run-command-button');
                if (cmdButton) {
                    const uiActive = cmdButton.classList.contains('context-active');
                    console.log(`ChatManager: 命令执行按钮UI状态: ${uiActive}`);
                    
                    // 尝试从 URL hash 获取状态
                    const hash = window.location.hash.substring(1);
                    if (hash) {
                        const params = new URLSearchParams(hash);
                        const hashState = params.get('cmd') === '1';
                        console.log(`ChatManager: URL hash中的命令执行状态: ${hashState}`);
                        
                        // 获取toggleManager中的状态
                        const managerState = toggleManager.isCommandExecutionEnabled();
                        console.log(`ChatManager: toggleManager中的命令执行状态: ${managerState}`);
                        
                        // 如果三个状态不一致，优先使用UI状态
                        if (uiActive !== hashState || uiActive !== managerState) {
                            console.log(`ChatManager: 状态不一致 (UI: ${uiActive}, Hash: ${hashState}, Manager: ${managerState})，优先使用UI状态`);
                            isCommandEnabled = uiActive;
                        } else {
                            isCommandEnabled = managerState;
                        }
                    } else {
                        // 如果没有hash，使用UI状态
                        isCommandEnabled = uiActive;
                    }
                } else {
                    // 如果按钮不存在，使用toggleManager状态
                    isCommandEnabled = toggleManager.isCommandExecutionEnabled();
                }
            } catch (error) {
                console.error('ChatManager: 检查命令执行状态出错:', error);
                // 出错时使用toggleManager状态
                isCommandEnabled = toggleManager.isCommandExecutionEnabled();
            }
            
            console.log(`ChatManager: 最终确定的命令执行状态: ${isCommandEnabled}`);
            
            // 添加命令和动作执行功能说明到AI思考提示词中
            if (isCommandEnabled && AI_THINKING.enabled) {
                console.log('ChatManager: 命令执行已启用');
            } else {
                console.log(`ChatManager: 命令执行未启用(${isCommandEnabled})，跳过添加`);
            }
            
            // 添加动作执行提示词（如果功能开启）
            const isActionEnabled = toggleManager.isActionExecutionEnabled();
            console.log(`ChatManager: 检查动作执行状态: ${isActionEnabled}`);
            
            if (isActionEnabled) {
                const availableActions = actionManager.getActions().map(action => action.name);
                console.log(`ChatManager: 可用动作数量: ${availableActions.length}`);
                if (availableActions.length > 0) {
                    // 将可用动作列表添加到系统提示词
                    const actionListText = `可用动作列表:\n${availableActions.map(action => `- ${action}`).join('\n')}`;
                    systemPrompts.push(actionListText);
                    console.log('ChatManager: 添加动作列表到系统提示词');
                }
            }
            
            // 添加上下文（如果激活）
            if (contextState && contextState.isActive) {
                console.log(`ChatManager: 添加上下文到系统提示词: ${contextState.title}`)
                
                // 创建包含更多详细信息的上下文提示词
                const contextPrompt = [
                    `===== 当前窗口上下文信息 =====`,
                    `窗口标题: ${contextState.title}`,
                    `窗口内容:\n${contextState.content}`,
                ].join('\n');
                
                // 尝试添加更多上下文信息（如果存在）
                try {
                    // 检查是否有额外的元数据可用
                    if (contextState.metadata) {
                        console.log('ChatManager: 添加额外的上下文元数据');
                        let metadataPrompt = [
                            ``,
                            `===== 程序信息 =====`,
                            `程序名称: ${contextState.metadata.processName || '未知'}`,
                            `程序路径: ${contextState.metadata.processPath || '未知'}`,
                            `程序描述: ${contextState.metadata.processDescription || '未知'}`
                        ];
                        
                        // 添加窗口矩形信息（如果有）
                        if (contextState.metadata.windowRect) {
                            metadataPrompt.push('');
                            metadataPrompt.push('===== 窗口位置信息 =====');
                            metadataPrompt.push(`窗口矩形: ${JSON.stringify(contextState.metadata.windowRect)}`);
                        }
                        
                        // 添加窗口类名信息（如果有）
                        if (contextState.metadata.windowClass) {
                            if (!contextState.metadata.windowRect) {
                                metadataPrompt.push('');
                                metadataPrompt.push('===== 窗口属性信息 =====');
                            }
                            metadataPrompt.push(`窗口类名: ${contextState.metadata.windowClass}`);
                        }
                        
                        systemPrompts.push(contextPrompt + metadataPrompt.join('\n'));
                    } else {
                        // 如果没有额外元数据，只添加基本上下文
                        systemPrompts.push(contextPrompt);
                    }
                } catch (error) {
                    console.warn('ChatManager: 添加上下文元数据时出错:', error);
                    // 出错时只添加基本上下文
                    systemPrompts.push(contextPrompt);
                }
                
                console.log('ChatManager: 已添加上下文信息到系统提示词');
            }
            
            // 添加用户自定义系统提示词
            if (Array.isArray(settings.systemPrompts)) {
                console.log(`ChatManager: 添加 ${settings.systemPrompts.length} 个用户自定义系统提示词`)
                settings.systemPrompts.forEach(prompt => {
                    if (prompt && typeof prompt === 'string') {
                        systemPrompts.push(prompt)
                    }
                })
            }

            // 构建完整消息列表
            console.log(`ChatManager: 构建完整消息列表，系统提示词数量: ${systemPrompts.length}`)
            const systemContent = systemPrompts.join('\n\n')
            console.log(`ChatManager: 系统提示词总长度: ${systemContent.length} 字符`)
            
            const fullMessages = [
                { role: 'system', content: systemContent },
                ...this.messages
            ]

            // 发送请求
            console.log('ChatManager: 发送 API 请求')
            const response = await fetch(settings.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: settings.model,
                    messages: fullMessages,
                    temperature: settings.temperature,
                    stream: true
                }),
                signal: this.abortController.signal // 传入中断信号
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            // 创建 AI 消息元素
            console.log('ChatManager: 创建 AI 消息元素')
            const aiMessageDiv = this.addMessage('assistant', '')
            const aiMessageContent = aiMessageDiv.querySelector('.message-content')
            aiMessageContent.classList.add('markdown-body'); // 确保流式渲染的容器也有markdown-body类
            let accumulatedText = ''

            // 显示加载动画
            const loadingDiv = document.createElement('div')
            loadingDiv.className = 'ai-loading-animation text-xs text-gray-400 mt-2'
            loadingDiv.innerHTML = '<span class="dot">AI正在思考<span class="dot-ani">...</span></span>'
            aiMessageContent.appendChild(loadingDiv)

            // 处理流式响应
            console.log('ChatManager: 处理流式响应')
            const reader = response.body.getReader()
            for await (const chunk of readStream(reader)) {
                if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                    accumulatedText += chunk.choices[0].delta.content
                    aiMessageContent.innerHTML = marked.parse(accumulatedText)
                    
                    // 代码高亮
                    aiMessageContent.querySelectorAll('pre code').forEach((block) => {
                        try {
                            if (hljs && hljs.highlightElement) {
                                hljs.highlightElement(block);
                            }
                        } catch (e) {
                            console.error('Highlighting error:', e)
                        }
                    })

                    // 滚动到底部
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
                }
            }
            // 移除加载动画
            if (aiMessageContent.querySelector('.ai-loading-animation')) {
                aiMessageContent.querySelector('.ai-loading-animation').remove()
            }
            console.log('ChatManager: 响应处理完成')
            // 记录AI响应内容
            this.logAIResponse(accumulatedText);

            // 解析响应文本，查找命令和动作标签
            const commandRegex = /<runCommand>(.*?)<\/runCommand>/s;
            const actionRegex = /<runQuickerAction>(.*?)<\/runQuickerAction>/s;
            const thinkRegex = /<think>([\s\S]*?)<\/think>/gs;
            const taskCompleteRegex = /<taskComplete>([\s\S]*?)<\/taskComplete>/gs;
            
            console.log('ChatManager: 开始解析AI响应文本，长度:', accumulatedText.length);
            
            // 初始化显示文本
            let displayedText = accumulatedText;
            
            // 处理思考过程
            const thinkMatches = [...displayedText.matchAll(thinkRegex)];
            if (thinkMatches.length > 0) {
                console.log(`ChatManager: 发现 ${thinkMatches.length} 个思考过程`);
                // 创建思考日志记录
                let thinkingLogs = '';
                thinkMatches.forEach((match, index) => {
                    const thinkContent = match[1];
                    console.log(`ChatManager: 思考内容 ${index+1}: ${thinkContent.substring(0, 100)}${thinkContent.length > 100 ? '...' : ''}`);
                    thinkingLogs += `思考${index+1}:\n${thinkContent}\n\n`;
                });
                // 记录思考日志
                console.log('ChatManager: AI思考过程完整记录:', thinkingLogs);
                
                // 不再移除思考标签内容，而是替换为格式化的文本
                displayedText = displayedText.replace(thinkRegex, (match, p1) => {
                    return `**思考过程:**\n\n${p1}\n\n**回答:**\n\n`;
                });
                console.log('ChatManager: 已将思考内容格式化为可读形式');
            }
            
            // 处理任务完成标签
            const taskCompleteMatches = [...displayedText.matchAll(taskCompleteRegex)];
            if (taskCompleteMatches.length > 0) {
                console.log(`ChatManager: 发现 ${taskCompleteMatches.length} 个任务完成标签`);
                
                // 替换任务完成标签，保留内容但去除标签本身
                displayedText = displayedText.replace(taskCompleteRegex, (match, p1) => p1.trim());
                console.log('ChatManager: 已处理任务完成标签，保留内容但去除标签');
            }
            
            // 优先处理上下文窗口读写工具
            // 处理读取关联窗口内容
            const readWindowMatch = readContextWindowRegex.exec(accumulatedText);
            if (readWindowMatch) {
                console.log('ChatManager: 准备读取关联窗口内容');
                displayedText = accumulatedText.replace(readContextWindowRegex, ''); // 移除工具标签
                
                try {
                    // 导入并调用读取窗口内容功能
                    console.log(`ChatManager: 导入readContextWindow函数`);
                    const { readContextWindow, displayWindowOperationResult } = await import('./window_operations.js');
                    console.log(`ChatManager: 调用readContextWindow函数`);
                    const result = await readContextWindow();
                    console.log(`ChatManager: readContextWindow执行完成，结果:`, result);
                    
                    // 显示操作结果
                    console.log(`ChatManager: 显示窗口读取结果`);
                    displayWindowOperationResult(result, '读取');
                    
                    // 检查是否需要将结果返回给AI继续处理
                    if (!accumulatedText.includes('<taskComplete>')) {
                        console.log('ChatManager: 窗口读取后需要继续与AI交互');
                        // 构建工具结果消息 - 但不添加到UI中显示
                        const toolResultMessage = `type:text\ntext:[tool for 'readContextWindow'] Result:"${
                            result.success 
                                ? '窗口内容读取成功:\n' + result.content.replace(/"/g, '\\"') 
                                : '窗口内容读取失败: ' + result.error.replace(/"/g, '\\"')
                        }"`;
                        console.log('ChatManager: 添加窗口读取结果消息:', toolResultMessage.substring(0, 100) + '...');
                        
                        // 不在UI显示工具结果消息，只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        
                        await this.processToolResult();
                    }
                } catch (error) {
                    console.error(`ChatManager: 窗口内容读取处理出错:`, error);
                    // 导入工具显示错误信息
                    const { addExecutionResultMessage } = await import('./utils.js');
                    addExecutionResultMessage({
                        success: false,
                        operation: '读取窗口内容',
                        error: error.message || '未知错误'
                    }, '窗口操作');
                }
                
                // 所有标签处理完成后，更新UI显示文本
                aiMessageContent.innerHTML = marked.parse(displayedText);
                console.log(`ChatManager: 窗口内容读取处理完成`);
                return;
            }

            // 处理写入内容到关联窗口
            const writeWindowMatch = writeToContextWindowRegex.exec(accumulatedText);
            if (writeWindowMatch && writeWindowMatch[1]) {
                console.log('ChatManager: 准备写入内容到关联窗口');
                
                // 解析写入参数
                try {
                    // 提取内容、模式和位置
                    const contentMatch = /<content>([\s\S]*?)<\/content>/gs.exec(writeWindowMatch[1]);
                    const modeMatch = /<mode>([\s\S]*?)<\/mode>/gs.exec(writeWindowMatch[1]);
                    const positionMatch = /<position>([\s\S]*?)<\/position>/gs.exec(writeWindowMatch[1]);
                    
                    // 获取内容（必须）
                    if (!contentMatch || !contentMatch[1]) {
                        throw new Error('写入内容未提供');
                    }
                    const content = contentMatch[1].trim();
                    
                    // 获取模式（可选）
                    const mode = modeMatch && modeMatch[1] ? modeMatch[1].trim() : 'append';
                    
                    // 获取位置（可选）
                    const position = positionMatch && positionMatch[1] ? positionMatch[1].trim() : 'end';
                    
                    // 移除工具标签
                    displayedText = accumulatedText.replace(writeToContextWindowRegex, '');
                    
                    // 导入并调用写入窗口内容功能
                    console.log(`ChatManager: 导入writeToContextWindow函数，参数:`, { content, mode, position });
                    const { writeToContextWindow, displayWindowOperationResult } = await import('./window_operations.js');
                    console.log(`ChatManager: 调用writeToContextWindow函数`);
                    const result = await writeToContextWindow({ content, mode, position });
                    console.log(`ChatManager: writeToContextWindow执行完成，结果:`, result);
                    
                    // 显示操作结果
                    console.log(`ChatManager: 显示窗口写入结果`);
                    displayWindowOperationResult(result, '写入');
                    
                    // 检查是否需要将结果返回给AI继续处理
                    if (!accumulatedText.includes('<taskComplete>')) {
                        console.log('ChatManager: 窗口写入后需要继续与AI交互');
                        // 构建工具结果消息 - 但不添加到UI中显示
                        const toolResultMessage = `type:text\ntext:[tool for 'writeToContextWindow'] Result:"${
                            result.success 
                                ? '内容写入成功: ' + (result.message || '操作完成').replace(/"/g, '\\"') 
                                : '内容写入失败: ' + result.error.replace(/"/g, '\\"')
                        }"`;
                        console.log('ChatManager: 添加窗口写入结果消息:', toolResultMessage.substring(0, 100) + '...');
                        
                        // 不在UI显示工具结果消息，只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        
                        await this.processToolResult();
                    }
                } catch (error) {
                    console.error(`ChatManager: 窗口内容写入处理出错:`, error);
                    // 导入工具显示错误信息
                    const { addExecutionResultMessage } = await import('./utils.js');
                    addExecutionResultMessage({
                        success: false,
                        operation: '写入窗口内容',
                        error: error.message || '未知错误'
                    }, '窗口操作');
                }
                
                // 所有标签处理完成后，更新UI显示文本
                aiMessageContent.innerHTML = marked.parse(displayedText);
                console.log(`ChatManager: 窗口内容写入处理完成`);
                return;
            }
            
            // 所有标签处理完成后，更新UI显示文本
            aiMessageContent.innerHTML = marked.parse(displayedText);
            
            const commandMatch = accumulatedText.match(commandRegex);
            const actionMatch = accumulatedText.match(actionRegex);
            
            console.log('ChatManager: 命令匹配结果:', commandMatch ? `找到命令: ${commandMatch[1]}` : '未找到命令');
            console.log('ChatManager: 动作匹配结果:', actionMatch ? `找到动作: ${actionMatch[1]}` : '未找到动作');
            console.log('ChatManager: 命令执行状态:', toggleManager.isCommandExecutionEnabled());
            console.log('ChatManager: 动作执行状态:', toggleManager.isActionExecutionEnabled());

            // 处理命令执行
            if (commandMatch && commandMatch[1] && toggleManager.isCommandExecutionEnabled()) {
                console.log('ChatManager: 准备执行命令')
                const command = commandMatch[1].trim()
                displayedText = accumulatedText.replace(commandRegex, '') // 移除命令标签
                
                try {
                    // 执行命令
                    console.log(`ChatManager: 导入executeCommand函数`);
                    const { executeCommand } = await import('./command.js')
                    console.log(`ChatManager: 调用executeCommand函数，命令: "${command}"`);
                    const result = await executeCommand(command)
                    console.log(`ChatManager: executeCommand执行完成，结果:`, result);
                    
                    // 存储命令结果
                    this.lastCommandResult = `命令: \`${result.command}\`\n状态: ${
                        result.success ? '成功' : '失败'
                    }\n${
                        result.output ? '标准输出:\n' + result.output : ''
                    }${
                        result.error ? '\n错误信息:\n' + result.error : ''
                    }`
                    console.log(`ChatManager: 已存储命令结果`);
                    
                    // 显示命令执行结果
                    console.log(`ChatManager: 导入addExecutionResultMessage函数`);
                    const { addExecutionResultMessage } = await import('./utils.js')
                    console.log(`ChatManager: 调用addExecutionResultMessage函数`);
                    addExecutionResultMessage(result, '命令')
                    console.log(`ChatManager: 命令执行结果已显示`);
                    
                    // 检查是否需要将结果返回给AI继续处理
                    if (!accumulatedText.includes('<taskComplete>')) {
                        console.log('ChatManager: 命令执行后需要继续与AI交互');
                        // 构建工具结果消息 - 但不添加到UI中显示
                        const toolResultMessage = `type:text\ntext:[tool for 'run_command'] Result:"${this.lastCommandResult.replace(/"/g, '\\"')}"`;
                        console.log('ChatManager: 添加工具结果消息:', toolResultMessage.substring(0, 100) + '...');
                        
                        // 不在UI显示工具结果消息，只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        
                        await this.processToolResult();
                    }
                } catch (error) {
                    console.error(`ChatManager: 执行命令过程中出错:`, error);
                    const errorResult = {
                        success: false,
                        command: command,
                        output: '',
                        error: error.message || '执行命令过程中出错'
                    };
                    
                    // 存储错误结果
                    this.lastCommandResult = `命令执行失败: ${errorResult.error}`;
                    
                    // 显示错误结果
                    try {
                        const { addExecutionResultMessage } = await import('./utils.js');
                        addExecutionResultMessage(errorResult, '命令');
                        
                        // 即使出错也需要将结果返回给AI，但不在UI中显示
                        if (!accumulatedText.includes('<taskComplete>')) {
                            const toolResultMessage = `type:text\ntext:[tool for 'run_command'] Result:"命令执行失败: ${errorResult.error.replace(/"/g, '\\"')}"`;
                            // 只添加到消息历史
                            this.messages.push({ role: 'user', content: toolResultMessage });
                            await this.processToolResult();
                        }
                    } catch (e) {
                        console.error('ChatManager: 显示错误消息时出错:', e);
                    }
                }
            }
            // 递归处理动作执行
            else if (actionMatch && actionMatch[1] && toggleManager.isActionExecutionEnabled()) {
                const actionName = actionMatch[1].trim();
                displayedText = accumulatedText.replace(actionRegex, ''); // 移除动作标签
                
                // 检查动作是否存在
                const actions = actionManager.getActions();
                if (actions.some(a => a.name === actionName)) {
                    // 执行动作
                    console.log(`ChatManager: 执行动作 "${actionName}"`);
                    const actionResult = await actionManager.executeAction(actionName);
                    
                    // 获取动作执行结果并存储
                    this.lastActionResult = actionResult?.output || `动作: "${actionName}" 已执行`;
                    
                    // 显示动作执行结果 - executeAction内部已经调用了addExecutionResultMessage
                    
                    // 检查是否需要将结果返回给AI继续处理
                    if (!accumulatedText.includes('<taskComplete>')) {
                        console.log('ChatManager: 动作执行后需要继续与AI交互');
                        // 构建工具结果消息 - 但不添加到UI中显示
                        const toolResultMessage = `type:text\ntext:[tool for 'runQuickerAction'] Result:"${this.lastActionResult.replace(/"/g, '\\"')}"`;
                        console.log('ChatManager: 添加动作结果消息:', toolResultMessage.substring(0, 100) + '...');
                        
                        // 不在UI显示工具结果消息，只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        
                        await this.processToolResult();
                    }
                } else {
                    // 动作不存在，手动创建错误消息
                    console.log(`ChatManager: 动作 "${actionName}" 不存在`);
                    const errorMessage = {
                        success: false, 
                        action: actionName,
                        error: `错误：尝试执行未定义的动作 "${actionName}"。请从可用动作列表中选择。` 
                    };
                    
                    // 存储错误结果
                    this.lastActionResult = `动作执行尝试失败: 未定义的动作 "${actionName}"`;
                    
                    // 显示错误结果
                    const { addExecutionResultMessage } = await import('./utils.js');
                    addExecutionResultMessage(errorMessage, '动作');
                    
                    // 即使出错也需要将结果返回给AI，但不在UI中显示
                    if (!accumulatedText.includes('<taskComplete>')) {
                        const toolResultMessage = `type:text\ntext:[tool for 'runQuickerAction'] Result:"动作执行失败: 未定义的动作 ${actionName.replace(/"/g, '\\"')}"`;
                        // 只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        await this.processToolResult();
                    }
                }
            } else {
                // 没有检测到命令或动作，完成处理
                displayedText = accumulatedText;
                
                // 将最终结果添加到消息历史
                this.messages.push({ role: 'assistant', content: displayedText });
            }

            // 在流式响应成功完成后
            this.lastFailedUserMessage = null;
            this.isRetrying = false;

        } catch (error) {
            // 移除加载动画
            const aiMessageContent = document.querySelector('.message-content.markdown-body:last-child');
            if (aiMessageContent && aiMessageContent.querySelector('.ai-loading-animation')) {
                aiMessageContent.querySelector('.ai-loading-animation').remove();
            }
            console.error('ChatManager: 发送消息出错:', error);
            this.isProcessing = false;
            this.isRetrying = false;
            this.messageInput.disabled = false;
            this.lastFailedUserMessage = text;
            this.displayRetryOption(error.message || '未知网络错误');
        } finally {
            // 恢复发送按钮为飞机图标
            if (this.sendButton) {
                this.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
                this.sendButton.classList.remove('bg-red-500', 'text-white');
                this.sendButton.classList.add('bg-white', 'hover:bg-gray-100', 'text-gray-800');
                this.sendButton.onclick = (event) => {
                    event.preventDefault();
                    this.handleSendMessage();
                };
            }
            this.abortController = null;
            if (!this.isRetrying) {
                this.isProcessing = false;
                this.messageInput.disabled = false;
            }
        }
    }

    // 清空消息
    clearMessages() {
        this.messages = []
        this.messagesContainer.innerHTML = ''

        // 添加欢迎消息
        const welcomeMessage = `<div class="message-animation max-w-3xl mx-auto">
            <div class="bg-white p-5 rounded-2xl shadow-sm">
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <i class="fas fa-robot text-gray-500"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-gray-500 mb-1">AI 助手</p>
                        <p class="text-gray-700">你好！我是你的 AI 助手。有什么我可以帮你的吗？</p>
                    </div>
                </div>
            </div>
        </div>`;
        this.messagesContainer.innerHTML = welcomeMessage;
    }

    // 辅助函数：输出AI响应的内容，帮助调试
    logAIResponse(text) {
        console.log('--- AI响应内容开始 ---');
        // 检查是否包含命令标记
        if (text.includes('<runCommand>')) {
            console.log('包含命令标记 <runCommand>');
        }
        // 检查是否包含动作标记
        if (text.includes('<runQuickerAction>')) {
            console.log('包含动作标记 <runQuickerAction>');
        }
        // 检查是否包含思考标记
        if (text.includes('<think>')) {
            console.log('包含思考标记 <think>');
        }
        // 检查是否包含任务完成标记
        if (text.includes('<taskComplete>')) {
            console.log('包含任务完成标记 <taskComplete>');
        }
        // 输出前50个字符作为预览
        console.log('响应前50个字符:', text.substring(0, 50));
        console.log('--- AI响应内容结束 ---');
    }

    // 处理发送消息
    async handleSendMessage() {
        if (this.isProcessing) return
        
        const text = this.messageInput.value.trim()
        if (!text) return
        
        console.log('ChatManager: handleSendMessage 被调用')
        
        // 简单检测是否是动作或命令
        if (text.startsWith('执行动作：') || text.startsWith('执行动作:')) {
            const actionName = text.replace(/^执行动作[：:]\s*/, '').trim();
            console.log(`ChatManager: 检测到动作执行指令，动作名称: "${actionName}"`);
        } else if (text.startsWith('运行命令') || text.startsWith('执行命令')) {
            const commandPart = text.replace(/^(运行|执行)命令[\s:：]*/i, '').trim();
            console.log(`ChatManager: 检测到命令执行指令，命令: "${commandPart}"`);
        }
        
        console.log('ChatManager: 准备发送消息', text)
        this.messageInput.value = ''

        // 自动调整输入框高度
        this.messageInput.style.height = 'auto'
        
        try {
            await this.sendMessage(text)
        } catch (error) {
            console.error('ChatManager: 发送消息时发生错误', error)
            const errorDiv = document.createElement('div')
            errorDiv.className = 'text-red-500 text-sm mt-2'
            errorDiv.textContent = `发送消息错误: ${error.message || '未知错误'}`
            this.messagesContainer.appendChild(errorDiv)
        }
    }

    // 处理工具调用结果并获取AI回复
    async processToolResult() {
        console.log('ChatManager: 开始处理工具调用结果');
        
        try {
            // 获取当前设置
            console.log('ChatManager: 获取设置');
            const settings = settingsManager.getCurrentSettings();

            // 获取上下文状态
            console.log('ChatManager: 获取上下文状态');
            const contextState = contextManager.getContextState();
            
            // 构建系统提示词
            console.log('ChatManager: 构建系统提示词');
            const systemPrompts = [];
            
            // 添加AI思考提示词
            if (AI_THINKING.enabled) {
                console.log('ChatManager: 添加AI思考提示词到系统提示词');
                
                // 获取上下文信息，用于替换占位符
                const contextInfoText = this.generateContextInfoText(contextState);
                
                // 替换占位符
                let systemPromptWithContext = AI_THINKING.systemPrompt.replace('{{CONTEXT_INFO}}', contextInfoText);
                console.log('ChatManager: 已替换系统提示词中的占位符');
                
                // 添加到系统提示词数组
                systemPrompts.push(systemPromptWithContext);
            } else {
                console.log('ChatManager: AI思考功能未启用，跳过添加系统提示词');
            }
            
            // 添加上次命令结果（如果有）
            if (this.lastCommandResult) {
                console.log('ChatManager: 添加上次命令执行结果到系统提示词');
                systemPrompts.push(`上次命令执行结果:\n${this.lastCommandResult}`);
            }
            
            // 添加上次动作结果（如果有）
            if (this.lastActionResult) {
                console.log('ChatManager: 添加上次动作执行结果到系统提示词');
                systemPrompts.push(`上次动作执行结果:\n${this.lastActionResult}`);
            }
            
            // 添加命令执行提示词（如果功能开启）
            let isCommandEnabled = false;
            try {
                // 首先检查按钮的UI状态
                const cmdButton = document.getElementById('toggle-run-command-button');
                if (cmdButton) {
                    const uiActive = cmdButton.classList.contains('context-active');
                    console.log(`ChatManager: 命令执行按钮UI状态: ${uiActive}`);
                    isCommandEnabled = uiActive;
                } else {
                    // 如果按钮不存在，使用toggleManager状态
                    isCommandEnabled = toggleManager.isCommandExecutionEnabled();
                }
            } catch (error) {
                console.error('ChatManager: 检查命令执行状态出错:', error);
                // 出错时使用toggleManager状态
                isCommandEnabled = toggleManager.isCommandExecutionEnabled();
            }
            
            if (isCommandEnabled && AI_THINKING.enabled) {
                console.log('ChatManager: 命令执行已启用');
            } else {
                console.log(`ChatManager: 命令执行未启用(${isCommandEnabled})，跳过添加`);
            }
            
            // 添加动作执行提示词（如果功能开启）
            const isActionEnabled = toggleManager.isActionExecutionEnabled();
            console.log(`ChatManager: 检查动作执行状态: ${isActionEnabled}`);
            
            if (isActionEnabled) {
                const availableActions = actionManager.getActions().map(action => action.name);
                console.log(`ChatManager: 可用动作数量: ${availableActions.length}`);
                if (availableActions.length > 0) {
                    // 将可用动作列表添加到系统提示词
                    const actionListText = `可用动作列表:\n${availableActions.map(action => `- ${action}`).join('\n')}`;
                    systemPrompts.push(actionListText);
                    console.log('ChatManager: 添加动作列表到系统提示词');
                }
            }
            
            // 添加上下文（如果激活）
            if (contextState && contextState.isActive) {
                console.log(`ChatManager: 添加上下文到系统提示词: ${contextState.title}`);
                
                // 创建包含更多详细信息的上下文提示词
                const contextPrompt = [
                    `===== 当前窗口上下文信息 =====`,
                    `窗口标题: ${contextState.title}`,
                    `窗口内容:\n${contextState.content}`,
                ].join('\n');
                
                // 尝试添加更多上下文信息（如果存在）
                try {
                    // 检查是否有额外的元数据可用
                    if (contextState.metadata) {
                        console.log('ChatManager: 添加额外的上下文元数据');
                        let metadataPrompt = [
                            ``,
                            `===== 程序信息 =====`,
                            `程序名称: ${contextState.metadata.processName || '未知'}`,
                            `程序路径: ${contextState.metadata.processPath || '未知'}`,
                            `程序描述: ${contextState.metadata.processDescription || '未知'}`
                        ];
                        
                        // 添加窗口矩形信息（如果有）
                        if (contextState.metadata.windowRect) {
                            metadataPrompt.push('');
                            metadataPrompt.push('===== 窗口位置信息 =====');
                            metadataPrompt.push(`窗口矩形: ${JSON.stringify(contextState.metadata.windowRect)}`);
                        }
                        
                        // 添加窗口类名信息（如果有）
                        if (contextState.metadata.windowClass) {
                            if (!contextState.metadata.windowRect) {
                                metadataPrompt.push('');
                                metadataPrompt.push('===== 窗口属性信息 =====');
                            }
                            metadataPrompt.push(`窗口类名: ${contextState.metadata.windowClass}`);
                        }
                        
                        systemPrompts.push(contextPrompt + metadataPrompt.join('\n'));
                    } else {
                        // 如果没有额外元数据，只添加基本上下文
                        systemPrompts.push(contextPrompt);
                    }
                } catch (error) {
                    console.warn('ChatManager: 添加上下文元数据时出错:', error);
                    // 出错时只添加基本上下文
                    systemPrompts.push(contextPrompt);
                }
                
                console.log('ChatManager: 已添加上下文信息到系统提示词');
            }
            
            // 添加用户自定义系统提示词
            if (Array.isArray(settings.systemPrompts)) {
                console.log(`ChatManager: 添加 ${settings.systemPrompts.length} 个用户自定义系统提示词`);
                settings.systemPrompts.forEach(prompt => {
                    if (prompt && typeof prompt === 'string') {
                        systemPrompts.push(prompt);
                    }
                });
            }

            // 构建完整消息列表
            console.log(`ChatManager: 构建完整消息列表，系统提示词数量: ${systemPrompts.length}`);
            const systemContent = systemPrompts.join('\n\n');
            console.log(`ChatManager: 系统提示词总长度: ${systemContent.length} 字符`);
            
            const fullMessages = [
                { role: 'system', content: systemContent },
                ...this.messages
            ];

            // 发送请求
            console.log('ChatManager: 发送 API 请求来处理工具结果');
            const response = await fetch(settings.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: settings.model,
                    messages: fullMessages,
                    temperature: settings.temperature,
                    stream: true
                }),
                signal: this.abortController?.signal // 传入中断信号
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 创建 AI 消息元素
            console.log('ChatManager: 创建 AI 消息元素');
            const aiMessageDiv = this.addMessage('assistant', '');
            const aiMessageContent = aiMessageDiv.querySelector('.message-content');
            aiMessageContent.classList.add('markdown-body'); // 确保流式渲染的容器也有markdown-body类
            let accumulatedText = '';

            // 显示加载动画
            const loadingDiv = document.createElement('div')
            loadingDiv.className = 'ai-loading-animation text-xs text-gray-400 mt-2'
            loadingDiv.innerHTML = '<span class="dot">AI正在思考<span class="dot-ani">...</span></span>'
            aiMessageContent.appendChild(loadingDiv)

            // 处理流式响应
            console.log('ChatManager: 处理流式响应')
            const reader = response.body.getReader()
            for await (const chunk of readStream(reader)) {
                if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                    accumulatedText += chunk.choices[0].delta.content
                    aiMessageContent.innerHTML = marked.parse(accumulatedText)
                    
                    // 代码高亮
                    aiMessageContent.querySelectorAll('pre code').forEach((block) => {
                        try {
                            if (hljs && hljs.highlightElement) {
                                hljs.highlightElement(block);
                            }
                        } catch (e) {
                            console.error('Highlighting error:', e);
                        }
                    })

                    // 滚动到底部
                    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
                }
            }
            // 移除加载动画
            if (aiMessageContent.querySelector('.ai-loading-animation')) {
                aiMessageContent.querySelector('.ai-loading-animation').remove()
            }
            console.log('ChatManager: 响应处理完成')
            // 记录AI响应内容
            this.logAIResponse(accumulatedText);

            // 解析响应文本，查找命令和动作标签
            const commandRegex = /<runCommand>(.*?)<\/runCommand>/s;
            const actionRegex = /<runQuickerAction>(.*?)<\/runQuickerAction>/s;
            const thinkRegex = /<think>([\s\S]*?)<\/think>/gs;
            const taskCompleteRegex = /<taskComplete>([\s\S]*?)<\/taskComplete>/gs;
            
            console.log('ChatManager: 开始解析AI响应文本，长度:', accumulatedText.length);
            
            // 初始化显示文本
            let displayedText = accumulatedText;
            
            // 处理思考过程
            const thinkMatches = [...displayedText.matchAll(thinkRegex)];
            if (thinkMatches.length > 0) {
                console.log(`ChatManager: 发现 ${thinkMatches.length} 个思考过程`);
                // 创建思考日志记录
                let thinkingLogs = '';
                thinkMatches.forEach((match, index) => {
                    const thinkContent = match[1];
                    console.log(`ChatManager: 思考内容 ${index+1}: ${thinkContent.substring(0, 100)}${thinkContent.length > 100 ? '...' : ''}`);
                    thinkingLogs += `思考${index+1}:\n${thinkContent}\n\n`;
                });
                // 记录思考日志
                console.log('ChatManager: AI思考过程完整记录:', thinkingLogs);
                
                // 不再移除思考标签内容，而是替换为格式化的文本
                displayedText = displayedText.replace(thinkRegex, (match, p1) => {
                    return `**思考过程:**\n\n${p1}\n\n**回答:**\n\n`;
                });
                console.log('ChatManager: 已将思考内容格式化为可读形式');
            }
            
            // 处理任务完成标签
            const taskCompleteMatches = [...displayedText.matchAll(taskCompleteRegex)];
            if (taskCompleteMatches.length > 0) {
                console.log(`ChatManager: 发现 ${taskCompleteMatches.length} 个任务完成标签`);
                
                // 替换任务完成标签，保留内容但去除标签本身
                displayedText = displayedText.replace(taskCompleteRegex, (match, p1) => p1.trim());
                console.log('ChatManager: 已处理任务完成标签，保留内容但去除标签');
            }
            
            // 优先处理上下文窗口读写工具
            // 处理读取关联窗口内容
            const readWindowMatch = readContextWindowRegex.exec(accumulatedText);
            if (readWindowMatch) {
                console.log('ChatManager: 准备读取关联窗口内容');
                displayedText = accumulatedText.replace(readContextWindowRegex, ''); // 移除工具标签
                
                try {
                    // 导入并调用读取窗口内容功能
                    console.log(`ChatManager: 导入readContextWindow函数`);
                    const { readContextWindow, displayWindowOperationResult } = await import('./window_operations.js');
                    console.log(`ChatManager: 调用readContextWindow函数`);
                    const result = await readContextWindow();
                    console.log(`ChatManager: readContextWindow执行完成，结果:`, result);
                    
                    // 显示操作结果
                    console.log(`ChatManager: 显示窗口读取结果`);
                    displayWindowOperationResult(result, '读取');
                    
                    // 检查是否需要将结果返回给AI继续处理
                    if (!accumulatedText.includes('<taskComplete>')) {
                        console.log('ChatManager: 窗口读取后需要继续与AI交互');
                        // 构建工具结果消息 - 但不添加到UI中显示
                        const toolResultMessage = `type:text\ntext:[tool for 'readContextWindow'] Result:"${
                            result.success 
                                ? '窗口内容读取成功:\n' + result.content.replace(/"/g, '\\"') 
                                : '窗口内容读取失败: ' + result.error.replace(/"/g, '\\"')
                        }"`;
                        console.log('ChatManager: 添加窗口读取结果消息:', toolResultMessage.substring(0, 100) + '...');
                        
                        // 不在UI显示工具结果消息，只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        
                        await this.processToolResult();
                    }
                } catch (error) {
                    console.error(`ChatManager: 窗口内容读取处理出错:`, error);
                    // 导入工具显示错误信息
                    const { addExecutionResultMessage } = await import('./utils.js');
                    addExecutionResultMessage({
                        success: false,
                        operation: '读取窗口内容',
                        error: error.message || '未知错误'
                    }, '窗口操作');
                }
                
                // 所有标签处理完成后，更新UI显示文本
                aiMessageContent.innerHTML = marked.parse(displayedText);
                console.log(`ChatManager: 窗口内容读取处理完成`);
                return;
            }

            // 处理写入内容到关联窗口
            const writeWindowMatch = writeToContextWindowRegex.exec(accumulatedText);
            if (writeWindowMatch && writeWindowMatch[1]) {
                console.log('ChatManager: 准备写入内容到关联窗口');
                
                // 解析写入参数
                try {
                    // 提取内容、模式和位置
                    const contentMatch = /<content>([\s\S]*?)<\/content>/gs.exec(writeWindowMatch[1]);
                    const modeMatch = /<mode>([\s\S]*?)<\/mode>/gs.exec(writeWindowMatch[1]);
                    const positionMatch = /<position>([\s\S]*?)<\/position>/gs.exec(writeWindowMatch[1]);
                    
                    // 获取内容（必须）
                    if (!contentMatch || !contentMatch[1]) {
                        throw new Error('写入内容未提供');
                    }
                    const content = contentMatch[1].trim();
                    
                    // 获取模式（可选）
                    const mode = modeMatch && modeMatch[1] ? modeMatch[1].trim() : 'append';
                    
                    // 获取位置（可选）
                    const position = positionMatch && positionMatch[1] ? positionMatch[1].trim() : 'end';
                    
                    // 移除工具标签
                    displayedText = accumulatedText.replace(writeToContextWindowRegex, '');
                    
                    // 导入并调用写入窗口内容功能
                    console.log(`ChatManager: 导入writeToContextWindow函数，参数:`, { content, mode, position });
                    const { writeToContextWindow, displayWindowOperationResult } = await import('./window_operations.js');
                    console.log(`ChatManager: 调用writeToContextWindow函数`);
                    const result = await writeToContextWindow({ content, mode, position });
                    console.log(`ChatManager: writeToContextWindow执行完成，结果:`, result);
                    
                    // 显示操作结果
                    console.log(`ChatManager: 显示窗口写入结果`);
                    displayWindowOperationResult(result, '写入');
                    
                    // 检查是否需要将结果返回给AI继续处理
                    if (!accumulatedText.includes('<taskComplete>')) {
                        console.log('ChatManager: 窗口写入后需要继续与AI交互');
                        // 构建工具结果消息 - 但不添加到UI中显示
                        const toolResultMessage = `type:text\ntext:[tool for 'writeToContextWindow'] Result:"${
                            result.success 
                                ? '内容写入成功: ' + (result.message || '操作完成').replace(/"/g, '\\"') 
                                : '内容写入失败: ' + result.error.replace(/"/g, '\\"')
                        }"`;
                        console.log('ChatManager: 添加窗口写入结果消息:', toolResultMessage.substring(0, 100) + '...');
                        
                        // 不在UI显示工具结果消息，只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        
                        await this.processToolResult();
                    }
                } catch (error) {
                    console.error(`ChatManager: 窗口内容写入处理出错:`, error);
                    // 导入工具显示错误信息
                    const { addExecutionResultMessage } = await import('./utils.js');
                    addExecutionResultMessage({
                        success: false,
                        operation: '写入窗口内容',
                        error: error.message || '未知错误'
                    }, '窗口操作');
                }
                
                // 所有标签处理完成后，更新UI显示文本
                aiMessageContent.innerHTML = marked.parse(displayedText);
                console.log(`ChatManager: 窗口内容写入处理完成`);
                return;
            }
            
            // 所有标签处理完成后，更新UI显示文本
            aiMessageContent.innerHTML = marked.parse(displayedText);
            
            const commandMatch = accumulatedText.match(commandRegex);
            const actionMatch = accumulatedText.match(actionRegex);
            
            console.log('ChatManager: 命令匹配结果:', commandMatch ? `找到命令: ${commandMatch[1]}` : '未找到命令');
            console.log('ChatManager: 动作匹配结果:', actionMatch ? `找到动作: ${actionMatch[1]}` : '未找到动作');
            console.log('ChatManager: 命令执行状态:', toggleManager.isCommandExecutionEnabled());
            console.log('ChatManager: 动作执行状态:', toggleManager.isActionExecutionEnabled());

            // 递归处理命令执行
            if (commandMatch && commandMatch[1] && toggleManager.isCommandExecutionEnabled()) {
                console.log('ChatManager: 准备执行命令');
                const command = commandMatch[1].trim();
                displayedText = accumulatedText.replace(commandRegex, ''); // 移除命令标签
                
                try {
                    // 执行命令
                    console.log(`ChatManager: 导入executeCommand函数`);
                    const { executeCommand } = await import('./command.js');
                    console.log(`ChatManager: 调用executeCommand函数，命令: "${command}"`);
                    const result = await executeCommand(command);
                    console.log(`ChatManager: executeCommand执行完成，结果:`, result);
                    
                    // 存储命令结果
                    this.lastCommandResult = `命令: \`${result.command}\`\n状态: ${
                        result.success ? '成功' : '失败'
                    }\n${
                        result.output ? '标准输出:\n' + result.output : ''
                    }${
                        result.error ? '\n错误信息:\n' + result.error : ''
                    }`;
                    console.log(`ChatManager: 已存储命令结果`);
                    
                    // 显示命令执行结果
                    console.log(`ChatManager: 导入addExecutionResultMessage函数`);
                    const { addExecutionResultMessage } = await import('./utils.js');
                    console.log(`ChatManager: 调用addExecutionResultMessage函数`);
                    addExecutionResultMessage(result, '命令');
                    console.log(`ChatManager: 命令执行结果已显示`);
                    
                    // 检查是否需要将结果返回给AI继续处理
                    if (!accumulatedText.includes('<taskComplete>')) {
                        console.log('ChatManager: 命令执行后需要继续与AI交互');
                        // 构建工具结果消息 - 但不添加到UI中显示
                        const toolResultMessage = `type:text\ntext:[tool for 'run_command'] Result:"${this.lastCommandResult.replace(/"/g, '\\"')}"`;
                        console.log('ChatManager: 添加工具结果消息:', toolResultMessage.substring(0, 100) + '...');
                        
                        // 不在UI显示工具结果消息，只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        
                        await this.processToolResult();
                    }
                } catch (error) {
                    console.error(`ChatManager: 执行命令过程中出错:`, error);
                    const errorResult = {
                        success: false,
                        command: command,
                        output: '',
                        error: error.message || '执行命令过程中出错'
                    };
                    
                    // 存储错误结果
                    this.lastCommandResult = `命令执行失败: ${errorResult.error}`;
                    
                    // 显示错误结果
                    try {
                        const { addExecutionResultMessage } = await import('./utils.js');
                        addExecutionResultMessage(errorResult, '命令');
                        
                        // 即使出错也需要将结果返回给AI，但不在UI中显示
                        if (!accumulatedText.includes('<taskComplete>')) {
                            const toolResultMessage = `type:text\ntext:[tool for 'run_command'] Result:"命令执行失败: ${errorResult.error.replace(/"/g, '\\"')}"`;
                            // 只添加到消息历史
                            this.messages.push({ role: 'user', content: toolResultMessage });
                            await this.processToolResult();
                        }
                    } catch (e) {
                        console.error('ChatManager: 显示错误消息时出错:', e);
                    }
                }
            }
            // 递归处理动作执行
            else if (actionMatch && actionMatch[1] && toggleManager.isActionExecutionEnabled()) {
                const actionName = actionMatch[1].trim();
                displayedText = accumulatedText.replace(actionRegex, ''); // 移除动作标签
                
                // 检查动作是否存在
                const actions = actionManager.getActions();
                if (actions.some(a => a.name === actionName)) {
                    // 执行动作
                    console.log(`ChatManager: 执行动作 "${actionName}"`);
                    const actionResult = await actionManager.executeAction(actionName);
                    
                    // 获取动作执行结果并存储
                    this.lastActionResult = actionResult?.output || `动作: "${actionName}" 已执行`;
                    
                    // 显示动作执行结果 - executeAction内部已经调用了addExecutionResultMessage
                    
                    // 检查是否需要将结果返回给AI继续处理
                    if (!accumulatedText.includes('<taskComplete>')) {
                        console.log('ChatManager: 动作执行后需要继续与AI交互');
                        // 构建工具结果消息 - 但不添加到UI中显示
                        const toolResultMessage = `type:text\ntext:[tool for 'runQuickerAction'] Result:"${this.lastActionResult.replace(/"/g, '\\"')}"`;
                        console.log('ChatManager: 添加动作结果消息:', toolResultMessage.substring(0, 100) + '...');
                        
                        // 不在UI显示工具结果消息，只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        
                        await this.processToolResult();
                    }
                } else {
                    // 动作不存在，手动创建错误消息
                    console.log(`ChatManager: 动作 "${actionName}" 不存在`);
                    const errorMessage = {
                        success: false, 
                        action: actionName,
                        error: `错误：尝试执行未定义的动作 "${actionName}"。请从可用动作列表中选择。` 
                    };
                    
                    // 存储错误结果
                    this.lastActionResult = `动作执行尝试失败: 未定义的动作 "${actionName}"`;
                    
                    // 显示错误结果
                    const { addExecutionResultMessage } = await import('./utils.js');
                    addExecutionResultMessage(errorMessage, '动作');
                    
                    // 即使出错也需要将结果返回给AI，但不在UI中显示
                    if (!accumulatedText.includes('<taskComplete>')) {
                        const toolResultMessage = `type:text\ntext:[tool for 'runQuickerAction'] Result:"动作执行失败: 未定义的动作 ${actionName.replace(/"/g, '\\"')}"`;
                        // 只添加到消息历史
                        this.messages.push({ role: 'user', content: toolResultMessage });
                        await this.processToolResult();
                    }
                }
            } else {
                // 没有检测到命令或动作，完成处理
                displayedText = accumulatedText;
                
                // 将最终结果添加到消息历史
                this.messages.push({ role: 'assistant', content: displayedText });
            }

        } catch (error) {
            // 移除加载动画
            const aiMessageContent = document.querySelector('.message-content.markdown-body:last-child');
            if (aiMessageContent && aiMessageContent.querySelector('.ai-loading-animation')) {
                aiMessageContent.querySelector('.ai-loading-animation').remove();
            }
            console.error('ChatManager: 处理工具结果时出错:', error);
            
            // 显示错误消息
            try {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'bg-red-100 p-3 rounded-lg text-red-700 my-2';
                errorDiv.textContent = `处理工具结果错误: ${error.message}`;
                this.messagesContainer.appendChild(errorDiv);
            } catch (e) {
                console.error('ChatManager: 显示错误消息时出错:', e);
            }
        } finally {
            // 恢复发送按钮为飞机图标
            if (this.sendButton) {
                this.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
                this.sendButton.classList.remove('bg-red-500', 'text-white');
                this.sendButton.classList.add('bg-white', 'hover:bg-gray-100', 'text-gray-800');
                this.sendButton.onclick = (event) => {
                    event.preventDefault();
                    this.handleSendMessage();
                };
            }
            this.abortController = null;
            // 无论成功或失败，都重置处理状态
            this.isProcessing = false
            console.log('ChatManager: 设置 isProcessing = false')
        }
    }

    displayRetryOption(errorMessage) {
        this.removeRetryOption();
        // 找到最后一个用户消息卡片
        const lastUserMessageCard = this.messagesContainer.querySelector('.message-animation:last-child');
        if (lastUserMessageCard) {
            const lastUserMessageDiv = lastUserMessageCard.querySelector('.flex-1.min-w-0');
            if (lastUserMessageDiv) {
                // 创建一个flex容器，右对齐
                const errorContainer = document.createElement('div');
                errorContainer.className = 'retry-error-container mt-2 text-xs flex justify-end items-center';
                // 错误提示
                const errorText = document.createElement('span');
                errorText.className = 'text-red-500 mr-2';
                errorText.textContent = `发送失败: ${errorMessage}`;
                // 重试按钮
                const retryButton = document.createElement('button');
                retryButton.id = 'retry-send-button';
                retryButton.className = 'px-3 py-1 text-xs border border-gray-300 bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded transition-colors';
                retryButton.textContent = '重试';
                retryButton.onclick = async () => {
                    if (this.lastFailedUserMessage && !this.isProcessing && !this.isRetrying) {
                        this.isRetrying = true;
                        this.removeRetryOption();
                        // 移除原用户消息卡片
                        if (lastUserMessageCard && lastUserMessageCard.parentNode) {
                            lastUserMessageCard.parentNode.removeChild(lastUserMessageCard);
                        }
                        // 显示重试中状态（可选）
                        // const tempRetryStatus = document.createElement('p');
                        // tempRetryStatus.className = 'text-xs text-yellow-500 italic mt-1';
                        // tempRetryStatus.textContent = '正在重试...';
                        // this.messagesContainer.appendChild(tempRetryStatus);
                        await this.sendMessage(this.lastFailedUserMessage);
                        // if(tempRetryStatus.parentNode) {
                        //     tempRetryStatus.parentNode.removeChild(tempRetryStatus);
                        // }
                    }
                };
                errorContainer.appendChild(errorText);
                errorContainer.appendChild(retryButton);
                lastUserMessageDiv.appendChild(errorContainer);
            }
        }
    }

    removeRetryOption() {
        const existingErrorContainer = this.messagesContainer.querySelector('.retry-error-container');
        if (existingErrorContainer && existingErrorContainer.parentNode) {
            existingErrorContainer.parentNode.removeChild(existingErrorContainer);
        }
        const tempRetryStatus = this.messagesContainer.querySelector('.text-xs.text-yellow-500.italic.mt-1');
        if(tempRetryStatus && tempRetryStatus.parentNode) {
            tempRetryStatus.parentNode.removeChild(tempRetryStatus);
        }
    }
}

export const chatManager = new ChatManager() 