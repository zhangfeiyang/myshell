# MyShell

一个类似 Xshell 的轻量 SSH 终端原型，基于 Electron、`ssh2` 和 `xterm.js`。

## 目标

- 在 Windows 上提供桌面终端界面
- 通过 SSH 连接 Linux 主机
- 连接后支持远端 Linux 的全部命令和交互式操作
- 支持多会话切换

## 重要边界

如果 **不安装 WSL、虚拟机、容器、Cygwin/MSYS2 等 Linux 运行时**，Windows 本机不能“原生支持所有 Linux 命令”。  
这个项目采用的正确实现方式是：

- Windows 负责运行终端客户端
- Linux 命令在远端 Linux 主机上通过 SSH 执行

这也是 Xshell、SecureCRT 一类工具的典型工作方式。

## 当前 MVP 功能

- SSH 密码认证
- SSH 私钥认证
- `xterm-256color` 交互式终端
- 多标签会话
- 终端窗口大小同步

## 启动

```bash
npm install
npm run start
```

开发时会启动：

- Vite 前端开发服务器
- Electron 桌面主进程

## 后续可扩展项

- 保存主机列表
- SFTP 文件传输
- 主题配置
- 快捷命令面板
- 端口转发
- 跳板机 / ProxyJump
- 已知主机指纹校验
