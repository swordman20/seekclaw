; SeekClaw NSIS 自定义钩子
; 解决托盘常驻模式下 WM_CLOSE 被拦截、安装器报"无法关闭"的问题

!macro customInit
  ; 安装前强制终止正在运行的 SeekClaw 进程树（/T 杀子进程，/F 强制）
  nsExec::ExecToLog 'taskkill /IM "SeekClaw.exe" /T /F'
  ; 补杀残留的 gateway 子进程（SeekClaw Helper.exe 是 Electron 复用二进制跑 Node.js 的）
  ; /T 有时无法级联到 windowsHide 模式创建的子进程，需显式按进程名清理
  nsExec::ExecToLog 'taskkill /IM "SeekClaw Helper.exe" /F'
  ; 等待进程退出和文件句柄释放
  Sleep 2000
!macroend
