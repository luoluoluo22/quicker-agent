import { SUBPROGRAM_NAMES } from './config.js'
import { addExecutionResultMessage } from './utils.js'

class ActionManager {
    constructor() {
        this.actionListContainer = null
        this.actionSearchInput = null
        this.actions = []
        this.filteredActions = []
        this.selectedActionIndex = -1
        
        // 延迟初始化事件监听器，等待 DOM 完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeEventListeners())
        } else {
            this.initializeEventListeners()
        }
    }

    initializeEventListeners() {
        // 获取并验证 DOM 元素
        this.actionListContainer = document.getElementById('action-list')
        this.actionSearchInput = document.getElementById('new-action-name')

        if (!this.actionListContainer || !this.actionSearchInput) {
            console.error('Required DOM elements not found for ActionManager')
            return
        }

        // 初始化动作编辑器
        this.initializeActionEditor()

        // 搜索框输入事件
        this.actionSearchInput.addEventListener('input', () => {
            this.filterActions()
        })

        // 搜索框键盘事件
        this.actionSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                this.navigateActions('up')
            } else if (event.key === 'ArrowDown') {
                event.preventDefault()
                this.navigateActions('down')
            } else if (event.key === 'Enter' && this.selectedActionIndex !== -1) {
                event.preventDefault()
                const selectedAction = this.filteredActions[this.selectedActionIndex]
                if (selectedAction) {
                    this.executeAction(selectedAction.name)
                    this.actionSearchInput.value = ''
                    this.filterActions()
                }
            }
        })

        // 点击动作列表项
        this.actionListContainer.addEventListener('click', (event) => {
            const actionItem = event.target.closest('.action-item')
            if (actionItem) {
                const actionName = actionItem.dataset.actionName
                if (actionName) {
                    this.executeAction(actionName)
                    this.actionSearchInput.value = ''
                    this.filterActions()
                }
            }
        })
    }

    // 加载动作列表
    async loadActions() {
        try {
            const v = typeof $quicker !== 'undefined' ? $quicker : null
            if (!v) {
                console.warn('$quicker object not available. Cannot load actions.')
                this.actions = []
                this.renderActionList()
                return
            }

            try {
                const savedActions = await v.getVar('quickerActions').catch(() => null)
                if (savedActions) {
                    try {
                        this.actions = JSON.parse(savedActions)
                    } catch (parseError) {
                        console.warn('Error parsing saved actions:', parseError)
                        this.actions = []
                    }
                } else {
                    console.log('No saved actions found, starting with empty list')
                    this.actions = []
                }
            } catch (error) {
                console.warn('Error loading actions:', error)
                this.actions = []
            }

            this.renderActionList()
        } catch (error) {
            console.error('Error in loadActions:', error)
            this.actions = []
            this.renderActionList()
        }
    }

    // 过滤动作列表
    filterActions() {
        if (!this.actionSearchInput || !this.actionListContainer) return

        const searchTerm = this.actionSearchInput.value.toLowerCase()
        this.filteredActions = this.actions.filter(action => 
            action.name.toLowerCase().includes(searchTerm) ||
            (action.description && action.description.toLowerCase().includes(searchTerm))
        )
        this.selectedActionIndex = -1
        this.renderActionList()
    }

    // 渲染动作列表
    renderActionList() {
        if (!this.actionListContainer) {
            console.error('Action list container not initialized')
            return
        }

        if (!this.filteredActions || this.filteredActions.length === 0) {
            this.actionListContainer.innerHTML = `
                <p class="text-xs text-gray-500 text-center">没有动作</p>
            `
            return
        }

        const actionItems = this.filteredActions.map((action, index) => {
            const actionItem = document.createElement('div')
            actionItem.className = `action-item flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer ${
                index === this.selectedActionIndex ? 'bg-gray-100' : ''
            }`
            actionItem.dataset.actionName = action.name

            // 图标
            const icon = document.createElement('i')
            icon.className = 'fas fa-bolt text-gray-400 mr-2'

            // 动作名称
            const nameSpan = document.createElement('span')
            nameSpan.className = 'flex-1'
            nameSpan.textContent = action.name

            // 删除按钮
            const deleteButton = document.createElement('button')
            deleteButton.className = 'text-red-500 hover:text-red-700 ml-2'
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>'
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation()
                this.deleteAction(action.name)
            })

            actionItem.appendChild(icon)
            actionItem.appendChild(nameSpan)
            actionItem.appendChild(deleteButton)

            return actionItem
        })

        this.actionListContainer.innerHTML = ''
        actionItems.forEach(item => this.actionListContainer.appendChild(item))
    }

    // 导航动作列表
    navigateActions(direction) {
        if (!this.actionListContainer || this.filteredActions.length === 0) return

        if (direction === 'up') {
            this.selectedActionIndex = this.selectedActionIndex <= 0 
                ? this.filteredActions.length - 1 
                : this.selectedActionIndex - 1
        } else if (direction === 'down') {
            this.selectedActionIndex = this.selectedActionIndex >= this.filteredActions.length - 1 
                ? 0 
                : this.selectedActionIndex + 1
        }

        this.renderActionList()

        // 确保选中项可见
        const selectedItem = this.actionListContainer.children[this.selectedActionIndex]
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest' })
        }
    }

    // 执行动作
    async executeAction(actionName) {
        console.log(`ActionManager: 开始执行动作 "${actionName}"`);
        
        const v = typeof $quickerSp !== 'undefined' ? $quickerSp : null
        if (!v) {
            console.error(`ActionManager: Quicker API 未连接，无法执行动作`);
            addExecutionResultMessage({
                success: false,
                action: actionName,
                error: 'Quicker API 未连接'
            }, '动作')
            return {
                success: false,
                action: actionName,
                error: 'Quicker API 未连接'
            };
        }

        try {
            const subprogramName = SUBPROGRAM_NAMES.EXECUTE_ACTION;
            console.log(`ActionManager: 调用子程序 ${subprogramName}，参数:`, {actionName});
            
            const spResult = await v(subprogramName, {
                actionName: actionName
            })
            console.log(`ActionManager: 子程序调用结果:`, spResult);

            // 检查子程序是否返回结果
            if (!spResult) {
                console.error(`ActionManager: 子程序未返回结果`);
                addExecutionResultMessage({
                    success: false,
                    action: actionName,
                    error: '子程序未返回结果'
                }, '动作')
                return {
                    success: false,
                    action: actionName,
                    error: '子程序未返回结果'
                };
            }
            
            // 尝试不同方式获取内部结果
            let innerResult = null;
            
            // 方式1: 通过子程序名称访问
            if (spResult[subprogramName] !== undefined) {
                console.log(`ActionManager: 通过子程序名称 "${subprogramName}" 获取内部结果`);
                innerResult = spResult[subprogramName];
            }
            // 方式2: 通过"ExecuteAction"键名访问
            else if (spResult["ExecuteAction"] !== undefined) {
                console.log(`ActionManager: 通过 "ExecuteAction" 键名获取内部结果`);
                innerResult = spResult["ExecuteAction"];
            }
            // 方式3: 直接使用返回值
            else if (typeof spResult.success === 'boolean') {
                console.log(`ActionManager: 直接使用返回值作为内部结果`);
                innerResult = spResult;
            } 
            // 方式4: 检查是否有runQuickerAction属性
            else if (spResult.runQuickerAction !== undefined) {
                console.log(`ActionManager: 通过runQuickerAction属性获取内部结果`);
                innerResult = spResult.runQuickerAction;
            }
            
            console.log(`ActionManager: 最终内部结果:`, innerResult);
            
            // 处理内部结果
            if (innerResult && typeof innerResult.success === 'boolean') {
                if (innerResult.success) {
                    console.log(`ActionManager: 动作执行成功`);
                    // 输出可能在result或output字段中
                    const output = innerResult.output || innerResult.result || '动作执行成功';
                    console.log(`ActionManager: 输出结果: ${output}`);
                    
                    addExecutionResultMessage({
                        success: true,
                        action: actionName,
                        output: output
                    }, '动作')
                    return {
                        success: true,
                        action: actionName,
                        output: output
                    };
                } else {
                    console.error(`ActionManager: 动作执行失败: ${innerResult.error || '未知错误'}`);
                    addExecutionResultMessage({
                        success: false,
                        action: actionName,
                        error: innerResult.error || '动作执行失败'
                    }, '动作')
                    return {
                        success: false,
                        action: actionName,
                        error: innerResult.error || '动作执行失败'
                    };
                }
            } 
            // 可能有些返回直接使用True字段表示成功
            else if (innerResult && (innerResult.True === "true" || innerResult.True === true)) {
                console.log(`ActionManager: 通过True字段判断为成功`);
                const output = innerResult.result || innerResult.output || innerResult.message || '动作执行成功';
                console.log(`ActionManager: 输出结果: ${output}`);
                
                addExecutionResultMessage({
                    success: true,
                    action: actionName,
                    output: output
                }, '动作')
                return {
                    success: true,
                    action: actionName,
                    output: output
                };
            }
            // 如果返回的是字符串，视为成功输出
            else if (typeof innerResult === 'string') {
                console.log(`ActionManager: 返回值是字符串，视为成功输出`);
                addExecutionResultMessage({
                    success: true,
                    action: actionName,
                    output: innerResult
                }, '动作')
                return {
                    success: true,
                    action: actionName,
                    output: innerResult
                };
            }
            // 如果返回的是对象但没有success属性
            else if (innerResult && typeof innerResult === 'object') {
                console.log(`ActionManager: 返回值是对象但没有success属性，尝试提取信息`);
                const output = innerResult.output || innerResult.result || innerResult.message || JSON.stringify(innerResult);
                const isSuccess = !innerResult.error && !innerResult.errorMessage;
                
                addExecutionResultMessage({
                    success: isSuccess,
                    action: actionName,
                    output: isSuccess ? output : '',
                    error: isSuccess ? '' : (innerResult.error || innerResult.errorMessage || '未知错误')
                }, '动作')
                return {
                    success: isSuccess,
                    action: actionName,
                    output: isSuccess ? output : '',
                    error: isSuccess ? '' : (innerResult.error || innerResult.errorMessage || '未知错误')
                };
            }
            else {
                console.error(`ActionManager: 无法解析执行结果`, innerResult);
                addExecutionResultMessage({
                    success: false,
                    action: actionName,
                    error: '无法解析执行结果'
                }, '动作')
                return {
                    success: false,
                    action: actionName,
                    error: '无法解析执行结果'
                };
            }
        } catch (error) {
            console.error(`ActionManager: 动作执行出错:`, error);
            addExecutionResultMessage({
                success: false,
                action: actionName,
                error: error.message || '动作执行出错'
            }, '动作')
            return {
                success: false,
                action: actionName,
                error: error.message || '动作执行出错'
            };
        }
    }

    // 保存动作列表
    async saveActions() {
        try {
            const v = typeof $quicker !== 'undefined' ? $quicker : null
            if (!v) {
                console.warn('$quicker object not available. Cannot save actions.')
                return false
            }

            await v.setVar('quickerActions', JSON.stringify(this.actions))
            return true
        } catch (error) {
            console.error('Error saving actions:', error)
            return false
        }
    }

    // 获取所有动作
    getActions() {
        return [...this.actions]
    }

    // 清除所有动作
    clearActions() {
        this.actions = []
        this.filteredActions = []
        this.selectedActionIndex = -1
        this.renderActionList()
        console.log('ActionManager: 已清除所有动作')
    }

    // 添加动作
    addAction(actionName, id = null) {
        if (!actionName || typeof actionName !== 'string' || actionName.trim() === '') {
            console.error('Invalid action name')
            return false
        }
        
        // 检查是否已存在同名动作
        if (this.actions.some(action => action.name === actionName)) {
            console.warn(`Action "${actionName}" already exists`)
            return false
        }
        
        // 使用提供的ID或生成新ID
        const actionId = id || Date.now() + Math.floor(Math.random() * 1000)
        
        this.actions.push({ 
            id: actionId,
            name: actionName 
        })
        
        // 排序动作列表
        this.actions.sort((a, b) => a.name.localeCompare(b.name))
        
        // 更新过滤后的列表
        this.filterActions()
        
        // 保存动作列表
        this.saveActions()
        
        return true
    }

    // 删除动作
    deleteAction(actionName) {
        const initialLength = this.actions.length
        this.actions = this.actions.filter(action => action.name !== actionName)
        
        if (this.actions.length !== initialLength) {
            this.filterActions()
            this.saveActions()
            return true
        }
        return false
    }

    // 初始化动作编辑器
    initializeActionEditor() {
        // 获取必要的DOM元素
        const actionEditorModal = document.getElementById('action-editor-modal')
        const newActionNameInput = document.getElementById('new-action-name')
        const addActionButton = document.getElementById('add-action-button')
        const closeActionEditorButton = document.getElementById('close-action-editor')
        const saveActionListButton = document.getElementById('save-action-list')

        if (!actionEditorModal || !newActionNameInput || !addActionButton) {
            console.error('Required DOM elements not found for ActionEditor')
            return
        }

        // 清除旧的事件监听器（如果有的话）
        const newAddActionButton = addActionButton.cloneNode(true)
        addActionButton.parentNode.replaceChild(newAddActionButton, addActionButton)
        
        // 添加动作按钮事件
        newAddActionButton.addEventListener('click', () => {
            const actionName = newActionNameInput.value.trim()
            if (actionName) {
                if (this.addAction(actionName)) {
                    newActionNameInput.value = ''
                    this.renderActionList()
                    // 成功消息
                    const message = document.createElement('div')
                    message.className = 'text-green-500 text-xs mt-1'
                    message.textContent = `已添加动作: ${actionName}`
                    setTimeout(() => message.remove(), 3000)
                    newActionNameInput.parentNode.appendChild(message)
                } else {
                    // 错误消息
                    const message = document.createElement('div')
                    message.className = 'text-red-500 text-xs mt-1'
                    message.textContent = `动作添加失败: 已存在同名动作`
                    setTimeout(() => message.remove(), 3000)
                    newActionNameInput.parentNode.appendChild(message)
                }
            }
        })

        // 新动作名称输入框Enter键事件
        newActionNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault()
                newAddActionButton.click()
            }
        })

        // 关闭按钮事件
        if (closeActionEditorButton) {
            closeActionEditorButton.addEventListener('click', () => {
                actionEditorModal.classList.add('hidden')
                newActionNameInput.value = ''
            })
        }

        // 点击背景关闭模态框
        actionEditorModal.addEventListener('click', (e) => {
            if (e.target === actionEditorModal) {
                actionEditorModal.classList.add('hidden')
                newActionNameInput.value = ''
            }
        })

        // 在动作编辑器打开时自动刷新动作列表
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const classList = actionEditorModal.classList;
                    if (!classList.contains('hidden')) {
                        console.log('ActionManager: 动作编辑器被打开，刷新动作列表');
                        this.renderActionList();
                    }
                }
            });
        });
        
        observer.observe(actionEditorModal, { attributes: true });

        // 保存按钮事件
        if (saveActionListButton) {
            saveActionListButton.addEventListener('click', async () => {
                const success = await this.saveActions()
                if (success) {
                    // 成功消息
                    const message = document.createElement('div')
                    message.className = 'text-green-500 text-xs mt-1 mb-1'
                    message.textContent = '动作列表已保存'
                    setTimeout(() => message.remove(), 3000)
                    saveActionListButton.parentNode.appendChild(message)
                } else {
                    // 错误消息
                    const message = document.createElement('div')
                    message.className = 'text-red-500 text-xs mt-1 mb-1'
                    message.textContent = '动作列表保存失败'
                    setTimeout(() => message.remove(), 3000)
                    saveActionListButton.parentNode.appendChild(message)
                }
            })
        }
    }

    // 测试子程序调用接口
    async testSubprogramCall(actionName) {
        console.log(`ActionManager: 测试执行动作 "${actionName}"`);
        
        // 检查API连接
        const v = typeof $quickerSp !== 'undefined' ? $quickerSp : null;
        if (!v) {
            console.error(`ActionManager: Quicker API ($quickerSp) 未连接`);
            return {
                success: false,
                message: 'Quicker API ($quickerSp) 未连接',
                api: 'missing'
            };
        }
        
        // 检查可用的子程序
        console.log(`ActionManager: 查看可用子程序`);
        try {
            // 尝试输出所有可用方法
            const apiKeys = Object.keys(v);
            console.log(`ActionManager: API ($quickerSp) 包含以下属性:`, apiKeys);
        } catch (error) {
            console.error(`ActionManager: 无法查看API属性:`, error);
        }
        
        // 检查子程序名称
        const subprogramName = SUBPROGRAM_NAMES.EXECUTE_ACTION;
        console.log(`ActionManager: 将使用子程序名称 "${subprogramName}"`);
        
        // 准备参数
        const params = { actionName };
        console.log(`ActionManager: 子程序参数:`, params);
        
        try {
            // 直接调用API
            console.log(`ActionManager: 直接调用子程序...`);
            const result = await v(subprogramName, params);
            console.log(`ActionManager: 子程序调用结果:`, result);
            
            return {
                success: true,
                message: '子程序调用成功',
                result
            };
        } catch (error) {
            console.error(`ActionManager: 调用子程序失败:`, error);
            return {
                success: false,
                message: `调用子程序失败: ${error.message || '未知错误'}`,
                error
            };
        }
    }
}

export const actionManager = new ActionManager()

// 将测试方法绑定到window对象，便于在控制台调试
window.testAction = async (actionName) => {
    console.log(`全局测试: 测试动作 "${actionName}"`);
    try {
        const result = await actionManager.testSubprogramCall(actionName);
        console.log(`全局测试: 测试子程序调用结果:`, result);
        
        // 尝试直接执行动作
        console.log(`全局测试: 尝试直接执行动作`);
        const execResult = await actionManager.executeAction(actionName);
        console.log(`全局测试: 动作执行结果:`, execResult);
        
        return {
            testCall: result,
            execResult: execResult
        };
    } catch (error) {
        console.error(`全局测试: 测试出错:`, error);
        return {
            success: false,
            error: error.message || '未知错误'
        };
    }
}; 