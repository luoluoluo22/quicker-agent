using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Input;
using System.Windows.Documents;
using System.Windows.Media.Effects;
using System.Windows.Media.Animation;
using Quicker;
using Quicker.Public;
using Quicker.Common;
using Quicker.Public.Interfaces;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Net.Http;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using System.IO;
using System.Diagnostics;
using System.Linq;
using System.Windows.Threading;

// 全局变量
public static List<Dictionary<string, object>> Messages = new List<Dictionary<string, object>>();
public static string SelectedModel = "系统极客";
public static HttpClient client = new HttpClient();

// 模型配置 - 这些变量将从数据映射中获取
public static string ModelName = "";
public static string ApiKey = "";
public static string BaseUrl = "";

public static bool IsStreaming = true;
public static StringBuilder CurrentStreamContent = new StringBuilder();

// 日志相关
public static string LogFilePath = Path.Combine(
    AppDomain.CurrentDomain.BaseDirectory,
    "ChatAppLog.txt"
);

public static void Log(string message, Exception ex = null)
{
    try
    {
        string timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
        string logMessage = "[" + timestamp + "] " + message;
        
        if (ex != null)
        {
            logMessage += "\nException: " + ex.GetType().Name + 
                         "\nMessage: " + ex.Message + 
                         "\nStack Trace: " + ex.StackTrace;
            if (ex.InnerException != null)
            {
                logMessage += "\nInner Exception: " + ex.InnerException.Message;
            }
        }
        
        File.AppendAllText(LogFilePath, logMessage + "\n\n");
        Debug.WriteLine(logMessage);
    }
    catch (Exception logEx)
    {
        Debug.WriteLine("Logging failed: " + logEx.Message);
    }
}

public static void ClearLog()
{
    try
    {
        if (File.Exists(LogFilePath))
        {
            File.Delete(LogFilePath);
        }
    }
    catch { }
}

// 从数据映射加载配置
public static void LoadConfigFromDataMapping(IDictionary<string, object> dataContext)
{
    try
    {
        // 从dataContext中获取配置
        var modelName = dataContext.ContainsKey("ModelName") ? dataContext["ModelName"].ToString() : "Qwen/Qwen2.5-7B-Instruct";
        var apiKey = dataContext.ContainsKey("ApiKey") ? dataContext["ApiKey"].ToString() : "";
        var baseUrl = dataContext.ContainsKey("BaseUrl") ? dataContext["BaseUrl"].ToString() : "https://api.siliconflow.cn/v1";
        var isStreaming = dataContext.ContainsKey("IsStreaming") ? Convert.ToBoolean(dataContext["IsStreaming"]) : true;
        
        // 更新到dataContext
        dataContext["ModelName"] = modelName;
        dataContext["ApiKey"] = apiKey;
        dataContext["BaseUrl"] = baseUrl;
        dataContext["IsStreaming"] = isStreaming;
        
        Log("从数据映射加载配置 - ModelName: " + modelName);
        Log("从数据映射加载配置 - BaseUrl: " + baseUrl);
        Log("从数据映射加载配置 - IsStreaming: " + isStreaming);
    }
    catch (Exception ex)
    {
        Log("从数据映射加载配置失败", ex);
    }
}

// 保存配置到数据映射
public static void SaveConfigToDataMapping(IDictionary<string, object> dataContext)
{
    try
    {
        // 配置已经在dataContext中，不需要额外保存
        Log("配置已在dataContext中更新");
    }
    catch (Exception ex)
    {
        Log("保存配置失败", ex);
    }
}

// 窗口创建事件
public static void OnWindowCreated(Window win, IDictionary<string, object> dataContext, ICustomWindowContext winContext)
{
    Log("开始创建窗口");

    try
    {
        // 清空历史消息
        Messages.Clear();
        CurrentStreamContent.Clear();
        Log("已清空历史消息");
        
        // 重新初始化HttpClient
        if (client != null)
        {
            client.Dispose();
        }
        client = new HttpClient();
        Log("已重新初始化HttpClient");
        
        // 加载配置
        LoadConfigFromDataMapping(dataContext);
        
        // 确保全局变量被更新
        ModelName = dataContext["ModelName"].ToString();
        ApiKey = dataContext["ApiKey"].ToString();
        BaseUrl = dataContext["BaseUrl"].ToString();
        IsStreaming = Convert.ToBoolean(dataContext["IsStreaming"]);
        
        // 设置HttpClient的BaseAddress
        client.BaseAddress = new Uri(BaseUrl);
        Log(string.Format("已设置HttpClient BaseAddress: {0}", BaseUrl));
        
        // 初始化数据
        dataContext["WindowTitle"] = "聊天助手";
        dataContext["MainPrompt"] = "有什么可以帮忙的？";
        dataContext["InputText"] = "";
        dataContext["IsStreaming"] = IsStreaming;
        dataContext["Messages"] = Messages;
        
        // 设置窗口属性
        win.WindowStartupLocation = WindowStartupLocation.CenterScreen;
        win.ResizeMode = ResizeMode.CanResizeWithGrip;
        
        // 检查是否有传入参数
        if (dataContext.ContainsKey("quicker_in_param") && dataContext["quicker_in_param"] != null)
        {
            string inParam = dataContext["quicker_in_param"].ToString();
            Log("检测到传入参数: " + inParam);
            
            if (!string.IsNullOrWhiteSpace(inParam))
            {
                Log("将传入参数设置到输入框: " + inParam);
                dataContext["InputText"] = inParam;
                dataContext["AutoSendMessage"] = true;
            }
        }
        
        Log("窗口创建完成");
    }
    catch (Exception ex)
    {
        Log("窗口创建失败", ex);
        MessageBox.Show("窗口创建过程中发生错误，请查看日志文件了解详情。", "错误", MessageBoxButton.OK, MessageBoxImage.Error);
    }
}

// 窗口加载事件
public static void OnWindowLoaded(Window win, IDictionary<string, object> dataContext, ICustomWindowContext winContext)
{
    Application.Current.DispatcherUnhandledException += (sender, e) =>
    {
        Log("发生未处理的异常", e.Exception);
        MessageBox.Show(
            "发生未预期的错误，请查看日志文件了解详情。\n\n错误信息：" + e.Exception.Message, 
            "错误", 
            MessageBoxButton.OK, 
            MessageBoxImage.Error
        );
        e.Handled = true;
    };

    try
    {
        Log("开始加载窗口");
        
        // 获取界面元素
        var btnClose = (Button)win.FindName("BtnClose");
        var btnMinimize = (Button)win.FindName("BtnMinimize");
        var btnExpand = (Button)win.FindName("BtnExpand");
        var btnSend = (Button)win.FindName("BtnSend");
        var txtInput = (TextBox)win.FindName("TxtInput");
        var btnAttachment = (Button)win.FindName("BtnAttachment");
        var messageContainer = (StackPanel)win.FindName("MessageContainer");
        var messageScrollViewer = (ScrollViewer)win.FindName("MessageScrollViewer");
        var titleBar = (Grid)win.FindName("TitleBar");
        var btnSettings = (Button)win.FindName("BtnSettings");
        var settingsPanel = (Border)win.FindName("SettingsPanel");
        var btnSaveSettings = (Button)win.FindName("BtnSaveSettings");
        var btnCancelSettings = (Button)win.FindName("BtnCancelSettings");
        var btnCreateImage = (Button)win.FindName("BtnCreateImage");
        var btnAnalyzeData = (Button)win.FindName("BtnAnalyzeData");
        var btnSurpriseMe = (Button)win.FindName("BtnSurpriseMe");
        var btnAnalyzeImage = (Button)win.FindName("BtnAnalyzeImage");
        
        Log("成功获取所有UI元素");

        // 注册事件处理
        titleBar.MouseLeftButtonDown += (s, e) => { if (e.ChangedButton == MouseButton.Left) win.DragMove(); };
        btnClose.Click += (s, e) => win.Close();
        btnMinimize.Click += (s, e) => win.WindowState = WindowState.Minimized;
        btnExpand.Click += (s, e) => win.WindowState = win.WindowState == WindowState.Normal ? WindowState.Maximized : WindowState.Normal;
        btnSettings.Click += (s, e) => { settingsPanel.Visibility = Visibility.Visible; Log("打开设置面板"); };
        
        btnSaveSettings.Click += (s, e) =>
        {
            try
            {
                // 更新配置
                ModelName = dataContext["ModelName"].ToString();
                ApiKey = dataContext["ApiKey"].ToString();
                BaseUrl = dataContext["BaseUrl"].ToString();
                
                // 立即保存到数据映射
                SaveConfigToDataMapping(dataContext);
                
                // 更新UI显示
                dataContext["CurrentModel"] = GetShortModelName(ModelName);
                settingsPanel.Visibility = Visibility.Collapsed;
                
                // 更新HTTP客户端的Authorization
                try
                {
                    client.DefaultRequestHeaders.Remove("Authorization");
                    client.DefaultRequestHeaders.Add("Authorization", "Bearer " + ApiKey);
                    Log("设置已保存并更新：" + ModelName);
                }
                catch (Exception authEx)
                {
                    Log("更新Authorization头部出错，尝试替代方法", authEx);
                    client.DefaultRequestHeaders.Clear();
                    client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", "Bearer " + ApiKey);
                }
            }
            catch (Exception ex)
            {
                Log("保存设置失败", ex);
                MessageBox.Show("保存设置时发生错误", "错误", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        };
        
        btnCancelSettings.Click += (s, e) =>
        {
            dataContext["ModelName"] = ModelName;
            dataContext["ApiKey"] = ApiKey;
            dataContext["BaseUrl"] = BaseUrl;
            settingsPanel.Visibility = Visibility.Collapsed;
            Log("设置已取消");
        };
        
        btnSend.Click += (s, e) => 
        {
            Log("点击发送按钮");
            SendMessage(win, dataContext, txtInput, messageContainer, messageScrollViewer);
        };
        
        txtInput.KeyDown += (s, e) =>
        {
            Log("事件序号[1] - KeyDown: " + e.Key);
            
            if (e.Key == Key.Enter)
            {
                Log("事件序号[1] - 检测到回车键，检查修饰键状态");
                bool leftShiftDown = Keyboard.IsKeyDown(Key.LeftShift);
                bool rightShiftDown = Keyboard.IsKeyDown(Key.RightShift);
                Log("事件序号[1] - LeftShift按下: " + leftShiftDown + ", RightShift按下: " + rightShiftDown);
                
                if (!leftShiftDown && !rightShiftDown)
                {
                    Log("事件序号[1] - 准备通过回车发送消息");
                    e.Handled = true; // 先标记为已处理，防止事件继续传播
                    SendMessage(win, dataContext, txtInput, messageContainer, messageScrollViewer);
                    Log("事件序号[1] - 回车发送消息完成");
                }
                else
                {
                    Log("事件序号[1] - 检测到Shift+Enter，允许换行");
                }
            }
        };
        
        // 防止可能的TextBox默认行为干扰Enter键处理
        txtInput.PreviewKeyDown += (s, e) =>
        {
            Log("事件序号[0] - PreviewKeyDown: " + e.Key);
            Log("事件序号[0] - 输入框文本: [" + txtInput.Text + "]");
            
            if (e.Key == Key.Enter && !Keyboard.IsKeyDown(Key.LeftShift) && !Keyboard.IsKeyDown(Key.RightShift))
            {
                Log("事件序号[0] - PreviewKeyDown检测到回车键，准备发送消息");
                
                if (string.IsNullOrWhiteSpace(txtInput.Text))
                {
                    Log("事件序号[0] - 输入框为空，尝试从DataContext获取文本");
                    // 尝试从DataContext获取文本
                    if (dataContext.ContainsKey("InputText"))
                    {
                        var contextText = dataContext["InputText"] as string;
                        if (!string.IsNullOrWhiteSpace(contextText))
                        {
                            Log("事件序号[0] - 从DataContext获取到文本: [" + contextText + "]");
                            txtInput.Text = contextText;
                            // 更新UI
                            Log("事件序号[0] - 强制UI更新");
                            Application.Current.Dispatcher.Invoke(DispatcherPriority.Render, new Action(() => { }));
                        }
                        else
                        {
                            Log("事件序号[0] - DataContext中的文本也为空，不发送消息");
                            return;
                        }
                    }
                    else
                    {
                        Log("事件序号[0] - 输入框为空，不发送消息");
                        return;
                    }
                }
                
                e.Handled = true;
                
                // 直接在PreviewKeyDown中调用SendMessage
                SendMessage(win, dataContext, txtInput, messageContainer, messageScrollViewer);
                Log("事件序号[0] - PreviewKeyDown中发送消息完成");
            }
        };
        
        // 功能按钮事件
        btnCreateImage.Click += (s, e) => AddActionToInput(txtInput, "创建一张图片：");
        btnAnalyzeData.Click += (s, e) => AddActionToInput(txtInput, "分析以下数据：");
        btnSurpriseMe.Click += (s, e) => AddActionToInput(txtInput, "给我一个惊喜，");
        btnAnalyzeImage.Click += (s, e) => AddActionToInput(txtInput, "分析这张图片：[图片]");
        btnAttachment.Click += (s, e) => AddActionToInput(txtInput, "[附件]");
        
        // 初始化HTTP客户端
        try
        {
            client.DefaultRequestHeaders.Remove("Authorization");
            client.DefaultRequestHeaders.Add("Authorization", "Bearer " + ApiKey);
            Log("成功设置Authorization头部");
        }
        catch (Exception ex)
        {
            Log("设置Authorization头部出错，尝试替代方法", ex);
            // 替代方法
            client.DefaultRequestHeaders.Clear();
            client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", "Bearer " + ApiKey);
        }
        dataContext["CurrentModel"] = GetShortModelName(ModelName);
        
        txtInput.Focus();
        Log("窗口加载完成，输入框已获取焦点: " + (txtInput.IsFocused ? "是" : "否"));
        Log("窗口加载完成, 模型：" + ModelName);
        
        // 检查是否需要自动发送消息
        if (dataContext.ContainsKey("AutoSendMessage") && (bool)dataContext["AutoSendMessage"] && !string.IsNullOrWhiteSpace(txtInput.Text))
        {
            Log("检测到自动发送标记，准备自动发送消息...");
            
            // 使用延迟确保UI已完全加载
            Application.Current.Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => 
            {
                try
                {
                    Log("执行自动发送消息: " + txtInput.Text);
                    SendMessage(win, dataContext, txtInput, messageContainer, messageScrollViewer);
                    
                    // 发送后清除标记
                    dataContext["AutoSendMessage"] = false;
                    
                    Log("自动发送消息完成");
                }
                catch (Exception ex)
                {
                    Log("自动发送消息失败", ex);
                }
            }));
        }
    }
    catch (Exception ex)
    {
        Log("窗口加载失败", ex);
        MessageBox.Show("窗口加载过程中发生错误，请查看日志文件了解详情。", "错误", MessageBoxButton.OK, MessageBoxImage.Error);
    }
}

// 按钮点击事件
public static bool OnButtonClicked(string controlName, object controlTag, Window win, IDictionary<string, object> dataContext, ICustomWindowContext winContext)
{
    switch (controlName)
    {
        case "BtnSettings":
            var settingsPanel = (Border)win.FindName("SettingsPanel");
            settingsPanel.Visibility = Visibility.Visible;
            Log("打开设置面板");
            return true;
            
        case "BtnSaveSettings":
            try
            {
                // 更新配置
                ModelName = dataContext["ModelName"].ToString();
                ApiKey = dataContext["ApiKey"].ToString();
                BaseUrl = dataContext["BaseUrl"].ToString();
                
                // 立即保存到数据映射
                SaveConfigToDataMapping(dataContext);
                
                // 更新UI显示
                dataContext["CurrentModel"] = GetShortModelName(ModelName);
                var settingsPanel2 = (Border)win.FindName("SettingsPanel");
                settingsPanel2.Visibility = Visibility.Collapsed;
                
                // 更新HTTP客户端的Authorization
                try
                {
                    client.DefaultRequestHeaders.Remove("Authorization");
                    client.DefaultRequestHeaders.Add("Authorization", "Bearer " + ApiKey);
                    Log("设置已保存并更新：" + ModelName);
                }
                catch (Exception authEx)
                {
                    Log("更新Authorization头部出错，尝试替代方法", authEx);
                    client.DefaultRequestHeaders.Clear();
                    client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", "Bearer " + ApiKey);
                }
            }
            catch (Exception ex)
            {
                Log("保存设置失败", ex);
                MessageBox.Show("保存设置时发生错误", "错误", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            return true;
            
        case "BtnCancelSettings":
            var settingsPanel3 = (Border)win.FindName("SettingsPanel");
            settingsPanel3.Visibility = Visibility.Collapsed;
            Log("设置已取消");
            return true;
    }
    
    return false;
}

// 更新调试信息
public static void UpdateDebugInfo(Window win, string message)
{
    try
    {
        var debugInfo = (TextBlock)win.FindName("TxtDebugInfo");
        if (debugInfo != null)
        {
            debugInfo.Text = message;
        }
        Log("调试信息：" + message);
    }
    catch (Exception ex)
    {
        Log("更新调试信息失败", ex);
    }
}

// 发送消息的方法
public static async void SendMessage(Window win, IDictionary<string, object> dataContext, TextBox txtInput, StackPanel messageContainer, ScrollViewer messageScrollViewer)
{
    try
    {
        Log("SendMessage方法开始执行");
        Log("输入框文本长度: " + (txtInput.Text != null ? txtInput.Text.Length : 0));
        Log("输入框文本内容: [" + txtInput.Text + "]");
        
        // 检查DataContext中的输入文本
        if (dataContext.ContainsKey("InputText"))
        {
            var contextText = dataContext["InputText"] as string;
            Log("DataContext中的文本: [" + contextText + "]");
            
            // 如果DataContext中有文本但输入框为空，则同步
            if (!string.IsNullOrEmpty(contextText) && string.IsNullOrEmpty(txtInput.Text))
            {
                Log("从DataContext同步文本到输入框");
                txtInput.Text = contextText;
            }
        }

        var userMessage = txtInput.Text.Trim();
        Log("去除空格后的消息长度: " + userMessage.Length);
        
        if (string.IsNullOrEmpty(userMessage))
        {
            Log("消息为空，退出发送");
            return;
        }

        Log("发送消息: " + userMessage);
        txtInput.Text = string.Empty;

        var messages = new List<Dictionary<string, object>>();
        var userMessageDict = new Dictionary<string, object>();
        userMessageDict.Add("role", "user");
        userMessageDict.Add("content", userMessage);
        userMessageDict.Add("timestamp", DateTime.Now);
        messages.Add(userMessageDict);
        Messages.Add(userMessageDict);

        AddMessage(messageContainer, userMessage, true);
        ScrollToBottom(messageScrollViewer);
        
        // 重新让输入框获得焦点
        txtInput.Focus();
        Log("发送后重新设置输入框焦点: " + (txtInput.IsFocused ? "成功" : "失败"));

        try
        {
            await GetAIResponse(win, dataContext, messageContainer, messageScrollViewer);
        }
        catch (Exception ex)
        {
            Log("获取AI响应失败", ex);
            MessageBox.Show("获取AI响应时发生错误，请查看日志了解详情。", "错误", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }
    catch (Exception ex)
    {
        Log("发送消息失败", ex);
        MessageBox.Show("发送消息时发生错误，请查看日志了解详情。", "错误", MessageBoxButton.OK, MessageBoxImage.Error);
    }
}

// 调用AI API获取回复
public static async Task GetAIResponse(Window win, IDictionary<string, object> dataContext, StackPanel messageContainer, ScrollViewer messageScrollViewer)
{
    try
    {
        // 创建消息数组
        var messagesArray = new object[Messages.Count];
        for (int i = 0; i < Messages.Count; i++)
        {
            var msg = new Dictionary<string, object>();
            msg.Add("role", Messages[i]["role"]);
            msg.Add("content", Messages[i]["content"]);
            messagesArray[i] = msg;
        }

        // 构建请求对象
        var requestObj = new Dictionary<string, object>();
        requestObj.Add("model", ModelName);
        requestObj.Add("stream", IsStreaming);
        requestObj.Add("messages", messagesArray);
        requestObj.Add("temperature", 0.7);

        var json = JsonConvert.SerializeObject(requestObj);
        Log("API请求: " + json);

        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        // 创建一个消息面板用于显示AI响应
        var aiMessagePanel = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(45, 45, 45)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(64, 64, 64)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(5),
            Margin = new Thickness(5),
            Padding = new Thickness(10),
            HorizontalAlignment = HorizontalAlignment.Left,
            MaxWidth = 500
        };
        var aiRichTextBox = new RichTextBox
        {
            Background = null,
            BorderThickness = new Thickness(0),
            IsReadOnly = true,
            Foreground = new SolidColorBrush(Colors.White),
            Document = new FlowDocument()
        };
        aiMessagePanel.Child = aiRichTextBox;
        messageContainer.Children.Add(aiMessagePanel);
        
        if (IsStreaming)
        {
            CurrentStreamContent.Clear();
            
            // 流式响应处理
            using (var response = await client.PostAsync("/chat/completions", content))
            {
                if (!response.IsSuccessStatusCode)
                {
                    var errorMessage = await response.Content.ReadAsStringAsync();
                    Log("API响应错误: " + response.StatusCode + " - " + errorMessage);
                    throw new Exception("API请求失败: " + response.StatusCode);
                }
                
                Log("开始处理流式响应...");
                using (var stream = await response.Content.ReadAsStreamAsync())
                using (var reader = new StreamReader(stream))
                {
                    var updateDelayCounter = 0;
                    while (!reader.EndOfStream)
                    {
                        var line = await reader.ReadLineAsync();
                        if (string.IsNullOrEmpty(line)) 
                        {
                            continue;
                        }
                        
                        Log("流式数据行: " + line);
                        
                        if (line.StartsWith("data: "))
                        {
                            var data = line.Substring(6);
                            if (data == "[DONE]") 
                            {
                                Log("流式响应结束标记: [DONE]");
                                break;
                            }
                            
                            try
                            {
                                var streamObj = JObject.Parse(data);
                                Log("解析的JSON: " + streamObj.ToString(Formatting.None));
                                
                                // 处理标准OpenAI格式
                                if (streamObj["choices"] != null && streamObj["choices"].HasValues)
                                {
                                    var choice = streamObj["choices"][0];
                                    string content_delta = null;
                                    
                                    // 尝试多种流式响应格式
                                    if (choice["delta"] != null && choice["delta"]["content"] != null)
                                    {
                                        content_delta = choice["delta"]["content"].ToString();
                                        Log("从delta.content获取内容: " + content_delta);
                                    }
                                    else if (choice["text"] != null)
                                    {
                                        content_delta = choice["text"].ToString();
                                        Log("从text获取内容: " + content_delta);
                                    }
                                    else if (choice["content"] != null)
                                    {
                                        content_delta = choice["content"].ToString();
                                        Log("从content获取内容: " + content_delta);
                                    }
                                    
                                    if (!string.IsNullOrEmpty(content_delta))
                                    {
                                        CurrentStreamContent.Append(content_delta);
                                        
                                        // 使用计数器进行节流，避免过于频繁地更新UI
                                        updateDelayCounter++;
                                        if (updateDelayCounter % 5 == 0 || content_delta.Contains("\n") || content_delta.Length > 10)
                                        {
                                            try
                                            {
                                                var currentText = CurrentStreamContent.ToString();
                                                Log("准备UI更新，当前内容: " + (currentText.Length > 20 ? currentText.Substring(0, 20) + "..." : currentText));
                                                
                                                await Task.Delay(10); // 短暂延迟，让UI有时间处理
                                                
                                                win.Dispatcher.Invoke(new Action(() => {
                                                    try
                                                    {
                                                        aiRichTextBox.Document = FormatMessageDocument(currentText);
                                                        
                                                        // 强制UI立即更新
                                                        Application.Current.Dispatcher.Invoke(DispatcherPriority.Render, new Action(() => { }));
                                                        
                                                        // 确保滚动到底部
                                                        messageScrollViewer.ScrollToVerticalOffset(messageScrollViewer.ScrollableHeight);
                                                        
                                                        Log("UI成功更新，当前长度: " + currentText.Length);
                                                    }
                                                    catch (Exception dispEx)
                                                    {
                                                        Log("UI更新内部错误: " + dispEx.Message);
                                                    }
                                                }));
                                            }
                                            catch (Exception uiEx)
                                            {
                                                Log("尝试更新UI时出错: " + uiEx.Message);
                                            }
                                        }
                                    }
                                }
                            }
                            catch (JsonReaderException ex)
                            {
                                Log("JSON解析错误: " + ex.Message);
                                continue;
                            }
                        }
                        else
                        {
                            // 尝试直接解析行内容
                            try
                            {
                                var streamObj = JObject.Parse(line);
                                if (streamObj["content"] != null)
                                {
                                    var content_text = streamObj["content"].ToString();
                                    Log("从行直接解析内容: " + content_text);
                                    
                                    CurrentStreamContent.Append(content_text);
                                    
                                    // 使用计数器进行节流，避免过于频繁地更新UI
                                    updateDelayCounter++;
                                    if (updateDelayCounter % 5 == 0 || content_text.Contains("\n") || content_text.Length > 10)
                                    {
                                        try
                                        {
                                            var currentText = CurrentStreamContent.ToString();
                                            Log("准备UI更新，当前内容: " + (currentText.Length > 20 ? currentText.Substring(0, 20) + "..." : currentText));
                                            
                                            await Task.Delay(10); // 短暂延迟，让UI有时间处理
                                            
                                            win.Dispatcher.Invoke(new Action(() => {
                                                try
                                                {
                                                    aiRichTextBox.Document = FormatMessageDocument(currentText);
                                                    
                                                    // 强制UI立即更新
                                                    Application.Current.Dispatcher.Invoke(DispatcherPriority.Render, new Action(() => { }));
                                                    
                                                    // 确保滚动到底部
                                                    messageScrollViewer.ScrollToVerticalOffset(messageScrollViewer.ScrollableHeight);
                                                    
                                                    Log("UI成功更新，当前长度: " + currentText.Length);
                                                }
                                                catch (Exception dispEx)
                                                {
                                                    Log("UI更新内部错误: " + dispEx.Message);
                                                }
                                            }));
                                        }
                                        catch (Exception uiEx)
                                        {
                                            Log("尝试更新UI时出错: " + uiEx.Message);
                                        }
                                    }
                                }
                            }
                            catch
                            {
                                // 不是JSON格式，忽略
                            }
                        }
                    }
                    
                    // 流式响应结束，保存完整消息
                    var aiMessage = CurrentStreamContent.ToString();
                    
                    var messageDict = new Dictionary<string, object>();
                    messageDict.Add("role", "assistant");
                    messageDict.Add("content", aiMessage);
                    messageDict.Add("timestamp", DateTime.Now);
                    Messages.Add(messageDict);
                    
                    Log("API响应完成 (流式)，总长度: " + aiMessage.Length);
                    ScrollToBottom(messageScrollViewer);
                }
            }
        }
        else
        {
            // 非流式响应处理
            var response = await client.PostAsync("/chat/completions", content);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorMessage = await response.Content.ReadAsStringAsync();
                Log("API响应错误: " + response.StatusCode + " - " + errorMessage);
                throw new Exception("API请求失败: " + response.StatusCode);
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            Log("API响应: " + responseContent);

            var result = JsonConvert.DeserializeObject<Dictionary<string, object>>(responseContent);
            var choices = (JArray)result["choices"];
            var aiMessage = choices[0]["message"]["content"].ToString();

            var messageDict = new Dictionary<string, object>();
            messageDict.Add("role", "assistant");
            messageDict.Add("content", aiMessage);
            messageDict.Add("timestamp", DateTime.Now);
            Messages.Add(messageDict);

            // 显示完整消息
            aiRichTextBox.Document = FormatMessageDocument(aiMessage);
            ScrollToBottom(messageScrollViewer);
        }
    }
    catch (Exception ex)
    {
        Log("处理AI响应失败", ex);
        throw;
    }
}

// 添加消息到界面
public static void AddMessage(StackPanel container, string message, bool isUser)
{
    try
    {
        var panel = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(45, 45, 45)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(64, 64, 64)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(5),
            Margin = new Thickness(5),
            Padding = new Thickness(10),
            HorizontalAlignment = isUser ? HorizontalAlignment.Right : HorizontalAlignment.Left,
            MaxWidth = 500
        };

        var richTextBox = new RichTextBox
        {
            Background = null,
            BorderThickness = new Thickness(0),
            IsReadOnly = true,
            Foreground = new SolidColorBrush(Colors.White)
        };

        var doc = new FlowDocument();
        
        if (message.Contains("```"))
        {
            var parts = message.Split(new[] { "```" }, StringSplitOptions.None);
            for (int i = 0; i < parts.Length; i++)
            {
                if (i % 2 == 0)
                {
                    if (!string.IsNullOrEmpty(parts[i]))
                    {
                        var para = new Paragraph(new Run(parts[i].Trim()));
                        doc.Blocks.Add(para);
                    }
                }
                else
                {
                    var codeLines = parts[i].Split('\n');
                    var language = "";
                    var code = parts[i];

                    if (codeLines.Length > 0 && !string.IsNullOrEmpty(codeLines[0]))
                    {
                        language = codeLines[0].Trim();
                        
                        // 跳过第一行（语言标识），拼接剩余代码
                        code = "";
                        for (int j = 1; j < codeLines.Length; j++)
                        {
                            code += codeLines[j];
                            if (j < codeLines.Length - 1)
                                code += "\n";
                        }
                    }

                    var codePara = new Paragraph(new Run(code))
                    {
                        Background = new SolidColorBrush(Color.FromRgb(30, 30, 30)),
                        FontFamily = new FontFamily("Consolas"),
                        Margin = new Thickness(0, 5, 0, 5)
                    };
                    doc.Blocks.Add(codePara);
                }
            }
        }
        else
        {
            doc.Blocks.Add(new Paragraph(new Run(message)));
        }

        richTextBox.Document = doc;
        panel.Child = richTextBox;
        container.Children.Add(panel);

        Log("添加" + (isUser ? "用户" : "AI") + "消息到界面");
    }
    catch (Exception ex)
    {
        Log("添加消息到界面失败", ex);
        throw;
    }
}

// 添加预设文本到输入框
public static void AddActionToInput(TextBox txtInput, string action)
{
    txtInput.Text = action + txtInput.Text;
    txtInput.Focus();
    txtInput.SelectionStart = txtInput.Text.Length;
}

// 获取模型简短名称
public static string GetShortModelName(string fullName)
{
    var parts = fullName.Split('/');
    return parts.Length > 1 ? parts[1] : fullName;
}

// 格式化消息文档
public static FlowDocument FormatMessageDocument(string message)
{
    var doc = new FlowDocument();
    
    if (message.Contains("```"))
    {
        var parts = message.Split(new[] { "```" }, StringSplitOptions.None);
        for (int i = 0; i < parts.Length; i++)
        {
            if (i % 2 == 0)
            {
                if (!string.IsNullOrEmpty(parts[i]))
                {
                    var para = new Paragraph(new Run(parts[i].Trim()));
                    doc.Blocks.Add(para);
                }
            }
            else
            {
                var codeLines = parts[i].Split('\n');
                var language = "";
                var code = parts[i];

                if (codeLines.Length > 0 && !string.IsNullOrEmpty(codeLines[0]))
                {
                    language = codeLines[0].Trim();
                    
                    // 跳过第一行（语言标识），拼接剩余代码
                    code = "";
                    for (int j = 1; j < codeLines.Length; j++)
                    {
                        code += codeLines[j];
                        if (j < codeLines.Length - 1)
                            code += "\n";
                    }
                }

                var codePara = new Paragraph(new Run(code))
                {
                    Background = new SolidColorBrush(Color.FromRgb(30, 30, 30)),
                    FontFamily = new FontFamily("Consolas"),
                    Margin = new Thickness(0, 5, 0, 5)
                };
                doc.Blocks.Add(codePara);
            }
        }
    }
    else
    {
        doc.Blocks.Add(new Paragraph(new Run(message)));
    }
    
    return doc;
}

// 滚动到底部的工具方法
public static void ScrollToBottom(ScrollViewer scrollViewer)
{
    try
    {
        scrollViewer.ScrollToVerticalOffset(double.MaxValue);
        
        // 尝试第二种方法确保滚动到底部
        Application.Current.Dispatcher.BeginInvoke(DispatcherPriority.Background, 
            new Action(() => scrollViewer.ScrollToEnd()));
        
        Log("执行滚动到底部");
    }
    catch (Exception ex)
    {
        Log("滚动到底部失败: " + ex.Message);
    }
} 