import { SUBPROGRAM_NAMES } from './config.js'
import { addExecutionResultMessage } from './utils.js'

/**
 * 读取当前关联窗口内容
 * @returns {Promise<Object>} 包含读取结果的对象
 */
export async function readContextWindow() {
    console.log('WindowOperations: 开始读取关联窗口内容');
    
    // 检查API是否可用
    const v = typeof $quickerSp !== 'undefined' ? $quickerSp : null;
    if (!v) {
        console.error('WindowOperations: Quicker API 未连接');
        return {
            success: false,
            output: '',
            error: 'Quicker API 未连接'
        };
    }
    
    // 使用配置文件中定义的子程序名称
    const subprogramName = SUBPROGRAM_NAMES.READ_CONTEXT_WINDOW;
    console.log(`WindowOperations: 子程序名称: "${subprogramName}"`);
    
    try {
        console.log(`WindowOperations: 尝试调用子程序`);
        const spResult = await v(subprogramName, {});
        
        console.log(`WindowOperations: 子程序调用完成, 结果:`, spResult);
        
        // 检查子程序是否存在
        if (!spResult) {
            console.error(`WindowOperations: 子程序 "${subprogramName}" 返回null或undefined`);
            return {
                success: false,
                output: '',
                error: `子程序 "${subprogramName}" 未返回结果`
            };
        }
        
        // 检查子程序返回的内部结果
        const innerResult = spResult[subprogramName];
        console.log(`WindowOperations: 内部结果:`, innerResult);
        
        if (innerResult && typeof innerResult === 'object') {
            // 根据子程序返回的成功状态决定执行结果
            const success = innerResult.success === true;
            const content = innerResult.content || '';
            const error = innerResult.error || '';
            
            console.log(`WindowOperations: 窗口内容读取${success ? '成功' : '失败'}`);
            if (content) console.log(`WindowOperations: 窗口内容: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
            if (error) console.error(`WindowOperations: 错误: ${error}`);
            
            return {
                success: success,
                content: content,
                error: error
            };
        } else {
            // 尝试直接使用spResult作为结果对象
            console.log(`WindowOperations: 尝试直接解析spResult:`, spResult);
            
            // 检查是否有直接的success,error属性
            if (spResult && typeof spResult === 'object') {
                // 查找字符串属性作为内容属性
                let foundContent = '';
                
                // 遍历所有属性寻找可能包含内容的属性
                for (const key in spResult) {
                    if (typeof spResult[key] === 'string' && spResult[key].length > 10) {
                        foundContent = spResult[key];
                        console.log(`WindowOperations: 找到可能的内容属性: ${key}`);
                        break;
                    }
                }
                
                // 尝试解析success属性，如果是字符串"true"则转换为布尔值
                const success = typeof spResult.success === 'string' 
                    ? spResult.success.toLowerCase() === 'true'
                    : Boolean(spResult.success);
                
                const content = foundContent || '';
                const error = spResult.error || '';
                
                console.log(`WindowOperations: 直接解析，窗口内容读取${success ? '成功' : '失败'}`);
                if (content) console.log(`WindowOperations: 直接解析，窗口内容: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
                
                return {
                    success: success,
                    content: content,
                    error: error
                };
            }
            
            console.error(`WindowOperations: 无效的内部结果格式:`, innerResult);
            return {
                success: false,
                content: '',
                error: '无效的窗口读取结果格式'
            };
        }
    } catch (error) {
        console.error(`WindowOperations: 窗口内容读取出错:`, error);
        return {
            success: false,
            content: '',
            error: error.message || '未知错误'
        };
    }
}

/**
 * 写入内容到当前关联窗口
 * @param {Object} params 写入参数
 * @param {string} params.content 要写入的内容
 * @param {string} [params.mode='append'] 写入模式: 'append', 'insert', 'override'
 * @param {string} [params.position='end'] 写入位置: 'start', 'end', 'cursor'
 * @returns {Promise<Object>} 包含写入结果的对象
 */
export async function writeToContextWindow(params) {
    console.log('WindowOperations: 开始写入内容到关联窗口', params);
    
    // 检查和准备参数
    if (!params || typeof params !== 'object') {
        console.error('WindowOperations: 参数无效');
        return {
            success: false,
            error: '参数无效'
        };
    }
    
    const content = params.content || '';
    const mode = params.mode || 'append';
    const position = params.position || 'end';
    
    if (!content) {
        console.error('WindowOperations: 内容为空');
        return {
            success: false,
            error: '写入内容不能为空'
        };
    }
    
    // 检查API是否可用
    const v = typeof $quickerSp !== 'undefined' ? $quickerSp : null;
    if (!v) {
        console.error('WindowOperations: Quicker API 未连接');
        return {
            success: false,
            error: 'Quicker API 未连接'
        };
    }
    
    // 使用配置文件中定义的子程序名称
    const subprogramName = SUBPROGRAM_NAMES.WRITE_TO_CONTEXT_WINDOW;
    console.log(`WindowOperations: 子程序名称: "${subprogramName}"`);
    
    try {
        console.log(`WindowOperations: 尝试调用子程序`);
        const spResult = await v(subprogramName, {
            content: content,
            mode: mode,
            position: position
        });
        
        console.log(`WindowOperations: 子程序调用完成, 结果:`, spResult);
        
        // 检查子程序是否存在
        if (!spResult) {
            console.error(`WindowOperations: 子程序 "${subprogramName}" 返回null或undefined`);
            return {
                success: false,
                error: `子程序 "${subprogramName}" 未返回结果`
            };
        }
        
        // 检查子程序返回的内部结果
        const innerResult = spResult[subprogramName];
        console.log(`WindowOperations: 内部结果:`, innerResult);
        
        if (innerResult && typeof innerResult === 'object') {
            // 根据子程序返回的成功状态决定执行结果
            const success = innerResult.success === true;
            const message = innerResult.message || '';
            const error = innerResult.error || '';
            
            console.log(`WindowOperations: 内容写入${success ? '成功' : '失败'}`);
            if (message) console.log(`WindowOperations: 消息: ${message}`);
            if (error) console.error(`WindowOperations: 错误: ${error}`);
            
            return {
                success: success,
                message: message,
                error: error
            };
        } else {
            // 尝试直接使用spResult作为结果对象
            console.log(`WindowOperations: 尝试直接解析spResult:`, spResult);
            
            // 检查是否有直接的success,error属性
            if (spResult && typeof spResult === 'object') {
                // 尝试解析success属性，如果是字符串"true"则转换为布尔值
                const success = typeof spResult.success === 'string' 
                    ? spResult.success.toLowerCase() === 'true'
                    : Boolean(spResult.success);
                
                const message = spResult.message || '';
                const error = spResult.error || '';
                
                console.log(`WindowOperations: 直接解析，内容写入${success ? '成功' : '失败'}`);
                if (message) console.log(`WindowOperations: 直接解析，消息: ${message}`);
                
                return {
                    success: success,
                    message: message,
                    error: error
                };
            }
            
            console.error(`WindowOperations: 无效的内部结果格式:`, innerResult);
            return {
                success: false,
                error: '无效的窗口写入结果格式'
            };
        }
    } catch (error) {
        console.error(`WindowOperations: 窗口内容写入出错:`, error);
        return {
            success: false,
            error: error.message || '未知错误'
        };
    }
}

/**
 * 在UI上显示窗口操作结果
 * @param {Object} result 操作结果
 * @param {string} operationType 操作类型："读取" 或 "写入"
 */
export function displayWindowOperationResult(result, operationType) {
    addExecutionResultMessage({
        success: result.success,
        operation: operationType,
        output: result.success
            ? (operationType === "读取" ? result.content : result.message || "操作成功")
            : undefined,
        error: result.error
    }, '窗口操作');
} 