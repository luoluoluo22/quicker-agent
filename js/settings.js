import { CONFIG } from './config.js'
import { toggleManager } from './toggle.js'

class SettingsManager {
    constructor() {
        // 初始化属性为 null
        this.settingsModal = null
        this.openSettingsButton = null
        this.closeSettingsButton = null
        this.saveSettingsButton = null
        this.apiKeyInput = null
        this.modelInput = null
        this.temperatureInput = null
        this.temperatureValue = null
        this.baseUrlInput = null
        this.systemPromptsContainer = null
        
        console.log('SettingsManager: 构造函数被调用')
        
        // 延迟初始化事件监听器，等待 DOM 完全加载
        if (document.readyState === 'loading') {
            console.log('SettingsManager: DOM 尚未加载完成，等待 DOMContentLoaded 事件')
            document.addEventListener('DOMContentLoaded', () => {
                console.log('SettingsManager: DOM 加载完成，初始化元素和事件监听器')
                this.initializeElements()
                this.initializeEventListeners()
                this.loadSettings()
                this.updateAgentPromptDisplay() // 初始更新提示词显示
            })
        } else {
            console.log('SettingsManager: DOM 已加载完成，直接初始化元素和事件监听器')
            this.initializeElements()
            this.initializeEventListeners()
            this.loadSettings()
            this.updateAgentPromptDisplay() // 初始更新提示词显示
        }
        
        // 监听命令执行状态变化
        console.log('SettingsManager: 添加命令执行状态变化事件监听器')
        document.addEventListener('commandExecutionStateChanged', (event) => {
            console.log(`SettingsManager: 收到命令执行状态变化事件，启用状态: ${event.detail?.isEnabled}`)
            this.updateAgentPromptDisplay()
        })
    }

    initializeElements() {
        // 获取所有需要的 DOM 元素
        this.settingsToggle = document.getElementById('settings-toggle')
        this.settingsPanel = document.getElementById('settings-panel')
        this.cancelSettings = document.getElementById('cancel-settings')
        this.saveSettings = document.getElementById('save-settings')
        this.apiKeyInput = document.getElementById('api-key')
        this.modelInput = document.getElementById('model-input')
        this.temperatureInput = document.getElementById('temperature')
        this.temperatureValue = document.getElementById('temp-value')
        this.baseUrlInput = document.getElementById('base-url')
        this.systemPromptsContainer = document.getElementById('system-prompts')
        this.addPromptButton = document.getElementById('add-prompt')

        // 检查必需的元素是否存在
        if (!this.settingsToggle || !this.settingsPanel || !this.saveSettings) {
            console.error('Required DOM elements not found for SettingsManager')
            return false
        }
        return true
    }

    initializeEventListeners() {
        if (!this.initializeElements()) return

        // 切换设置面板可见性
        this.settingsToggle.addEventListener('click', () => {
            const chevron = this.settingsToggle.querySelector('.fa-chevron-down')
            chevron.classList.toggle('rotate-180')
            if (this.settingsPanel.style.maxHeight) {
                this.settingsPanel.style.maxHeight = null
            } else {
                setTimeout(() => {
                    this.settingsPanel.style.maxHeight = this.settingsPanel.scrollHeight + 'px'
                }, 10)
            }
        })

        // 取消设置按钮
        if (this.cancelSettings) {
            this.cancelSettings.addEventListener('click', () => {
                this.loadSettings()
                this.settingsPanel.style.maxHeight = null
                this.settingsToggle.querySelector('.fa-chevron-down').classList.remove('rotate-180')
            })
        }

        // 保存设置按钮
        if (this.saveSettings) {
            this.saveSettings.addEventListener('click', async () => {
                const success = await this.saveSettingsAndActions()
                if (success) {
                    this.settingsPanel.style.maxHeight = null
                    this.settingsToggle.querySelector('.fa-chevron-down').classList.remove('rotate-180')
                }
            })
        }

        // 温度滑块值更新
        if (this.temperatureInput && this.temperatureValue) {
            this.temperatureInput.addEventListener('input', () => {
                this.temperatureValue.textContent = this.temperatureInput.value
            })
        }

        // 添加系统提示词按钮
        if (this.addPromptButton && this.systemPromptsContainer) {
            this.addPromptButton.addEventListener('click', () => this.addPromptInput())
        }
    }

    // 添加系统提示词输入框
    addPromptInput(prompt = '') {
        if (!this.systemPromptsContainer) return

        const promptDiv = document.createElement('div')
        promptDiv.className = 'flex items-center space-x-2'
        promptDiv.innerHTML = `
            <input
                type="text"
                class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                value="${prompt}"
                placeholder="输入系统提示词..."
            />
            <button type="button" class="text-red-500 hover:text-red-700">
                <i class="fas fa-trash"></i>
            </button>
        `

        // 添加删除按钮事件监听器
        const deleteButton = promptDiv.querySelector('button')
        deleteButton.addEventListener('click', () => promptDiv.remove())

        this.systemPromptsContainer.appendChild(promptDiv)
    }

    // 更新 Agent 提示词显示
    updateAgentPromptDisplay() {
        const defaultAgentPromptDisplay = document.getElementById('default-agent-prompt-display')
        if (!defaultAgentPromptDisplay) {
            console.error('SettingsManager: Agent 提示词显示元素未找到')
            return
        }
        
        console.log('SettingsManager: 更新Agent提示词显示');
        
        // 始终显示AI思考提示词，不再检查命令执行状态
        
        // 移除隐藏类
        defaultAgentPromptDisplay.classList.remove('hidden');
        defaultAgentPromptDisplay.previousElementSibling?.classList.remove('hidden');
        
        // 获取并显示解析后的完整系统提示词
        try {
            const { AI_THINKING } = window.appConfig || {};
            if (AI_THINKING && AI_THINKING.systemPrompt) {
                console.log('SettingsManager: 找到AI_THINKING配置，准备生成完整提示词');
                
                // 导入必要的依赖
                import('./context.js').then(({ contextManager }) => {
                    import('./chat.js').then(({ chatManager }) => {
                        try {
                            // 获取当前上下文状态
                            const contextState = contextManager.getContextState();
                            
                            // 使用ChatManager的方法生成上下文信息文本
                            const contextInfoText = chatManager.generateContextInfoText(contextState);
                            
                            // 替换占位符，生成完整的提示词
                            const fullSystemPrompt = AI_THINKING.systemPrompt.replace('{{CONTEXT_INFO}}', contextInfoText);
                            
                            console.log('SettingsManager: 已生成完整系统提示词');
                            
                            // 显示完整的系统提示词
                            defaultAgentPromptDisplay.textContent = fullSystemPrompt;
                            
                            // 添加样式
                            defaultAgentPromptDisplay.className = 'text-xs bg-gray-50 p-2 rounded border border-gray-200 max-h-40 overflow-y-auto whitespace-pre-wrap';
                        } catch (error) {
                            console.error('SettingsManager: 生成完整系统提示词时出错:', error);
                            // 出错时显示原始模板
                            defaultAgentPromptDisplay.textContent = AI_THINKING.systemPrompt;
                            defaultAgentPromptDisplay.className = 'text-xs bg-gray-50 p-2 rounded border border-gray-200 max-h-40 overflow-y-auto whitespace-pre-wrap';
                        }
                    }).catch(error => {
                        console.error('SettingsManager: 导入chat.js时出错:', error);
                        // 出错时显示原始模板
                        defaultAgentPromptDisplay.textContent = AI_THINKING.systemPrompt;
                        defaultAgentPromptDisplay.className = 'text-xs bg-gray-50 p-2 rounded border border-gray-200 max-h-40 overflow-y-auto whitespace-pre-wrap';
                    });
                }).catch(error => {
                    console.error('SettingsManager: 导入context.js时出错:', error);
                    // 出错时显示原始模板
                    defaultAgentPromptDisplay.textContent = AI_THINKING.systemPrompt;
                    defaultAgentPromptDisplay.className = 'text-xs bg-gray-50 p-2 rounded border border-gray-200 max-h-40 overflow-y-auto whitespace-pre-wrap';
                });
            } else {
                console.log('SettingsManager: 未找到AI_THINKING配置');
                defaultAgentPromptDisplay.textContent = '未找到默认Agent提示词';
                defaultAgentPromptDisplay.className = 'text-xs text-gray-500';
            }
        } catch (error) {
            console.error('SettingsManager: 获取或显示默认Agent提示词出错:', error);
            defaultAgentPromptDisplay.textContent = '加载默认Agent提示词时出错';
            defaultAgentPromptDisplay.className = 'text-xs text-red-500';
        }
    }

    // 加载设置
    async loadSettings() {
        try {
            const v = typeof $quicker !== 'undefined' ? $quicker : null
            if (!v) {
                console.warn('$quicker object not available. Cannot load settings.')
                this.loadDefaultSettings()
                return
            }

            const savedSettings = await v.getVar('chatSettings')
            if (savedSettings) {
                try {
                    const settings = JSON.parse(savedSettings)
                    this.updateConfigAndUI(settings)
                    
                    // 如果设置中包含动作列表，导入到actionManager
                    if (settings.quickerActions && Array.isArray(settings.quickerActions)) {
                        console.log(`SettingsManager: 从设置中读取到 ${settings.quickerActions.length} 个动作`);
                        try {
                            const { actionManager } = await import('./action.js');
                            // 清除现有动作并添加从设置中读取的动作
                            actionManager.clearActions();
                            settings.quickerActions.forEach(action => {
                                actionManager.addAction(action.name, action.id);
                            });
                            actionManager.renderActionList();
                            console.log('SettingsManager: 成功导入动作列表');
                        } catch (actionError) {
                            console.error('SettingsManager: 导入动作列表失败:', actionError);
                        }
                    }
                } catch (parseError) {
                    console.error('Error parsing saved settings:', parseError)
                    this.loadDefaultSettings()
                }
            } else {
                this.loadDefaultSettings()
            }

            // 显示默认的 agent 提示词
            this.updateAgentPromptDisplay()
        } catch (error) {
            console.error('Error loading settings:', error)
            this.loadDefaultSettings()
        }
    }

    // 加载默认设置
    loadDefaultSettings() {
        if (this.apiKeyInput) this.apiKeyInput.value = CONFIG.apiKey
        if (this.modelInput) this.modelInput.value = CONFIG.model
        if (this.baseUrlInput) this.baseUrlInput.value = CONFIG.baseUrl
        if (this.temperatureInput) {
            this.temperatureInput.value = CONFIG.temperature
            if (this.temperatureValue) {
                this.temperatureValue.textContent = CONFIG.temperature
            }
        }
        if (this.systemPromptsContainer) {
            this.systemPromptsContainer.innerHTML = ''
        }
    }

    // 更新配置和 UI
    updateConfigAndUI(settings) {
        if (!settings) {
            console.warn('No settings provided to updateConfigAndUI')
            return
        }

        CONFIG.apiKey = settings.apiKey || ''
        CONFIG.model = settings.model || ''
        CONFIG.temperature = settings.temperature || 0.7
        CONFIG.baseUrl = settings.baseUrl || 'https://api.openai.com/v1/chat/completions'
        CONFIG.systemPrompts = Array.isArray(settings.systemPrompts) ? settings.systemPrompts : []

        // 更新 UI
        if (this.apiKeyInput) this.apiKeyInput.value = CONFIG.apiKey
        if (this.modelInput) this.modelInput.value = CONFIG.model
        if (this.baseUrlInput) this.baseUrlInput.value = CONFIG.baseUrl
        if (this.temperatureInput) {
            this.temperatureInput.value = CONFIG.temperature
            if (this.temperatureValue) {
                this.temperatureValue.textContent = CONFIG.temperature
            }
        }

        // 更新系统提示词
        if (this.systemPromptsContainer) {
            this.systemPromptsContainer.innerHTML = ''
            if (Array.isArray(CONFIG.systemPrompts)) {
                CONFIG.systemPrompts.forEach(prompt => {
                    if (prompt && typeof prompt === 'string') {
                        this.addPromptInput(prompt)
                    }
                })
            }
        }
    }

    // 保存设置
    async saveSettingsAndActions() {
        try {
            // 更新配置对象
            CONFIG.apiKey = this.apiKeyInput ? this.apiKeyInput.value : ''
            CONFIG.model = this.modelInput ? this.modelInput.value : ''
            CONFIG.baseUrl = this.baseUrlInput ? this.baseUrlInput.value : ''
            CONFIG.temperature = this.temperatureInput ? parseFloat(this.temperatureInput.value) : 0.7

            // 获取系统提示词
            if (this.systemPromptsContainer) {
                CONFIG.systemPrompts = Array.from(
                    this.systemPromptsContainer.querySelectorAll('input')
                )
                    .map(input => input.value)
                    .filter(value => value && typeof value === 'string' && value.trim() !== '')
                    .map(value => value.trim())
            } else {
                CONFIG.systemPrompts = []
            }

            // 获取当前动作列表
            let quickerActions = [];
            try {
                const { actionManager } = await import('./action.js');
                quickerActions = actionManager.getActions().map(action => ({
                    id: action.id || Date.now() + Math.floor(Math.random() * 1000),
                    name: action.name
                }));
                console.log(`SettingsManager: 准备保存 ${quickerActions.length} 个动作`);
            } catch (actionError) {
                console.error('SettingsManager: 获取动作列表失败:', actionError);
            }

            // 准备要保存的设置对象
            const settingsToSave = {
                apiKey: CONFIG.apiKey,
                model: CONFIG.model,
                baseUrl: CONFIG.baseUrl,
                temperature: CONFIG.temperature,
                systemPrompts: CONFIG.systemPrompts,
                quickerActions: quickerActions
            }

            // 调用子程序保存设置
            return await this.saveAIChatSettings(settingsToSave);
        } catch (error) {
            console.error('Error saving settings:', error)
            return false
        }
    }

    // 保存AI聊天设置子程序
    async saveAIChatSettings(settingsToSave) {
        console.log('SettingsManager: 调用子程序saveAIChatSettings保存设置');
        try {
            // 检查$quicker对象是否可用
            const v = typeof $quicker !== 'undefined' ? $quicker : null
            if (v) {
                // 使用$quickerSp调用子程序
                const result = await $quickerSp('saveAIChatSettings', {
                    settingsToSave: JSON.stringify(settingsToSave)
                });
                
                // 检查子程序调用结果
                if (result && result.success) {
                    console.log('SettingsManager: 设置保存成功');
                    return true;
                } else {
                    console.warn('SettingsManager: 子程序调用失败', result);
                    return false;
                }
            } else {
                console.warn('$quicker对象不可用，无法保存设置。')
                return false
            }
        } catch (error) {
            console.error('SettingsManager: 保存设置时出错:', error)
            return false
        }
    }

    // 获取当前设置
    getCurrentSettings() {
        return {
            apiKey: CONFIG.apiKey,
            model: CONFIG.model,
            temperature: CONFIG.temperature,
            baseUrl: CONFIG.baseUrl,
            systemPrompts: CONFIG.systemPrompts
        }
    }
}

export const settingsManager = new SettingsManager() 