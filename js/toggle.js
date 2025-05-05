import { actionManager } from './action.js'
import { settingsManager } from './settings.js'

// 存储键名常量
const COMMAND_STATE_KEY = 'quicker_command_state';
const ACTION_STATE_KEY = 'quicker_action_state';
// 内存中的备用存储（用于处理本地存储不可用的情况）
const memoryStorage = {};

// 功能开关状态
class ToggleManager {
    constructor() {
        // 状态变量
        this.isRunCommandActive = false
        this.isRunActionActive = false
        
        // 按钮元素
        this.toggleRunCommandButton = null
        this.runCommandStatusSpan = null
        this.toggleRunActionButton = null
        this.runActionStatusSpan = null
        
        console.log('ToggleManager: 构造函数被调用，准备恢复状态')
        
        // 首先尝试从 localStorage 恢复状态
        this.restoreStateFromLocalStorage()
        
        // 然后尝试从 location.hash 恢复状态（如果hash有值则覆盖localStorage的值）
        if (window.location.hash) {
            console.log('ToggleManager: 检测到URL hash存在，尝试从hash恢复状态')
            this.restoreStateFromHash()
        } else {
            console.log('ToggleManager: URL hash不存在，使用localStorage或默认值')
        }
        
        // 立即保存当前状态，确保localStorage值最新
        this.saveState()
        
        // 等待 DOM 加载完成
        if (document.readyState === 'loading') {
            console.log('ToggleManager: DOM 尚未加载完成，等待 DOMContentLoaded 事件')
            document.addEventListener('DOMContentLoaded', () => {
                console.log('ToggleManager: DOM 加载完成，初始化事件监听器')
                this.initializeEventListeners()
                
                // DOM 加载完成后，触发状态变化事件以更新 UI
                this.updateUIAfterStateRestore()
            })
        } else {
            console.log('ToggleManager: DOM 已加载完成，直接初始化事件监听器')
            this.initializeEventListeners()
            
            // DOM 已加载完成，立即触发状态变化事件以更新 UI
            this.updateUIAfterStateRestore()
        }
        
        // 监听 hashchange 事件，处理通过浏览器前进/后退按钮的状态变化
        window.addEventListener('hashchange', () => {
            console.log('ToggleManager: 检测到 hash 变化，尝试从 hash 恢复状态')
            this.restoreStateFromHash()
            this.updateUIAfterStateRestore()
        })
        
        // 监听页面卸载事件，确保状态被保存
        window.addEventListener('beforeunload', () => {
            console.log('ToggleManager: 页面即将卸载，保存状态')
            this.saveState()
        })
    }

    // 在状态恢复后更新 UI 和触发事件
    updateUIAfterStateRestore() {
        console.log('ToggleManager: 状态恢复后更新 UI 和触发事件')
        
        // 如果元素未加载，尝试重新获取
        if (!this.toggleRunCommandButton || !this.runCommandStatusSpan || 
            !this.toggleRunActionButton || !this.runActionStatusSpan) {
            console.log('ToggleManager: 元素未加载，尝试获取元素...')
            this.toggleRunCommandButton = document.getElementById('toggle-run-command-button')
            this.runCommandStatusSpan = document.getElementById('run-command-status')
            this.toggleRunActionButton = document.getElementById('toggle-run-action-button')
            this.runActionStatusSpan = document.getElementById('run-action-status')
        }
        
        // 确保获取到了所有必需的元素
        if (!this.toggleRunCommandButton || !this.runCommandStatusSpan || 
            !this.toggleRunActionButton || !this.runActionStatusSpan) {
            console.error('ToggleManager: 状态恢复失败，未找到必需的 UI 元素')
            return
        }
        
        // 更新按钮 UI
        console.log('ToggleManager: 更新按钮 UI 状态')
        this.updateRunCommandButtonUI()
        this.updateRunActionButtonUI()
        
        // 始终触发命令执行状态变化事件，确保其他组件得到通知
        console.log(`ToggleManager: 通知其他组件当前命令执行状态: ${this.isRunCommandActive}`)
        
        // 使用延迟确保其他组件已初始化
        setTimeout(() => {
            try {
                document.dispatchEvent(new CustomEvent('commandExecutionStateChanged', {
                    detail: { isEnabled: this.isRunCommandActive }
                }))
                console.log('ToggleManager: 状态变化事件已触发')
            } catch (error) {
                console.error('ToggleManager: 触发状态变化事件失败:', error)
            }
        }, 300) // 增加延迟时间，确保其他组件已完全加载
    }

    // 从 localStorage 恢复状态
    restoreStateFromLocalStorage() {
        try {
            console.log('ToggleManager: 尝试从 localStorage 恢复状态')
            
            // 尝试从localStorage读取
            let commandState = null;
            let actionState = null;
            
            try {
                commandState = localStorage.getItem(COMMAND_STATE_KEY);
                actionState = localStorage.getItem(ACTION_STATE_KEY);
                console.log(`ToggleManager: 从 localStorage 读取状态 - 命令执行: ${commandState}, 动作执行: ${actionState}`);
            } catch (storageError) {
                console.warn('ToggleManager: 访问 localStorage 失败，尝试使用内存存储:', storageError);
                commandState = memoryStorage[COMMAND_STATE_KEY] || null;
                actionState = memoryStorage[ACTION_STATE_KEY] || null;
                console.log(`ToggleManager: 从内存存储读取状态 - 命令执行: ${commandState}, 动作执行: ${actionState}`);
            }
            
            if (commandState !== null) {
                const oldCommandState = this.isRunCommandActive;
                this.isRunCommandActive = commandState === 'true';
                console.log(`ToggleManager: 从存储恢复命令执行状态: ${oldCommandState} => ${this.isRunCommandActive}`);
            } else {
                console.log('ToggleManager: 存储中没有命令执行状态');
            }
            
            if (actionState !== null) {
                const oldActionState = this.isRunActionActive;
                this.isRunActionActive = actionState === 'true';
                console.log(`ToggleManager: 从存储恢复动作执行状态: ${oldActionState} => ${this.isRunActionActive}`);
            } else {
                console.log('ToggleManager: 存储中没有动作执行状态');
            }
        } catch (error) {
            console.error('ToggleManager: 从存储恢复状态出错:', error);
        }
    }

    // 从 URL hash 恢复状态
    restoreStateFromHash() {
        try {
            const hash = window.location.hash.substring(1) // 去掉开头的 #
            console.log(`ToggleManager: 从 hash 恢复状态，当前 hash: "${hash}"`)
            
            if (hash) {
                const params = new URLSearchParams(hash)
                const commandState = params.get('cmd')
                const actionState = params.get('act')
                
                const oldCommandState = this.isRunCommandActive
                const oldActionState = this.isRunActionActive
                
                if (commandState === '1' || commandState === '0') {
                    this.isRunCommandActive = commandState === '1'
                    console.log(`ToggleManager: 从 URL hash 恢复命令执行状态: ${oldCommandState} => ${this.isRunCommandActive}`)
                }
                
                if (actionState === '1' || actionState === '0') {
                    this.isRunActionActive = actionState === '1'
                    console.log(`ToggleManager: 从 URL hash 恢复动作执行状态: ${oldActionState} => ${this.isRunActionActive}`)
                }
            } else {
                console.log('ToggleManager: hash 为空，不从 hash 恢复状态')
            }
        } catch (error) {
            console.error('ToggleManager: 从 URL hash 恢复状态出错:', error)
        }
    }
    
    // 将状态保存到 URL hash 和 localStorage
    saveState() {
        try {
            // 保存到 localStorage，使用常量键名
            try {
                localStorage.setItem(COMMAND_STATE_KEY, String(this.isRunCommandActive));
                localStorage.setItem(ACTION_STATE_KEY, String(this.isRunActionActive));
                console.log(`ToggleManager: 状态已保存到 localStorage - 命令执行: ${this.isRunCommandActive}, 动作执行: ${this.isRunActionActive}`);
            } catch (storageError) {
                console.warn('ToggleManager: 访问 localStorage 失败，使用内存存储:', storageError);
                memoryStorage[COMMAND_STATE_KEY] = String(this.isRunCommandActive);
                memoryStorage[ACTION_STATE_KEY] = String(this.isRunActionActive);
                console.log(`ToggleManager: 状态已保存到内存存储 - 命令执行: ${this.isRunCommandActive}, 动作执行: ${this.isRunActionActive}`);
            }
            
            // 保存到 URL hash
            const params = new URLSearchParams();
            params.set('cmd', this.isRunCommandActive ? '1' : '0');
            params.set('act', this.isRunActionActive ? '1' : '0');
            
            try {
                window.location.hash = params.toString();
                console.log(`ToggleManager: 状态已保存到 URL hash - ${params.toString()}`);
            } catch (hashError) {
                console.warn('ToggleManager: 保存状态到 URL hash 失败:', hashError);
            }
        } catch (error) {
            console.error('ToggleManager: 保存状态出错:', error);
        }
    }

    initializeEventListeners() {
        console.log('ToggleManager: 初始化事件监听器')
        
        // 获取按钮元素
        this.toggleRunCommandButton = document.getElementById('toggle-run-command-button')
        this.runCommandStatusSpan = document.getElementById('run-command-status')
        this.toggleRunActionButton = document.getElementById('toggle-run-action-button')
        this.runActionStatusSpan = document.getElementById('run-action-status')

        if (!this.toggleRunCommandButton || !this.runCommandStatusSpan || 
            !this.toggleRunActionButton || !this.runActionStatusSpan) {
            console.error('ToggleManager: 必要的开关按钮元素未找到')
            return
        }
        
        console.log(`ToggleManager: 成功获取所有必要按钮元素，当前状态 - 命令执行: ${this.isRunCommandActive}, 动作执行: ${this.isRunActionActive}`)

        // 命令执行开关事件
        this.toggleRunCommandButton.addEventListener('click', () => {
            this.isRunCommandActive = !this.isRunCommandActive
            console.log(`ToggleManager: 命令执行开关点击，新状态: ${this.isRunCommandActive}`)
            
            // 立即更新UI
            this.updateRunCommandButtonUI()
            
            // 保存状态
            this.saveState()
            
            // 延迟触发命令执行状态变化事件，确保状态已保存
            console.log('ToggleManager: 延迟触发命令执行状态变化事件')
            setTimeout(() => {
                console.log(`ToggleManager: 触发命令执行状态变化事件，当前状态: ${this.isRunCommandActive}`)
                document.dispatchEvent(new CustomEvent('commandExecutionStateChanged', {
                    detail: { isEnabled: this.isRunCommandActive }
                }))
                
                // 手动更新提示词显示
                if (settingsManager && typeof settingsManager.updateAgentPromptDisplay === 'function') {
                    console.log('ToggleManager: 手动调用updateAgentPromptDisplay')
                    settingsManager.updateAgentPromptDisplay();
                }
            }, 100)
        })

        // 动作执行开关事件
        this.toggleRunActionButton.addEventListener('click', () => {
            this.isRunActionActive = !this.isRunActionActive
            console.log(`ToggleManager: 动作执行开关点击，新状态: ${this.isRunActionActive}`)
            this.updateRunActionButtonUI()
            this.saveState()
        })

        // 右键点击动作执行按钮，打开动作编辑器
        this.toggleRunActionButton.addEventListener('contextmenu', (event) => {
            event.preventDefault() // 阻止默认右键菜单
            const actionEditorModal = document.getElementById('action-editor-modal')
            if (actionEditorModal) {
                // 刷新动作列表
                actionManager.renderActionList()
                actionEditorModal.classList.remove('hidden')
            }
        })

        // 初始化UI状态
        console.log('ToggleManager: 初始化 UI 状态')
        this.updateRunCommandButtonUI()
        this.updateRunActionButtonUI()
        
        // 强制手动实现一次 hash 与内部状态同步
        try {
            if (window.location.hash) {
                const hash = window.location.hash.substring(1);
                if (hash) {
                    const params = new URLSearchParams(hash);
                    const cmdValue = params.get('cmd');
                    if (cmdValue === '1' && !this.isRunCommandActive) {
                        console.log('ToggleManager: 检测到 hash 中命令执行状态为开启，但内部状态为关闭，强制更新状态');
                        this.isRunCommandActive = true;
                        this.updateRunCommandButtonUI();
                        // 触发状态变化事件
                        setTimeout(() => {
                            document.dispatchEvent(new CustomEvent('commandExecutionStateChanged', {
                                detail: { isEnabled: true }
                            }));
                        }, 200);
                    } else if (cmdValue === '0' && this.isRunCommandActive) {
                        console.log('ToggleManager: 检测到 hash 中命令执行状态为关闭，但内部状态为开启，强制更新状态');
                        this.isRunCommandActive = false;
                        this.updateRunCommandButtonUI();
                        // 触发状态变化事件
                        setTimeout(() => {
                            document.dispatchEvent(new CustomEvent('commandExecutionStateChanged', {
                                detail: { isEnabled: false }
                            }));
                        }, 200);
                    }
                }
            }
        } catch (error) {
            console.error('ToggleManager: 强制同步 hash 状态失败:', error);
        }
    }

    // 更新命令执行按钮UI
    updateRunCommandButtonUI() {
        if (!this.runCommandStatusSpan || !this.toggleRunCommandButton) {
            console.error('ToggleManager: 命令执行按钮或状态显示元素未找到')
            return
        }

        console.log(`ToggleManager: 更新命令执行按钮 UI，当前状态: ${this.isRunCommandActive}`)
        
        if (this.isRunCommandActive) {
            console.log('ToggleManager: 命令执行状态为开启，设置开启样式')
            this.runCommandStatusSpan.textContent = '开启'
            this.toggleRunCommandButton.classList.add('context-active')
            this.toggleRunCommandButton.classList.remove('border-gray-300', 'text-gray-600', 'hover:bg-gray-100')
            this.toggleRunCommandButton.classList.add('border-green-300', 'text-green-700', 'bg-green-50')
        } else {
            console.log('ToggleManager: 命令执行状态为关闭，设置关闭样式')
            this.runCommandStatusSpan.textContent = '关闭'
            this.toggleRunCommandButton.classList.remove('context-active', 'border-green-300', 'text-green-700', 'bg-green-50')
            this.toggleRunCommandButton.classList.add('border-gray-300', 'text-gray-600', 'hover:bg-gray-100')
        }
    }

    // 更新动作执行按钮UI
    updateRunActionButtonUI() {
        if (!this.runActionStatusSpan || !this.toggleRunActionButton) {
            console.error('ToggleManager: 动作执行按钮或状态显示元素未找到')
            return
        }

        console.log(`ToggleManager: 更新动作执行按钮 UI，当前状态: ${this.isRunActionActive}`)
        
        if (this.isRunActionActive) {
            console.log('ToggleManager: 动作执行状态为开启，设置开启样式')
            this.runActionStatusSpan.textContent = '开启'
            this.toggleRunActionButton.classList.add('context-active')
            this.toggleRunActionButton.classList.remove('border-gray-300', 'text-gray-600', 'hover:bg-gray-100')
            this.toggleRunActionButton.classList.add('border-green-300', 'text-green-700', 'bg-green-50')
        } else {
            console.log('ToggleManager: 动作执行状态为关闭，设置关闭样式')
            this.runActionStatusSpan.textContent = '关闭'
            this.toggleRunActionButton.classList.remove('context-active', 'border-green-300', 'text-green-700', 'bg-green-50')
            this.toggleRunActionButton.classList.add('border-gray-300', 'text-gray-600', 'hover:bg-gray-100')
        }
    }

    // 获取命令执行状态
    isCommandExecutionEnabled() {
        return this.isRunCommandActive
    }

    // 获取动作执行状态
    isActionExecutionEnabled() {
        return this.isRunActionActive
    }
}

export const toggleManager = new ToggleManager() 