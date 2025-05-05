import { SUBPROGRAM_NAMES } from './config.js'
import { addExecutionResultMessage } from './utils.js'

class CommandManager {
    constructor() {
        // 使用消息输入框和发送按钮作为命令输入和提交
        this.commandInput = document.getElementById('message-input')
        this.commandForm = null // 我们将在 initializeEventListeners 中处理表单提交
        this.commandHistory = []
        this.historyIndex = -1
        
        // 延迟初始化事件监听器，等待 DOM 完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeEventListeners())
        } else {
            this.initializeEventListeners()
        }
    }

    initializeEventListeners() {
        // 确保 DOM 元素存在
        this.commandInput = document.getElementById('message-input')
        if (!this.commandInput) {
            console.error('Command input element not found')
            return
        }

        // 使用发送按钮代替表单提交
        const sendButton = document.getElementById('send-button')
        if (sendButton) {
            sendButton.addEventListener('click', async () => {
                const command = this.commandInput.value.trim()
                if (command) {
                    await this.executeCommand(command)
                    this.commandInput.value = ''
                    this.historyIndex = -1
                }
            })
        }

        // 命令输入框键盘事件
        this.commandInput.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                this.navigateHistory('up')
            } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                this.navigateHistory('down')
            }
        })
    }

    // 执行命令
    async executeCommand(command) {
        // 添加到历史记录
        this.commandHistory.unshift(command)
        if (this.commandHistory.length > 50) {
            this.commandHistory.pop()
        }

        const v = typeof $quickerSp !== 'undefined' ? $quickerSp : null
        if (!v) {
            addExecutionResultMessage({
                success: false,
                command: command,
                error: 'API 未连接'
            }, '命令')
            return
        }

        try {
            const spResult = await v(SUBPROGRAM_NAMES.EXECUTE_COMMAND, {
                command: command
            })
            const innerResult = spResult ? spResult[SUBPROGRAM_NAMES.EXECUTE_COMMAND] : null

            if (innerResult && typeof innerResult.success === 'boolean') {
                addExecutionResultMessage({
                    success: true,
                    command: command,
                    output: innerResult.output || '命令执行成功'
                }, '命令')
            } else {
                const errorMsg = innerResult
                    ? innerResult.error || '未知错误'
                    : spResult && spResult.error
                    ? spResult.error
                    : '子程序调用失败'

                addExecutionResultMessage({
                    success: false,
                    command: command,
                    error: errorMsg
                }, '命令')
            }
        } catch (error) {
            addExecutionResultMessage({
                success: false,
                command: command,
                error: error.message || '命令执行出错'
            }, '命令')
        }
    }

    // 导航命令历史
    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return

        if (direction === 'up') {
            if (this.historyIndex < this.commandHistory.length - 1) {
                this.historyIndex++
                this.commandInput.value = this.commandHistory[this.historyIndex]
            }
        } else if (direction === 'down') {
            if (this.historyIndex > -1) {
                this.historyIndex--
                this.commandInput.value = this.historyIndex === -1 
                    ? '' 
                    : this.commandHistory[this.historyIndex]
            }
        }

        // 将光标移动到末尾
        setTimeout(() => {
            this.commandInput.selectionStart = this.commandInput.selectionEnd = this.commandInput.value.length
        }, 0)
    }
}

export const commandManager = new CommandManager()

/**
 * 执行命令并返回结果
 * @param {string} command 要执行的命令
 * @returns {Promise<Object>} 包含执行结果的对象
 */
export async function executeCommand(command) {
    console.log(`CommandExecutor: 开始执行命令: "${command}"`);
    
    // 检查API是否可用
    const v = typeof $quickerSp !== 'undefined' ? $quickerSp : null;
    if (!v) {
        console.error('CommandExecutor: Quicker API 未连接');
        return {
            success: false,
            command: command,
            output: '',
            error: 'Quicker API 未连接'
        };
    }
    
    // 使用配置文件中定义的子程序名称
    const subprogramName = SUBPROGRAM_NAMES.EXECUTE_COMMAND;
    console.log(`CommandExecutor: 子程序名称: "${subprogramName}"`);
    
    try {
        console.log(`CommandExecutor: 尝试调用子程序`);
        const spResult = await v(subprogramName, {
            command: command
        });
        
        console.log(`CommandExecutor: 子程序调用完成, 结果:`, spResult);
        
        // 检查子程序是否存在
        if (!spResult) {
            console.error(`CommandExecutor: 子程序 "${subprogramName}" 返回null或undefined`);
            return {
                success: false,
                command: command,
                output: '',
                error: `子程序 "${subprogramName}" 未返回结果`
            };
        }
        
        // 检查子程序返回的内部结果
        const innerResult = spResult[subprogramName];
        console.log(`CommandExecutor: 内部结果:`, innerResult);
        
        if (innerResult && typeof innerResult === 'object') {
            // 根据子程序返回的成功状态决定执行结果
            const success = innerResult.success === true;
            const output = innerResult.output || '';
            const error = innerResult.error || '';
            
            console.log(`CommandExecutor: 命令执行${success ? '成功' : '失败'}`);
            if (output) console.log(`CommandExecutor: 输出: ${output.substring(0, 100)}${output.length > 100 ? '...' : ''}`);
            if (error) console.error(`CommandExecutor: 错误: ${error}`);
            
            return {
                success: success,
                command: command,
                output: output,
                error: error
            };
        } else {
            console.error(`CommandExecutor: 无效的内部结果格式:`, innerResult);
            return {
                success: false,
                command: command,
                output: '',
                error: '无效的命令执行结果格式'
            };
        }
    } catch (error) {
        console.error(`CommandExecutor: 命令执行出错:`, error);
        return {
            success: false,
            command: command,
            output: '',
            error: error.message || '未知错误'
        };
    }
} 