import { contextManager } from './context.js'
import { commandManager } from './command.js'
import { actionManager } from './action.js'
import { settingsManager } from './settings.js'
import { chatManager } from './chat.js'
import { toggleManager } from './toggle.js'
import { AI_THINKING } from './config.js'

// 检查是否已经初始化过
const INITIALIZATION_FLAG = 'quicker_chat_initialized'

// 从URL Hash中解析状态
function parseStateFromHash() {
    try {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const params = new URLSearchParams(hash);
            const commandState = params.get('cmd');
            const actionState = params.get('act');
            
            return {
                commandEnabled: commandState === '1',
                actionEnabled: actionState === '1',
                hasState: true
            };
        }
    } catch (error) {
        console.error('main.js: 从 URL hash 解析状态失败:', error);
    }
    
    return { commandEnabled: false, actionEnabled: false, hasState: false };
}

// 当 DOM 内容加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    // 检查是否已经初始化过
    if (window[INITIALIZATION_FLAG]) {
        console.log('main.js: 检测到已经初始化过应用，避免重复初始化')
        return
    }

    console.log('main.js: 初始化 Quicker 聊天应用...')
    
    try {
        // 初始化全局配置对象，供其他组件使用
        window.appConfig = { AI_THINKING };
        console.log('main.js: 已初始化全局配置对象，包含 AI_THINKING');
        
        // 获取上下文
        console.log('main.js: 获取初始上下文')
        await contextManager.fetchInitialContext()
        
        // 首先加载设置（可能包含动作）
        console.log('main.js: 加载设置（可能包含动作数据）')
        await settingsManager.loadSettings()
        
        // 加载动作 - 仅在设置中没有动作数据时会加载单独存储的动作
        console.log('main.js: 检查是否需要加载单独存储的动作列表')
        if (actionManager.getActions().length === 0) {
            console.log('main.js: 从设置中未获取到动作，尝试从单独存储中加载')
            await actionManager.loadActions()
        } else {
            console.log(`main.js: 已从设置中加载 ${actionManager.getActions().length} 个动作，跳过单独加载`)
        }
        
        // 打印当前 hash 状态
        console.log(`main.js: 当前 URL hash: "${window.location.hash}"`)
        
        // 尝试从URL hash解析状态
        const hashState = parseStateFromHash();
        
        // 确保状态显示正确
        console.log('main.js: 确保按钮和提示词状态正确')
        
        // 强制更新 UI 状态
        console.log('main.js: 强制更新 UI 状态')
        let commandEnabled = toggleManager.isCommandExecutionEnabled();
        let actionEnabled = toggleManager.isActionExecutionEnabled();
        
        // 如果Hash中有状态，且与当前不一致，则强制更新
        if (hashState.hasState) {
            if (commandEnabled !== hashState.commandEnabled) {
                console.log(`main.js: 检测到hash状态(${hashState.commandEnabled})与当前状态(${commandEnabled})不一致，强制更新命令执行状态`);
                commandEnabled = hashState.commandEnabled;
            }
            
            if (actionEnabled !== hashState.actionEnabled) {
                console.log(`main.js: 检测到hash状态(${hashState.actionEnabled})与当前状态(${actionEnabled})不一致，强制更新动作执行状态`);
                actionEnabled = hashState.actionEnabled;
            }
        }
        
        console.log(`main.js: 当前功能状态 - 命令执行: ${commandEnabled}, 动作执行: ${actionEnabled}`)
        
        // 延迟触发命令执行状态变化事件，确保所有DOM元素已加载
        console.log('main.js: 延迟触发命令执行状态变化事件')
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('commandExecutionStateChanged', {
                detail: { isEnabled: commandEnabled }
            }))
            console.log('main.js: 命令执行状态变化事件已触发')
            
            // 额外触发一次提示词更新
            if (typeof settingsManager.updateAgentPromptDisplay === 'function') {
                console.log('main.js: 额外调用updateAgentPromptDisplay方法')
                settingsManager.updateAgentPromptDisplay()
            }
            
            // 再次保存状态，确保状态一致
            console.log('main.js: 重新保存状态以确保一致性');
            if (toggleManager && typeof toggleManager.saveState === 'function') {
                toggleManager.saveState();
            }
        }, 500)
        
        // 设置焦点在消息输入框
        const messageInput = document.getElementById('message-input')
        if (messageInput) {
            console.log('main.js: 设置焦点在消息输入框')
            messageInput.focus()
        }

        // 设置初始化标记，防止重复初始化
        window[INITIALIZATION_FLAG] = true
        console.log('main.js: Quicker 聊天应用初始化完成')
    } catch (error) {
        console.error('main.js: 应用初始化失败:', error)
    }
})

// 导出所有管理器实例
export {
    contextManager,
    commandManager,
    actionManager,
    settingsManager,
    chatManager,
    toggleManager
} 