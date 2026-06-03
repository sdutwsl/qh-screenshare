# UOS Screen Share

面向 UOS / Linux 桌面环境的轻量级屏幕共享软件。

## 架构

```
Electron Host App (发送端)
    ├─ navigator.mediaDevices.getDisplayMedia()
    ├─ RTCPeerConnection
    └─ WebSocket signaling client

Signaling Server (信令服务)
    ├─ room management
    ├─ offer/answer/ICE forwarding
    └─ peer lifecycle tracking

Browser Viewer (观看端)
    ├─ RTCPeerConnection
    ├─ remote MediaStream
    └─ HTMLVideoElement playback
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 同时启动所有服务
pnpm dev

# 或分别启动
pnpm dev:server   # 信令服务 (端口 3000)
pnpm dev:viewer   # 观看端 (端口 5174)
pnpm dev:host     # Electron 发送端
```

## 使用方式

1. 启动信令服务
2. 启动 Electron Host 应用
3. Host 点击"开始共享"，选择屏幕
4. Host 显示房间号
5. Viewer 在浏览器中打开 `http://localhost:5174`，输入房间号
6. Viewer 观看共享画面

## 项目结构

```
uos-screen-share/
├─ apps/
│  ├─ host/                 # Electron 发送端
│  ├─ viewer/               # 浏览器观看端
│  └─ signaling-server/     # 信令服务
├─ packages/shared/         # 共享类型和工具
└─ docs/                    # 文档
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 同时启动所有服务 |
| `pnpm dev:server` | 只启动信令服务 |
| `pnpm dev:host` | 只启动 Electron host |
| `pnpm dev:viewer` | 只启动浏览器 viewer |
| `pnpm build` | 构建全部项目 |
| `pnpm lint` | 代码检查 |
| `pnpm test` | 运行测试 |
| `pnpm typecheck` | TypeScript 类型检查 |

## 环境变量

```env
SIGNALING_PORT=3000
SIGNALING_WS_URL=ws://localhost:3000/ws
VIEWER_PUBLIC_URL=http://localhost:5174
MAX_VIEWERS_PER_ROOM=4
RTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"}]
```

## 安全性

- Electron renderer 启用 contextIsolation, sandbox, 禁用 nodeIntegration
- 默认不采集音频
- 不可远程控制，不注入键鼠事件
- 用户必须点击按钮才能开始共享
- host 退出后 room 立即失效

## License

MIT
