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

## 在 Windows 上使用

### 方式 1：直接源码运行

先安装：

- Node.js 22
- Git

然后执行：

```bash
git clone git@github.com:zhangfeiyang/myshell.git
cd myshell
npm install
npm run start
```

启动后输入：

- Linux 主机 IP 或域名
- SSH 端口
- 用户名
- 密码或私钥

连接成功后，终端里执行的就是远端 Linux 的命令。

### 方式 2：生成 Windows 安装包

这个项目已经配置好 `electron-builder`，会生成 `NSIS` 安装包。

请在 **Windows 本机** 执行：

```bash
npm install
npm run dist:win
```

构建完成后，安装包会出现在：

```bash
release/
```

典型文件名类似：

```bash
MyShell-Setup-0.1.0.exe
```

双击安装后即可像普通 Windows 软件一样使用。

### 为什么建议在 Windows 上打包

Windows 安装包最稳妥的做法是在 Windows 自己构建，因为：

- `NSIS` 是 Windows 安装器链路
- 跨平台从 Linux 构建 `.exe` 经常涉及额外兼容层
- 本项目目标本来就是 Windows 桌面交付

## 后续可扩展项

- 保存主机列表
- SFTP 文件传输
- 主题配置
- 快捷命令面板
- 端口转发
- 跳板机 / ProxyJump
- 已知主机指纹校验
