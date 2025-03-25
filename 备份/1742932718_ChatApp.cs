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
using System.Threading;

// 全局变量
public static List<Dictionary<string, object>> Messages = new List<Dictionary<string, object>>();
public static string SelectedModel = "系统极客";
public static HttpClient client = new HttpClient();
public static int keyEventSequence = 0; // 添加此变量用于跟踪事件序列号

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
        InitializeHttpClient();
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
        dataContext["MainPrompt"] = ""; // 移除"有什么可以帮忙的？"提示文字
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
                // 设置自动发送标记，但不显示在输入框中
                dataContext["AutoSendMessage"] = true;
                dataContext["PendingMessage"] = inParam;
                Log("已设置待发送消息: " + inParam);
            }
        }
        
        // 设置UI元素引用和事件处理
        SetupUIElements(win, dataContext);
        
        Log("窗口创建完成");
    }
    catch (Exception ex)
    {
        Log("窗口创建失败", ex);
        MessageBox.Show("窗口创建过程中发生错误，请查看日志文件了解详情。", "错误", MessageBoxButton.OK, MessageBoxImage.Error);
    }
}

// 初始化HttpClient
private static void InitializeHttpClient()
{
    if (client != null)
    {
        client.Dispose();
    }
    
    // 创建带超时设置的HttpClientHandler
    var handler = new HttpClientHandler
    {
        // 如果有代理问题，可以添加以下配置
        UseProxy = false,
        // 如果有证书问题，可以添加以下配置
        ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => true
    };
    
    client = new HttpClient(handler);
    
    // 设置超时时间，避免长时间等待无响应的请求
    client.Timeout = TimeSpan.FromSeconds(60);
    
    // 添加授权头
    if (!string.IsNullOrEmpty(ApiKey))
    {
        client.DefaultRequestHeaders.Add("Authorization", "Bearer " + ApiKey);
        Log("已设置API密钥到授权头");
    }
    
    // 设置基本URL
    if (!string.IsNullOrEmpty(BaseUrl))
    {
        try
        {
            client.BaseAddress = new Uri(BaseUrl);
            Log("已设置BaseAddress: " + BaseUrl);
        }
        catch (Exception ex)
        {
            Log("设置BaseAddress失败: " + ex.Message);
        }
    }
}

// 设置UI元素引用和事件处理
private static void SetupUIElements(Window win, IDictionary<string, object> dataContext)
{
    try
    {
        // 获取UI元素的引用
        Log("获取UI元素引用");
        var messageContainer = (StackPanel)win.FindName("messageContainer");
        var messageScrollViewer = (ScrollViewer)win.FindName("messageScrollViewer");
        var txtInput = (TextBox)win.FindName("TxtInput");
        var btnSend = (Button)win.FindName("BtnSend");
        var btnSettings = (Button)win.FindName("BtnSettings");
        var settingsPanel = (Border)win.FindName("SettingsPanel");
        var btnCancelSettings = (Button)win.FindName("BtnCancelSettings");
        var btnSaveSettings = (Button)win.FindName("BtnSaveSettings");
        var txtModelName = (TextBox)win.FindName("TxtModelName");
        var txtApiKey = (TextBox)win.FindName("TxtApiKey");
        var txtBaseUrl = (TextBox)win.FindName("TxtBaseUrl");
        var btnClose = (Button)win.FindName("BtnClose");
        var btnMinimize = (Button)win.FindName("BtnMinimize");
        var btnExpand = (Button)win.FindName("BtnExpand");
        var titleBar = (Grid)win.FindName("TitleBar");

        // 记录UI元素是否成功获取
        Log("检查UI元素是否成功获取:");
        Log("- messageContainer: " + (messageContainer != null ? "成功" : "失败"));
        Log("- messageScrollViewer: " + (messageScrollViewer != null ? "成功" : "失败"));
        Log("- txtInput: " + (txtInput != null ? "成功" : "失败"));
        Log("- btnSend: " + (btnSend != null ? "成功" : "失败"));
        
        // 设置标题栏拖动
        Log("设置标题栏拖动");
        if (titleBar != null)
        {
            titleBar.MouseLeftButtonDown += (s, e) =>
            {
                // 确保只有在按下左键时才调用DragMove
                if (e.ButtonState == MouseButtonState.Pressed && e.ChangedButton == MouseButton.Left) 
                {
                    try
                    {
                        win.DragMove();
                    }
                    catch (Exception ex)
                    {
                        Log("拖动窗口失败", ex);
                    }
                }
            };
        }

        // 关闭按钮事件
        Log("设置关闭按钮事件");
        if (btnClose != null)
        {
            btnClose.Click += (s, e) =>
            {
                win.Close();
            };
        }

        // 最小化按钮事件
        Log("设置最小化按钮事件");
        if (btnMinimize != null)
        {
            btnMinimize.Click += (s, e) =>
            {
                win.WindowState = WindowState.Minimized;
            };
        }

        // 最大化/还原按钮事件
        Log("设置最大化/还原按钮事件");
        if (btnExpand != null)
        {
            btnExpand.Click += (s, e) =>
            {
                if (win.WindowState == WindowState.Maximized)
                {
                    win.WindowState = WindowState.Normal;
                }
                else
                {
                    win.WindowState = WindowState.Maximized;
                }
            };
        }

        // 设置按钮点击事件
        Log("设置设置按钮点击事件");
        if (btnSettings != null && settingsPanel != null)
        {
            btnSettings.Click += (s, e) =>
            {
                if (txtModelName != null) txtModelName.Text = ModelName;
                if (txtApiKey != null) txtApiKey.Text = ApiKey;
                if (txtBaseUrl != null) txtBaseUrl.Text = BaseUrl;
                
                settingsPanel.Visibility = Visibility.Visible;
            };
        }

        // 设置面板取消按钮
        Log("设置面板取消按钮事件");
        if (btnCancelSettings != null && settingsPanel != null)
        {
            btnCancelSettings.Click += (s, e) =>
            {
                settingsPanel.Visibility = Visibility.Collapsed;
            };
        }

        // 设置面板保存按钮
        Log("设置面板保存按钮事件");
        if (btnSaveSettings != null && settingsPanel != null && txtModelName != null && txtApiKey != null && txtBaseUrl != null)
        {
            btnSaveSettings.Click += (s, e) =>
            {
                ModelName = txtModelName.Text;
                ApiKey = txtApiKey.Text;
                BaseUrl = txtBaseUrl.Text;
                
                dataContext["ModelName"] = ModelName;
                
                // 重新创建HttpClient并设置授权头
                InitializeHttpClient();
                
                settingsPanel.Visibility = Visibility.Collapsed;
            };
        }

        // 发送按钮点击事件
        Log("设置发送按钮点击事件");
        if (btnSend != null && txtInput != null)
        {
            btnSend.Click += async (s, e) =>
            {
                Log("点击发送按钮");
                await SendMessage(win, dataContext, messageContainer, messageScrollViewer, txtInput);
            };
        }

        // 输入框按键事件
        Log("设置输入框按键事件");
        if (txtInput != null)
        {
            txtInput.PreviewKeyDown += async (s, e) =>
            {
                var eventSeqNumber = Interlocked.Increment(ref keyEventSequence);
                Log("事件序号[" + eventSeqNumber + "] - 按键: " + e.Key + ", 按键状态: " + e.KeyStates);
                
                if (e.Key == Key.Return)
                {
                    if ((Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift || (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control)
                    {
                        // Shift+Enter 或 Ctrl+Enter 插入换行，不发送消息
                        Log("事件序号[" + eventSeqNumber + "] - Shift+Enter或Ctrl+Enter，插入换行");
                    }
                    else
                    {
                        // 仅Enter键发送消息
                        Log("事件序号[" + eventSeqNumber + "] - 准备通过回车发送消息");
                        e.Handled = true; // 先标记为已处理，防止事件继续传播
                        await SendMessage(win, dataContext, messageContainer, messageScrollViewer, txtInput);
                        Log("事件序号[" + eventSeqNumber + "] - 回车发送消息完成");
                    }
                }
            };

            // 检查是否需要自动发送消息
            if (dataContext.ContainsKey("AutoSendMessage") && Convert.ToBoolean(dataContext["AutoSendMessage"]) && 
                dataContext.ContainsKey("PendingMessage") && dataContext["PendingMessage"] != null)
            {
                var pendingMessage = dataContext["PendingMessage"].ToString();
                if (!string.IsNullOrEmpty(pendingMessage))
                {
                    Log("检测到待发送消息，准备自动发送: " + pendingMessage);
                    
                    // 临时设置消息到输入框并发送
                    txtInput.Text = pendingMessage;
                    dataContext["InputText"] = pendingMessage;
                    
                    // 使用Action代替立即执行异步代码，避免编译警告
                    Application.Current.Dispatcher.BeginInvoke(new Action(() => 
                    {
                        // 这里使用无参数的SendMessage重载避免编译器警告
                        SendMessageLater(win, dataContext, messageContainer, messageScrollViewer, txtInput);
                    }));
                }
            }
        }

        // 优先让输入框获得焦点
        Log("设置输入框焦点");
        if (txtInput != null)
        {
            txtInput.Focus();
            Log("输入框焦点设置状态: " + (txtInput.IsFocused ? "成功" : "失败"));
        }
        
        // 记录初始化完成
        Log("UI元素设置完成");
    }
    catch (Exception ex)
    {
        Log("设置UI元素失败", ex);
        throw;
    }
}

// 辅助方法，用于在UI线程上异步执行消息发送
private static async void SendMessageLater(Window win, IDictionary<string, object> dataContext, StackPanel messageContainer, ScrollViewer messageScrollViewer, TextBox txtInput)
{
    try
    {
        await SendMessage(win, dataContext, messageContainer, messageScrollViewer, txtInput);
        // 清除自动发送标记
        dataContext["AutoSendMessage"] = false;
        dataContext["PendingMessage"] = "";
    }
    catch (Exception ex)
    {
        Log("自动发送消息失败", ex);
    }
}

// 窗口加载事件
public static async Task OnWindowLoaded(Window win, IDictionary<string, object> dataContext, ICustomWindowContext winContext)
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
        var btnSettings = (Button)win.FindName("BtnSettings");
        var txtInput = (TextBox)win.FindName("TxtInput");
        var messageContainer = (StackPanel)win.FindName("MessageContainer");
        var messageScrollViewer = (ScrollViewer)win.FindName("MessageScrollViewer");
        var titleBar = (Grid)win.FindName("TitleBar");
        var settingsPanel = (Border)win.FindName("SettingsPanel");
        var btnSaveSettings = (Button)win.FindName("BtnSaveSettings");
        var btnCancelSettings = (Button)win.FindName("BtnCancelSettings");
        
        Log("成功获取所有UI元素");

        // 注册事件处理
        titleBar.MouseLeftButtonDown += (s, e) => 
        { 
            // 确保只有在按下左键时才调用DragMove
            if (e.ButtonState == MouseButtonState.Pressed && e.ChangedButton == MouseButton.Left) 
            {
                try
                {
                    win.DragMove();
                }
                catch (Exception ex)
                {
                    Log("拖动窗口失败", ex);
                }
            } 
        };
        btnClose.Click += (s, e) => win.Close();
        btnMinimize.Click += (s, e) => win.WindowState = WindowState.Minimized;
        btnExpand.Click += (s, e) => win.WindowState = win.WindowState == WindowState.Normal ? WindowState.Maximized : WindowState.Normal;
        
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
        
        btnSend.Click += async (s, e) => 
        {
            Log("点击发送按钮");
            await SendMessage(win, dataContext, messageContainer, messageScrollViewer, txtInput);
        };
        
        txtInput.KeyDown += async (s, e) =>
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
                    await SendMessage(win, dataContext, messageContainer, messageScrollViewer, txtInput);
                    Log("事件序号[1] - 回车发送消息完成");
                }
                else
                {
                    Log("事件序号[1] - 检测到Shift+Enter，允许换行");
                }
            }
        };
        
        // 防止可能的TextBox默认行为干扰Enter键处理
        txtInput.PreviewKeyDown += async (s, e) =>
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
                await SendMessage(win, dataContext, messageContainer, messageScrollViewer, txtInput);
                Log("事件序号[0] - PreviewKeyDown中发送消息完成");
            }
        };
        
        // 设置按钮事件
        btnSettings.Click += (s, e) =>
        {
            settingsPanel.Visibility = Visibility.Visible;
            Log("打开设置面板");
        };
        
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
        if (dataContext.ContainsKey("AutoSendMessage") && (bool)dataContext["AutoSendMessage"] && 
            dataContext.ContainsKey("PendingMessage") && !string.IsNullOrWhiteSpace(dataContext["PendingMessage"].ToString()))
        {
            Log("检测到自动发送标记，准备自动发送消息...");
            
            // 使用await替代BeginInvoke
            await Application.Current.Dispatcher.InvokeAsync(async () => 
            {
                try
                {
                    string pendingMessage = dataContext["PendingMessage"].ToString();
                    Log("执行自动发送消息: " + pendingMessage);
                    
                    // 临时设置消息到输入框并发送
                    txtInput.Text = pendingMessage;
                    await SendMessage(win, dataContext, messageContainer, messageScrollViewer, txtInput);
                    
                    // 清空输入框和待发送消息
                    txtInput.Text = "";
                    dataContext["PendingMessage"] = "";
                    dataContext["AutoSendMessage"] = false;
                    
                    Log("自动发送消息完成");
                }
                catch (Exception ex)
                {
                    Log("自动发送消息失败", ex);
                }
            });
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

// 发送消息
public static async Task SendMessage(Window win, IDictionary<string, object> dataContext, StackPanel messageContainer, ScrollViewer messageScrollViewer, TextBox txtInput)
{
    try
    {
        var message = dataContext["InputText"].ToString();
        if (string.IsNullOrEmpty(message)) return;
        
        // 记录消息长度和内容 (截断长消息以避免日志过长)
        var logMessage = message.Length > 50 ? message.Substring(0, 50) + "..." : message;
        Log("发送消息: " + logMessage + ", 长度: " + message.Length);
        
        // 清空输入框并使其获得焦点
        dataContext["InputText"] = "";
        txtInput.Focus();
        
        // 将用户消息添加到消息历史
        var messageDict = new Dictionary<string, object>();
        messageDict.Add("role", "user");
        messageDict.Add("content", message);
        messageDict.Add("timestamp", DateTime.Now);
        Messages.Add(messageDict);
        
        // 显示用户消息到界面
        AddMessage(messageContainer, message, true);
        
        // 立即滚动到底部
        await ScrollToBottom(messageScrollViewer);
        
        try
        {
            // 获取AI响应
            await GetAIResponse(win, dataContext, messageContainer, messageScrollViewer);
        }
        catch (Exception apiEx)
        {
            // GetAIResponse方法内部已经处理异常并显示给用户，这里不需要再显示
            Log("API响应处理被捕获", apiEx);
        }
    }
    catch (Exception ex)
    {
        Log("发送消息失败", ex);
        
        try
        {
            // 显示错误消息 - 使用同步方式
            var uiTask = Application.Current.Dispatcher.InvokeAsync(() => {
                MessageBox.Show(win, "发送消息失败: " + ex.Message, "错误", MessageBoxButton.OK, MessageBoxImage.Error);
            }, DispatcherPriority.Send);
            
            // 等待UI操作完成
            uiTask.Wait();
        }
        catch
        {
            // 忽略显示错误的异常
        }
    }
}

// 调用AI API获取回复
public static async Task GetAIResponse(Window win, IDictionary<string, object> dataContext, StackPanel messageContainer, ScrollViewer messageScrollViewer)
{
    // 创建一个消息面板用于显示AI响应
    var aiMessagePanel = new Border
    {
        Background = new SolidColorBrush(Color.FromRgb(45, 45, 45)),
        BorderBrush = new SolidColorBrush(Color.FromRgb(64, 64, 64)),
        BorderThickness = new Thickness(1),
        CornerRadius = new CornerRadius(5),
        Margin = new Thickness(5, 8, 5, 8), // 增加上下间距
        Padding = new Thickness(12), // 增加内部边距
        HorizontalAlignment = HorizontalAlignment.Left,
        MaxWidth = 470 // 调整最大宽度，留出边距
    };
    var aiRichTextBox = new RichTextBox
    {
        Background = null,
        BorderThickness = new Thickness(0),
        IsReadOnly = true,
        Foreground = new SolidColorBrush(Colors.White),
        FontSize = 14, // 增大字体
        Document = new FlowDocument()
    };
    aiMessagePanel.Child = aiRichTextBox;
    messageContainer.Children.Add(aiMessagePanel);

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
        
        // 设置超时时间
        var timeoutCts = new CancellationTokenSource();
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(60)); // 设置60秒超时
        
        try
        {
            if (IsStreaming)
            {
                CurrentStreamContent.Clear();
                
                // 流式响应处理
                var response = await client.PostAsync("/v1/chat/completions", content, timeoutCts.Token);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorMessage = await response.Content.ReadAsStringAsync();
                    Log("API响应错误: " + response.StatusCode + " - " + errorMessage);
                    
                    // 显示错误信息
                    await Application.Current.Dispatcher.InvokeAsync(() => {
                        aiRichTextBox.Document.Blocks.Clear();
                        var paragraph = new Paragraph();
                        paragraph.LineHeight = 1.2; // 设置行间距
                        var run = new Run(string.Format("请求失败: {0} - {1}", response.StatusCode, (string.IsNullOrEmpty(errorMessage) ? "无错误详情" : errorMessage)));
                        run.Foreground = Brushes.White;
                        paragraph.Inlines.Add(run);
                        aiRichTextBox.Document.Blocks.Add(paragraph);
                        
                        // 添加到消息历史
                        var messageDict = new Dictionary<string, object>();
                        messageDict.Add("role", "assistant");
                        messageDict.Add("content", string.Format("请求失败: {0}", response.StatusCode));
                        messageDict.Add("timestamp", DateTime.Now);
                        Messages.Add(messageDict);
                        
                        messageScrollViewer.ScrollToBottom();
                    });
                    
                    return;
                }
                
                await HandleStreamResponse(response, aiRichTextBox, messageScrollViewer);
            }
            else
            {
                // 非流式响应处理
                var response = await client.PostAsync("/v1/chat/completions", content, timeoutCts.Token);
                
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
                await ScrollToBottom(messageScrollViewer);
            }
        }
        catch (TaskCanceledException tcEx)
        {
            Log("API请求超时或被取消", tcEx);
            
            // 显示超时错误信息
            try
            {
                // 在catch块中不能使用await，使用同步方法更新UI
                var uiTask = Application.Current.Dispatcher.InvokeAsync(() => {
                    aiRichTextBox.Document.Blocks.Clear();
                    var paragraph = new Paragraph();
                    paragraph.LineHeight = 1.2;
                    var run = new Run("请求超时或被取消，请检查网络连接后重试。");
                    run.Foreground = Brushes.White;
                    paragraph.Inlines.Add(run);
                    aiRichTextBox.Document.Blocks.Add(paragraph);
                    
                    // 添加到消息历史
                    var messageDict = new Dictionary<string, object>();
                    messageDict.Add("role", "assistant");
                    messageDict.Add("content", "请求超时或被取消，请检查网络连接后重试。");
                    messageDict.Add("timestamp", DateTime.Now);
                    Messages.Add(messageDict);
                    
                    messageScrollViewer.ScrollToBottom();
                }, DispatcherPriority.Send);
                
                // 确保UI更新完成
                uiTask.Wait();
            }
            catch (Exception innerEx)
            {
                Log("显示超时错误信息时发生异常", innerEx);
            }
        }
        catch (HttpRequestException httpEx)
        {
            Log("HTTP请求异常", httpEx);
            
            // 显示HTTP异常信息
            try
            {
                // 在catch块中不能使用await，使用同步方法更新UI
                var uiTask = Application.Current.Dispatcher.InvokeAsync(() => {
                    aiRichTextBox.Document.Blocks.Clear();
                    var paragraph = new Paragraph();
                    paragraph.LineHeight = 1.2;
                    var run = new Run(string.Format("HTTP请求失败: {0}", httpEx.Message));
                    run.Foreground = Brushes.White;
                    paragraph.Inlines.Add(run);
                    aiRichTextBox.Document.Blocks.Add(paragraph);
                    
                    // 添加到消息历史
                    var messageDict = new Dictionary<string, object>();
                    messageDict.Add("role", "assistant");
                    messageDict.Add("content", string.Format("HTTP请求失败: {0}", httpEx.Message));
                    messageDict.Add("timestamp", DateTime.Now);
                    Messages.Add(messageDict);
                    
                    messageScrollViewer.ScrollToBottom();
                }, DispatcherPriority.Send);
                
                // 确保UI更新完成
                uiTask.Wait();
            }
            catch (Exception innerEx)
            {
                Log("显示HTTP错误信息时发生异常", innerEx);
            }
        }
    }
    catch (Exception ex)
    {
        Log("处理AI响应失败", ex);
        
        // 显示通用异常信息
        try
        {
            // 在catch块中不能使用await，使用同步方法更新UI
            var uiTask = Application.Current.Dispatcher.InvokeAsync(() => {
                aiRichTextBox.Document.Blocks.Clear();
                var paragraph = new Paragraph();
                paragraph.LineHeight = 1.2;
                var run = new Run(string.Format("处理响应时出错: {0}", ex.Message));
                run.Foreground = Brushes.White;
                paragraph.Inlines.Add(run);
                aiRichTextBox.Document.Blocks.Add(paragraph);
                
                // 添加到消息历史
                var messageDict = new Dictionary<string, object>();
                messageDict.Add("role", "assistant");
                messageDict.Add("content", string.Format("处理响应时出错: {0}", ex.Message));
                messageDict.Add("timestamp", DateTime.Now);
                Messages.Add(messageDict);
                
                messageScrollViewer.ScrollToBottom();
            }, DispatcherPriority.Send);
            
            // 确保UI更新完成
            uiTask.Wait();
        }
        catch (Exception innerEx)
        {
            Log("显示通用错误信息时发生异常", innerEx);
        }
    }
}

private static async Task HandleStreamResponse(HttpResponseMessage response, RichTextBox messageBox, ScrollViewer scrollViewer)
{
    try
    {
        // 设置RichTextBox
        await Application.Current.Dispatcher.InvokeAsync(() =>
        {
            try
            {
                // 创建初始UI，指示用户开始接收响应
                messageBox.Document.Blocks.Clear();
                messageBox.FontSize = 14; // 增大字体
                
                var paragraph = new Paragraph();
                paragraph.LineHeight = 1.2; // 设置行间距
                
                var run = new Run("开始接收响应...");
                run.Foreground = Brushes.White; // 使用白色文本，保持一致性
                paragraph.Inlines.Add(run);
                messageBox.Document.Blocks.Add(paragraph);
                
                // 强制更新以显示初始内容
                messageBox.UpdateLayout();
                scrollViewer.UpdateLayout();
                scrollViewer.ScrollToBottom();
            }
            catch (Exception ex)
            {
                Log("设置初始UI失败", ex);
            }
        }, DispatcherPriority.Send);
        
        Log("开始接收流式响应内容...");
        
        // 为线程安全的UI更新设置一个独立的Dispatcher对象
        Dispatcher uiDispatcher = Dispatcher.CurrentDispatcher;
        
        using (var stream = await response.Content.ReadAsStreamAsync())
        using (var reader = new StreamReader(stream))
        {
            StringBuilder currentMessage = new StringBuilder();
            string currentLine;
            int lineCounter = 0;
            bool receivedAnyContent = false;
            
            // 记录开始接收的时间
            var startTime = DateTime.Now;
            Log(string.Format("流式响应开始接收时间: {0}", startTime.ToString("yyyy-MM-dd HH:mm:ss.fff")));
            
            while ((currentLine = await reader.ReadLineAsync()) != null)
            {
                lineCounter++;
                var currentTime = DateTime.Now;
                
                if (string.IsNullOrWhiteSpace(currentLine)) 
                {
                    Log(string.Format("收到空行 #{0} 时间: {1}", lineCounter, currentTime.ToString("HH:mm:ss.fff")));
                    continue;
                }
                
                // 记录每行原始响应
                if (lineCounter <= 10 || lineCounter % 20 == 0)
                {
                    var truncatedLine = currentLine.Length > 100 ? 
                        currentLine.Substring(0, 100) + "..." : 
                        currentLine;
                    Log(string.Format("收到原始数据行 #{0} [{1}]: {2}", 
                        lineCounter, 
                        currentTime.ToString("HH:mm:ss.fff"),
                        truncatedLine));
                }
                
                // 记录流式数据长度
                if (currentMessage.Length % 200 == 0 && currentMessage.Length > 0)
                {
                    Log(string.Format("已接收流式数据长度: {0}, 时间: {1}", 
                        currentMessage.Length,
                        currentTime.ToString("HH:mm:ss.fff")));
                }
                
                if (currentLine == "data: [DONE]")
                {
                    Log(string.Format("流式响应结束标记: [DONE], 时间: {0}", currentTime.ToString("HH:mm:ss.fff")));
                    break;
                }
                
                if (currentLine.StartsWith("data: "))
                {
                    var jsonData = currentLine.Substring(6);
                    
                    try
                    {
                        var jsonObj = JObject.Parse(jsonData);
                        var choices = jsonObj.SelectToken("choices") as JArray;
                        if (choices != null && choices.Count > 0)
                        {
                            var firstChoice = choices[0] as JObject;
                            if (firstChoice != null)
                            {
                                var delta = firstChoice.SelectToken("delta");
                                if (delta != null)
                                {
                                    var content = delta.Value<string>("content");
                                    
                                    if (!string.IsNullOrEmpty(content))
                                    {
                                        receivedAnyContent = true;
                                        currentMessage.Append(content);
                                        
                                        // 记录内容更新
                                        if (currentMessage.Length <= 50 || currentMessage.Length % 1000 == 0)
                                        {
                                            Log(string.Format("解析到内容更新 [{0}], 内容长度: {1}", 
                                                currentTime.ToString("HH:mm:ss.fff"),
                                                currentMessage.Length));
                                        }
                                        
                                        // 创建要显示的内容拷贝，避免多线程访问问题
                                        string contentToDisplay = currentMessage.ToString();
                                        
                                        // 使用Invoke代替BeginInvoke确保UI更新已完成
                                        await Application.Current.Dispatcher.InvokeAsync(() =>
                                        {
                                            try
                                            {
                                                // 更新界面
                                                messageBox.Document.Blocks.Clear();
                                                var paragraph = new Paragraph();
                                                paragraph.LineHeight = 1.2; // 设置行间距
                                                
                                                var run = new Run(contentToDisplay);
                                                run.Foreground = Brushes.White;  // 使用白色文本，保持一致性
                                                paragraph.Inlines.Add(run);
                                                messageBox.Document.Blocks.Add(paragraph);
                                                
                                                // 强制视觉刷新
                                                messageBox.Visibility = Visibility.Hidden;
                                                messageBox.Visibility = Visibility.Visible;
                                                
                                                // 确保滚动到底部
                                                scrollViewer.ScrollToEnd();
                                                
                                                if (currentMessage.Length <= 50 || currentMessage.Length % 200 == 0)
                                                {
                                                    Log(string.Format("UI异步更新 [{0}], 显示内容长度: {1}", 
                                                        DateTime.Now.ToString("HH:mm:ss.fff"),
                                                        contentToDisplay.Length));
                                                }
                                            }
                                            catch (Exception ex)
                                            {
                                                Log(string.Format("UI异步更新失败 [{0}]: {1}", 
                                                    DateTime.Now.ToString("HH:mm:ss.fff"), 
                                                    ex.Message));
                                            }
                                        }, DispatcherPriority.Send);
                                        
                                        // 无需额外的Task.Delay，InvokeAsync已经确保UI更新完成
                                    }
                                }
                            }
                        }
                    }
                    catch (JsonException ex)
                    {
                        Log(string.Format("JSON解析失败 [{0}]: {1}", currentTime.ToString("HH:mm:ss.fff"), ex.Message));
                    }
                }
            }
            
            // 流式响应结束后，记录总体情况
            var endTime = DateTime.Now;
            var totalTime = (endTime - startTime).TotalMilliseconds;
            Log(string.Format("流式响应总接收时间: {0}ms, 行数: {1}, 内容长度: {2}", 
                totalTime.ToString("0.00"),
                lineCounter,
                currentMessage.Length));
            
            // 确保显示完整内容
            string finalContent = currentMessage.ToString();
            await Application.Current.Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    // 如果没有收到任何内容，显示错误信息
                    if (!receivedAnyContent || currentMessage.Length == 0)
                    {
                        var document = messageBox.Document;
                        document.Blocks.Clear();
                        var paragraph = new Paragraph();
                        paragraph.LineHeight = 1.2; // 设置行间距
                        var run = new Run("服务器返回了空响应，请重试或检查网络连接。");
                        run.Foreground = Brushes.White; // 使用白色文本
                        paragraph.Inlines.Add(run);
                        document.Blocks.Add(paragraph);
                        
                        // 将错误消息添加到消息历史中
                        var messageDict = new Dictionary<string, object>();
                        messageDict.Add("role", "assistant");
                        messageDict.Add("content", "服务器返回了空响应，请重试或检查网络连接。");
                        messageDict.Add("timestamp", DateTime.Now);
                        Messages.Add(messageDict);
                        
                        Log("API响应为空，已显示错误提示");
                    }
                    else
                    {
                        var document = messageBox.Document;
                        document.Blocks.Clear();
                        var paragraph = new Paragraph();
                        paragraph.LineHeight = 1.2; // 设置行间距
                        var run = new Run(finalContent);
                        run.Foreground = Brushes.White; // 使用白色文本
                        paragraph.Inlines.Add(run);
                        document.Blocks.Add(paragraph);
                        
                        // 将AI回复添加到消息历史中
                        var messageDict = new Dictionary<string, object>();
                        messageDict.Add("role", "assistant");
                        messageDict.Add("content", finalContent);
                        messageDict.Add("timestamp", DateTime.Now);
                        Messages.Add(messageDict);
                        
                        Log(string.Format("API响应完成 (流式), 总长度: {0}, 已添加到历史记录", finalContent.Length));
                    }
                    
                    scrollViewer.ScrollToBottom();
                }
                catch (Exception ex)
                {
                    Log("最终UI更新失败", ex);
                }
            }, DispatcherPriority.Send);
        }
    }
    catch (Exception ex)
    {
        Log("处理流式响应时发生错误", ex);
        
        // 在catch块中不能使用await，所以我们使用同步方法更新UI
        var uiTask = Application.Current.Dispatcher.InvokeAsync(() =>
        {
            try
            {
                var document = messageBox.Document;
                document.Blocks.Clear();
                var paragraph = new Paragraph();
                paragraph.LineHeight = 1.2; // 设置行间距
                var run = new Run("处理响应时出错: " + ex.Message);
                run.Foreground = Brushes.White; // 使用白色文本
                paragraph.Inlines.Add(run);
                document.Blocks.Add(paragraph);
                
                // 将错误消息添加到消息历史中
                var messageDict = new Dictionary<string, object>();
                messageDict.Add("role", "assistant");
                messageDict.Add("content", "处理响应时出错: " + ex.Message);
                messageDict.Add("timestamp", DateTime.Now);
                Messages.Add(messageDict);
                
                scrollViewer.ScrollToBottom();
                Log("已显示错误信息到UI");
            }
            catch (Exception displayEx)
            {
                Log("无法显示错误信息到UI: " + displayEx.Message);
            }
        }, DispatcherPriority.Send);
        
        // 在抛出异常前确保UI更新已完成
        uiTask.Wait();
        
        throw;
    }
}

// 添加消息到界面
public static void AddMessage(StackPanel container, string message, bool isUser)
{
    try
    {
        // 确保容器不为空
        if (container == null)
        {
            Log("错误：消息容器为空");
            return;
        }

        // 记录添加消息
        Log("添加" + (isUser ? "用户" : "AI") + "消息: " + message);

        var panel = new Border
        {
            Background = new SolidColorBrush(isUser ? Color.FromRgb(43, 91, 76) : Color.FromRgb(45, 45, 45)),
            BorderBrush = new SolidColorBrush(isUser ? Color.FromRgb(51, 102, 153) : Color.FromRgb(64, 64, 64)),
            BorderThickness = new Thickness(1),
            CornerRadius = new CornerRadius(5),
            Margin = new Thickness(5, 8, 5, 8), // 增加上下间距
            Padding = new Thickness(12), // 增加内部边距
            HorizontalAlignment = isUser ? HorizontalAlignment.Right : HorizontalAlignment.Left,
            MaxWidth = 470 // 调整最大宽度，留出边距
        };

        var richTextBox = new RichTextBox
        {
            Background = null,
            BorderThickness = new Thickness(0),
            IsReadOnly = true,
            Foreground = new SolidColorBrush(Colors.White),
            HorizontalAlignment = isUser ? HorizontalAlignment.Right : HorizontalAlignment.Left,
            FontSize = 14 // 增大字体
        };

        // 设置行间距
        richTextBox.Document.LineHeight = 1.2;

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
                        para.LineHeight = 1.2; // 设置段落行间距
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
                        Margin = new Thickness(0, 5, 0, 5),
                        LineHeight = 1.2 // 设置代码块行间距
                    };
                    doc.Blocks.Add(codePara);
                }
            }
        }
        else
        {
            var para = new Paragraph(new Run(message));
            para.LineHeight = 1.2; // 设置段落行间距
            doc.Blocks.Add(para);
        }

        richTextBox.Document = doc;
        panel.Child = richTextBox;
        container.Children.Add(panel);

        Log("成功添加" + (isUser ? "用户" : "AI") + "消息到界面");
    }
    catch (Exception ex)
    {
        Log("添加消息到界面失败", ex);
        throw;
    }
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
    doc.FontSize = 14; // 增大字体
    doc.LineHeight = 1.2; // 设置文档行间距
    
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
                    para.LineHeight = 1.2; // 设置段落行间距
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
                    Margin = new Thickness(0, 5, 0, 5),
                    LineHeight = 1.2 // 设置代码块行间距
                };
                doc.Blocks.Add(codePara);
            }
        }
    }
    else
    {
        var para = new Paragraph(new Run(message));
        para.LineHeight = 1.2; // 设置段落行间距
        doc.Blocks.Add(para);
    }
    
    return doc;
}

// 滚动到底部的工具方法
public static async Task ScrollToBottom(ScrollViewer scrollViewer)
{
    try
    {
        scrollViewer.ScrollToVerticalOffset(double.MaxValue);
        
        // 尝试第二种方法确保滚动到底部
        await Application.Current.Dispatcher.InvokeAsync(
            () => scrollViewer.ScrollToEnd(), 
            DispatcherPriority.Background);
        
        Log("执行滚动到底部");
    }
    catch (Exception ex)
    {
        Log("滚动到底部失败: " + ex.Message);
    }
}

// 流式响应的数据模型
public class StreamResponse
{
    [JsonProperty("id")]
    public string Id { get; set; }
    
    [JsonProperty("model")]
    public string Model { get; set; }
    
    [JsonProperty("object")]
    public string Object { get; set; }
    
    [JsonProperty("choices")]
    public List<StreamChoice> Choices { get; set; }
    
    [JsonProperty("created")]
    public long Created { get; set; }
}

public class StreamChoice
{
    [JsonProperty("index")]
    public int Index { get; set; }
    
    [JsonProperty("delta")]
    public StreamDelta Delta { get; set; }
    
    [JsonProperty("finish_reason")]
    public string FinishReason { get; set; }
}

public class StreamDelta
{
    [JsonProperty("role")]
    public string Role { get; set; }
    
    [JsonProperty("content")]
    public string Content { get; set; }
} 