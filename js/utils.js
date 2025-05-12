const hljs = window.hljs;
// HTML 转义函数
export function escapeHTML(str) {
    if (!str) return ''
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// 流式响应读取器
export async function* readStream(reader) {
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data.trim() === '[DONE]') continue
                try {
                    yield JSON.parse(data)
                } catch (e) {
                    console.error('Error parsing JSON chunk:', e, 'Line:', line)
                }
            }
        }
    }

    if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6)
        if (data.trim() !== '[DONE]') {
            try {
                yield JSON.parse(data)
            } catch (e) {
                console.error('Error parsing remaining JSON buffer:', e, 'Buffer:', buffer)
            }
        }
    }
}

// API 请求配置生成器
export function getRequestConfig(messages, temperature, apiKey) {
    return {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: CONFIG.model,
            messages,
            temperature,
            stream: true,
        }),
    }
}

// 命令/动作执行结果消息生成器
export function addExecutionResultMessage(result, type = '命令') {
    console.log(`Utils: 显示${type}执行结果`, result);
    
    try {
        const messageDiv = document.createElement('div')
        messageDiv.className = 'message-animation max-w-3xl mx-auto'
        const iconClass = type === '命令' ? 'fa-terminal' : 'fa-bolt'
        const titleText = type === '命令' ? '命令执行结果' : '动作执行结果'
        const itemLabel = type === '命令' ? '命令' : '动作'
        
        // 兼容不同的属性名称
        let itemValue = '';
        if (type === '命令') {
            itemValue = result.command || '';
        } else {
            // 动作名称可能存储在action或actionName属性中
            itemValue = result.action || result.actionName || '';
        }
        
        console.log(`Utils: ${itemLabel}值: "${itemValue}"`);
        
        // 生成唯一ID用于折叠控制
        const resultId = `execution-result-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        messageDiv.innerHTML = `
            <div class="bg-gray-200 p-4 rounded-2xl shadow-sm execution-result-card">
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-300 flex items-center justify-center">
                        <i class="fas ${iconClass} text-gray-600"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center mb-1">
                            <p class="text-sm text-gray-600">${titleText}</p>
                            <button class="text-xs text-blue-600 hover:text-blue-800 focus:outline-none toggle-result-btn" 
                                    data-result-id="${resultId}">
                                <i class="fas fa-chevron-down" id="${resultId}-icon"></i> 
                                <span id="${resultId}-text">展开</span>
                            </button>
                        </div>
                        <div class="text-gray-800 text-sm">
                            <p class="font-semibold">${itemLabel}: <code>${escapeHTML(itemValue)}</code></p>
                            ${result.success
                                ? `<p class="text-green-700">状态: 成功</p>`
                                : `<p class="text-red-700">状态: 失败</p>`
                            }
                            <div id="${resultId}" class="hidden">
                                ${result.output || result.result
                                    ? `<div class="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                                        <p class="font-semibold mb-1">返回结果:</p>
                                        <pre class="whitespace-pre-wrap break-words">${escapeHTML(result.output || result.result)}</pre>
                                       </div>`
                                    : ''
                                }
                                ${result.error
                                    ? `<div class="mt-2 p-3 bg-red-100 border border-red-300 text-red-800 rounded text-xs overflow-x-auto">
                                        <p class="font-semibold mb-1">错误信息:</p>
                                        <pre class="whitespace-pre-wrap break-words">${escapeHTML(result.error)}</pre>
                                       </div>`
                                    : ''
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 将结果添加到消息容器
        console.log(`Utils: 将执行结果添加到消息容器`);
        const messagesContainer = document.getElementById('chat-container');
        if (messagesContainer) {
            messagesContainer.appendChild(messageDiv);
            // 滚动到底部
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            console.log(`Utils: 消息已添加到容器并滚动到底部`);
            
            // 添加展开/折叠切换事件
            const toggleButton = messageDiv.querySelector('.toggle-result-btn');
            if (toggleButton) {
                toggleButton.addEventListener('click', function() {
                    console.log('Utils: 展开/折叠按钮被点击');
                    const resultId = this.getAttribute('data-result-id');
                    const resultElement = document.getElementById(resultId);
                    const iconElement = document.getElementById(`${resultId}-icon`);
                    const textElement = document.getElementById(`${resultId}-text`);
                    
                    if (resultElement && resultElement.classList.contains('hidden')) {
                        console.log(`Utils: 展开结果 ${resultId}`);
                        resultElement.classList.remove('hidden');
                        iconElement.classList.remove('fa-chevron-down');
                        iconElement.classList.add('fa-chevron-up');
                        textElement.textContent = '折叠';
                    } else if (resultElement) {
                        console.log(`Utils: 折叠结果 ${resultId}`);
                        resultElement.classList.add('hidden');
                        iconElement.classList.remove('fa-chevron-up');
                        iconElement.classList.add('fa-chevron-down');
                        textElement.textContent = '展开';
                    } else {
                        console.error(`Utils: 无法找到结果元素 ${resultId}`);
                    }
                });
            } else {
                console.error(`Utils: 无法找到展开/折叠按钮`);
            }
        } else {
            console.error(`Utils: 找不到消息容器元素`);
        }
        
        return messageDiv;
    } catch (error) {
        console.error(`Utils: 创建${type}执行结果消息时出错:`, error);
        // 防止报错中断程序
        return document.createElement('div');
    }
}

// 消息添加器
export function addMessage(sender, text, isAI = false) {
    const messageDiv = document.createElement('div')
    messageDiv.className = 'message-animation max-w-3xl mx-auto'
    const contentHtml = isAI ? marked.parse(text) : text.replace(/\n/g, '<br>')
    
    messageDiv.innerHTML = `
        <div class="bg-white p-5 rounded-2xl shadow-sm">
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <i class="fas ${isAI ? 'fa-robot' : 'fa-user'} text-gray-500"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-500 mb-1">${sender}</p>
                    <div class="text-gray-700 markdown-body">${contentHtml}</div>
                </div>
            </div>
        </div>
    `

    // 代码高亮
    messageDiv.querySelectorAll('pre code').forEach((block) => {
        try {
            if (hljs && hljs.highlightElement) {
                hljs.highlightElement(block)
            }
        } catch (e) {
            console.error('Highlighting error:', e)
        }
        // 添加一键复制按钮
        const pre = block.parentElement;
        if (pre && !pre.querySelector('.copy-code-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-code-btn';
            copyBtn.innerText = '复制代码';
            copyBtn.onclick = function() {
                navigator.clipboard.writeText(block.innerText).then(() => {
                    copyBtn.innerText = '已复制!';
                    setTimeout(() => { copyBtn.innerText = '复制代码'; }, 1200);
                });
            };
            pre.appendChild(copyBtn);
        }
    })

    const aiMessageContent = messageDiv.querySelector('.message-content');
    aiMessageContent.className = "text-gray-700 message-content markdown-body";

    return messageDiv
} 