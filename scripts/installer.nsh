; SeekClaw NSIS 自定义钩子
; 解决托盘常驻模式下 WM_CLOSE 被拦截、安装器报"无法关闭"的问题

; 默认展开安装细节（日志），让用户看到进度
ShowInstDetails show

; 自定义安装界面文本提示 (使用 LangString 确保在 include 阶段能覆盖已定义的 MUI 文本)
!ifdef CHS
  LangString MUI_TEXT_WELCOME_INFO_TITLE ${LANG_CHINESE} "欢迎安装 SeekClaw"
  LangString MUI_TEXT_WELCOME_INFO_TEXT ${LANG_CHINESE} "SeekClaw 内置了完整的 Node.js 运行时及数千个核心组件。\r\n\r\n提示：由于文件数量庞大，安装进度条可能会由于磁盘 I/O 繁忙而暂时停顿。建议在安装过程中点击“显示详情”查看实时解压缩日志。"
!endif

!macro customInit
  ; 安装前强制终止正在运行的 SeekClaw 进程树（/T 杀子进程，/F 强制）
  nsExec::ExecToLog 'taskkill /IM "SeekClaw.exe" /T /F'
  ; 补杀残留的 gateway 子进程（SeekClaw Helper.exe 是 Electron 复用二进制跑 Node.js 的）
  ; /T 有时无法级联到 windowsHide 模式创建的子进程，需显式按进程名清理
  nsExec::ExecToLog 'taskkill /IM "SeekClaw Helper.exe" /F'
  ; 等待进程退出和文件句柄释放
  Sleep 2000
!macroend
