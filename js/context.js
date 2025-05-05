import { SUBPROGRAM_NAMES } from './config.js'

class ContextManager {
    constructor() {
        this.isContextActive = false
        this.contextTitle = '未关联窗口'
        this.contextContent = ''
        this.contextIconBase64 = null
        this.contextScreenshotBase64 = null
        
        // DOM 元素
        this.contextButtonArea = document.getElementById('context-button-area')
        this.contextIconImg = document.getElementById('context-icon')
        this.contextDefaultIcon = document.getElementById('context-default-icon')
        this.contextTitleSpan = document.getElementById('context-title')
        this.contextStatusSpan = document.getElementById('context-status')
        this.contextScreenshotPreviewImg = document.getElementById('context-screenshot-preview')
        this.editContextButton = document.getElementById('edit-context-button')
        
        // 模态框元素
        this.contextEditorModal = document.getElementById('context-editor-modal')
        this.editContextTitleInput = document.getElementById('edit-context-title')
        this.editContextContentInput = document.getElementById('edit-context-content')
        this.editContextScreenshotImg = document.getElementById('edit-context-screenshot')
        this.saveContextEditButton = document.getElementById('save-context-edit')
        this.cancelContextEditButton = document.getElementById('cancel-context-edit')

        this.initializeEventListeners()
    }

    // 初始化事件监听器
    initializeEventListeners() {
        // 上下文按钮点击事件
        this.contextButtonArea.addEventListener('click', (event) => {
            if (event.target.closest('#edit-context-button')) return
            if (this.contextContent) {
                this.isContextActive = !this.isContextActive
                this.updateUI()
            }
        })

        // 编辑按钮点击事件
        this.editContextButton.addEventListener('click', () => {
            this.openEditor()
        })

        // 保存编辑按钮点击事件
        this.saveContextEditButton.addEventListener('click', () => {
            this.saveEdit()
        })

        // 取消编辑按钮点击事件
        this.cancelContextEditButton.addEventListener('click', () => {
            this.closeEditor()
        })

        // 点击模态框外部关闭
        this.contextEditorModal.addEventListener('click', (event) => {
            if (event.target === this.contextEditorModal) {
                this.closeEditor()
            }
        })
    }

    // 更新 UI
    updateUI() {
        // 更新标题显示
        this.contextTitleSpan.textContent = this.contextTitle || '未关联窗口'

        // 更新图标显示
        if (this.contextIconBase64) {
            this.contextIconImg.src = `data:image/png;base64,${this.contextIconBase64}`
            this.contextIconImg.classList.remove('hidden')
            this.contextDefaultIcon.classList.add('hidden')
        } else {
            this.contextIconImg.src = ''
            this.contextIconImg.classList.add('hidden')
            this.contextDefaultIcon.classList.remove('hidden')
        }

        // 确定状态文本和颜色
        let statusText = '未获取内容'
        let statusColorClass = 'text-gray-400'
        let isActiveStyle = false

        if (this.contextContent) {
            if (this.isContextActive) {
                statusText = '已激活'
                statusColorClass = 'text-green-600'
                isActiveStyle = true
                this.contextScreenshotPreviewImg.style.display = 'block'
            } else {
                statusText = '已获取 (未激活)'
                statusColorClass = 'text-gray-400'
                this.contextScreenshotPreviewImg.style.display = 'none'
            }
        } else {
            this.isContextActive = false
            statusText = '未获取内容'
            statusColorClass = 'text-gray-400'
            this.contextScreenshotPreviewImg.style.display = 'none'
        }

        this.contextStatusSpan.textContent = statusText
        this.contextStatusSpan.className = `text-xs mr-2 flex-shrink-0 ${statusColorClass}`

        // 更新按钮激活样式
        if (isActiveStyle) {
            this.contextButtonArea.classList.add('context-active')
            this.contextButtonArea.classList.remove('hover:bg-gray-50', 'border-transparent')
            this.contextButtonArea.classList.add('border-green-300')
        } else {
            this.contextButtonArea.classList.remove('context-active', 'border-green-300')
            if (this.contextContent) {
                this.contextButtonArea.classList.add('hover:bg-gray-50')
            } else {
                this.contextButtonArea.classList.remove('hover:bg-gray-50')
            }
            this.contextButtonArea.classList.add('border-transparent')
        }

        // 更新截图预览
        if (this.contextScreenshotBase64 && this.contextScreenshotPreviewImg.style.display !== 'none') {
            this.contextScreenshotPreviewImg.src = `data:image/png;base64,${this.contextScreenshotBase64}`
        } else {
            this.contextScreenshotPreviewImg.src = ''
        }
    }

    // 打开编辑器
    openEditor() {
        this.editContextTitleInput.value = this.contextTitle
        this.editContextContentInput.value = this.contextContent

        if (this.contextScreenshotBase64) {
            this.editContextScreenshotImg.src = `data:image/png;base64,${this.contextScreenshotBase64}`
            this.editContextScreenshotImg.classList.remove('hidden')
        } else {
            this.editContextScreenshotImg.src = ''
            this.editContextScreenshotImg.classList.add('hidden')
        }

        this.contextEditorModal.classList.remove('hidden')
    }

    // 保存编辑
    saveEdit() {
        this.contextTitle = this.editContextTitleInput.value.trim()
        this.contextContent = this.editContextContentInput.value.trim()
        this.isContextActive = !!this.contextContent
        this.updateUI()
        this.closeEditor()
    }

    // 关闭编辑器
    closeEditor() {
        this.contextEditorModal.classList.add('hidden')
    }

    // 获取初始上下文
    async fetchInitialContext() {
        const v = typeof $quickerSp !== 'undefined' ? $quickerSp : null
        if (!v) {
            console.warn('$quickerSp object not available. Cannot fetch context.')
            this.contextStatusSpan.textContent = 'API 未连接'
            this.contextStatusSpan.classList.remove('text-orange-500')
            this.contextStatusSpan.classList.add('text-red-500')
            this.updateUI()
            return
        }

        this.contextStatusSpan.textContent = '获取中...'
        this.contextStatusSpan.classList.remove('text-gray-400', 'text-green-600', 'text-red-500', 'text-yellow-600')
        this.contextStatusSpan.classList.add('text-orange-500')
        this.contextButtonArea.classList.remove('context-active', 'border-green-300', 'hover:bg-gray-50')
        this.contextButtonArea.classList.add('border-transparent')
        this.contextIconImg.classList.add('hidden')
        this.contextDefaultIcon.classList.remove('hidden')
        this.contextScreenshotPreviewImg.style.display = 'none'

        try {
            // 导入元数据配置
            const { CONTEXT_METADATA } = await import('./config.js');
            console.log('ContextManager: 加载上下文元数据配置', CONTEXT_METADATA);
            
            // 构建子程序参数，包含元数据请求设置
            const spParams = {
                getProcessName: CONTEXT_METADATA.GET_PROCESS_NAME || false,
                getProcessPath: CONTEXT_METADATA.GET_PROCESS_PATH || false,
                getProcessDescription: CONTEXT_METADATA.GET_PROCESS_DESCRIPTION || false,
                getWindowRect: CONTEXT_METADATA.GET_WINDOW_RECT || false,
                getWindowClass: CONTEXT_METADATA.GET_WINDOW_CLASS || false,
                getSelectedText: CONTEXT_METADATA.GET_SELECTED_TEXT || false,
                getWindowsOsVersion: CONTEXT_METADATA.GET_WINDOWS_OS_VERSION || false
            };
            
            console.log('ContextManager: 调用子程序获取上下文，参数:', spParams);
            const spResult = await v(SUBPROGRAM_NAMES.GET_CONTEXT, spParams);
            
            // 打印子程序的原始完整返回结果
            console.log('ContextManager: 子程序原始返回结果:', JSON.stringify(spResult));
            
            const innerResult = spResult ? spResult[SUBPROGRAM_NAMES.GET_CONTEXT] : null;
            
            // 打印内部结果
            console.log('ContextManager: 内部结果对象:', JSON.stringify(innerResult));

            if (innerResult && innerResult.success) {
                this.contextTitle = innerResult.title || '关联窗口 (无标题)'
                this.contextContent = innerResult.content || ''
                this.contextIconBase64 = innerResult.iconBase64 || null
                this.contextScreenshotBase64 = innerResult.screenshotBase64 || null
                
                // 处理和存储额外的元数据
                this.processMetadata(innerResult);

                if (innerResult.error) {
                    console.warn('Quicker SP reported non-fatal error:', innerResult.error)
                }

                this.isContextActive = !!this.contextContent
                this.updateUI()
            } else {
                const errorMsg = innerResult
                    ? innerResult.error || '未知错误'
                    : spResult && spResult.error
                    ? spResult.error
                    : '子程序调用失败'
                console.error('Quicker subprogram error:', errorMsg)

                this.isContextActive = false
                this.contextTitle = '获取失败'
                this.contextContent = ''
                this.contextIconBase64 = null
                this.contextScreenshotBase64 = null
                this.metadata = null  // 清除元数据
                this.updateUI()
                this.contextStatusSpan.textContent = '获取失败'
                this.contextStatusSpan.classList.remove('text-orange-500')
                this.contextStatusSpan.classList.add('text-red-500')
            }
        } catch (error) {
            console.error('Error calling Quicker subprogram:', error)

            this.isContextActive = false
            this.contextTitle = '调用错误'
            this.contextContent = ''
            this.contextIconBase64 = null
            this.contextScreenshotBase64 = null
            this.metadata = null  // 清除元数据
            this.updateUI()
            this.contextStatusSpan.textContent = '调用错误'
            this.contextStatusSpan.classList.remove('text-orange-500')
            this.contextStatusSpan.classList.add('text-red-500')
        } finally {
            if (!this.isContextActive && this.contextContent) {
                this.contextButtonArea.classList.add('hover:bg-gray-50')
            } else {
                this.contextButtonArea.classList.remove('hover:bg-gray-50')
            }
        }
    }

    // 获取当前上下文状态
    getContextState() {
        return {
            isActive: this.isContextActive,
            title: this.contextTitle,
            content: this.contextContent,
            metadata: this.metadata  // 添加元数据属性到返回对象
        }
    }

    // 新增：处理和存储元数据
    processMetadata(result) {
        try {
            // 初始化元数据对象
            this.metadata = {
                processName: null,
                processPath: null,
                processDescription: null,
                windowRect: null,
                windowClass: null,
                selectedText: null,
                windowsOsVersion: null
            };
            
            // 提取进程名称、路径和描述（如果可用）
            if (result.processName) {
                this.metadata.processName = result.processName;
                console.log('ContextManager: 提取到进程名称:', result.processName);
            }
            
            if (result.processPath) {
                this.metadata.processPath = result.processPath;
                console.log('ContextManager: 提取到进程路径:', result.processPath);
            }
            
            if (result.processDescription) {
                this.metadata.processDescription = result.processDescription;
                console.log('ContextManager: 提取到进程描述:', result.processDescription);
            }
            
            // 添加窗口矩形信息处理
            if (result.windowRect) {
                this.metadata.windowRect = result.windowRect;
                console.log('ContextManager: 提取到窗口矩形:', result.windowRect);
            }
            
            // 添加窗口类名处理
            if (result.windowClass) {
                this.metadata.windowClass = result.windowClass;
                console.log('ContextManager: 提取到窗口类名:', result.windowClass);
            }
            
            // 添加选中文本处理
            if (result.selectedText) {
                this.metadata.selectedText = result.selectedText;
                console.log('ContextManager: 提取到选中文本:', result.selectedText);
            }
            
            // 添加Windows系统版本处理
            if (result.windowsOsVersion) {
                this.metadata.windowsOsVersion = result.windowsOsVersion;
                console.log('ContextManager: 提取到Windows系统版本:', result.windowsOsVersion);
            }
            
            // 如果元数据全部为空，则设为null
            if (!this.metadata.processName && 
                !this.metadata.processPath && 
                !this.metadata.processDescription && 
                !this.metadata.windowRect && 
                !this.metadata.windowClass &&
                !this.metadata.selectedText &&
                !this.metadata.windowsOsVersion) {
                this.metadata = null;
                console.log('ContextManager: 未找到有效的元数据');
            } else {
                console.log('ContextManager: 成功处理元数据');
            }
        } catch (error) {
            console.error('ContextManager: 处理元数据时出错:', error);
            this.metadata = null;
        }
    }
}

export const contextManager = new ContextManager() 