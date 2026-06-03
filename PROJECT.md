# PROJECT.md

## 项目名称

UOS Screen Share

## 项目目标

开发一个面向 UOS / Linux 桌面环境的轻量级屏幕共享软件。

第一阶段只实现“被共享端发送屏幕画面，观看端实时观看”，不实现远程控制、不实现键盘鼠标注入、不实现文件传输、不实现聊天、不实现录制。

核心目标是：

1. 被共享端运行 Electron 桌面应用。
2. 用户点击“开始共享”后，选择要共享的屏幕或窗口。
3. 应用通过 WebRTC 将屏幕画面发送给观看端。
4. 观看端使用普通浏览器即可观看。
5. 信令服务只负责交换 WebRTC 所需的 offer、answer、ICE candidate，不转发视频数据。
6. 支持 UOS 下常见的 X11 与 Wayland 场景。
7. Wayland 下遵守系统屏幕共享授权模型，不尝试绕过 portal / PipeWire 权限限制。

## 非目标

本项目第一阶段明确不做以下功能：

1. 不做远程控制。
2. 不注入鼠标键盘事件。
3. 不做系统级常驻服务。
4. 不做无人值守远程桌面。
5. 不采集麦克风。
6. 不采集系统声音。
7. 不做文件传输。
8. 不做多用户会议系统。
9. 不做服务端视频转码。
10. 不做私有音视频协议。

## 技术路线

采用 Electron + WebRTC + WebSocket 信令。

整体架构如下：

```text
Electron Host App
  ├─ navigator.mediaDevices.getDisplayMedia()
  ├─ optional Electron desktopCapturer fallback
  ├─ RTCPeerConnection
  └─ WebSocket signaling client

Signaling Server
  ├─ room management
  ├─ offer forwarding
  ├─ answer forwarding
  ├─ ICE candidate forwarding
  └─ peer lifecycle tracking

Browser Viewer
  ├─ RTCPeerConnection
  ├─ remote MediaStream
  └─ HTMLVideoElement playback
```

视频数据必须走 WebRTC，不允许通过 WebSocket 传输视频帧。

## 推荐技术栈

* Runtime: Node.js LTS
* Desktop: Electron
* Frontend: TypeScript + Vite
* Signaling: Node.js + ws
* WebRTC: 原生浏览器 WebRTC API
* Package Manager: pnpm
* Build: electron-builder
* Code Style: ESLint + Prettier
* Test: Vitest，用于非 WebRTC 核心逻辑
* Target Package: AppImage 优先，后续补 deb

## 仓库结构

请按以下结构初始化项目：

```text
uos-screen-share/
├─ PROJECT.md
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .gitignore
├─ .editorconfig
├─ apps/
│  ├─ host/
│  │  ├─ package.json
│  │  ├─ electron-builder.yml
│  │  ├─ vite.config.ts
│  │  ├─ src/
│  │  │  ├─ main/
│  │  │  │  ├─ main.ts
│  │  │  │  ├─ display-media.ts
│  │  │  │  └─ env.ts
│  │  │  ├─ preload/
│  │  │  │  └─ preload.ts
│  │  │  └─ renderer/
│  │  │     ├─ index.html
│  │  │     ├─ main.ts
│  │  │     ├─ styles.css
│  │  │     ├─ webrtc/
│  │  │     │  ├─ host-peer.ts
│  │  │     │  └─ signaling-client.ts
│  │  │     └─ ui/
│  │  │        └─ state.ts
│  │  └─ assets/
│  │
│  ├─ viewer/
│  │  ├─ package.json
│  │  ├─ vite.config.ts
│  │  └─ src/
│  │     ├─ index.html
│  │     ├─ main.ts
│  │     ├─ styles.css
│  │     └─ webrtc/
│  │        ├─ viewer-peer.ts
│  │        └─ signaling-client.ts
│  │
│  └─ signaling-server/
│     ├─ package.json
│     └─ src/
│        ├─ index.ts
│        ├─ rooms.ts
│        └─ protocol.ts
│
├─ packages/
│  └─ shared/
│     ├─ package.json
│     └─ src/
│        ├─ signaling-types.ts
│        ├─ room-id.ts
│        └─ logger.ts
│
└─ docs/
   ├─ uos-test-matrix.md
   └─ troubleshooting.md
```

## 工作区说明

项目包含三个主要应用：

### apps/host

Electron 被共享端。

职责：

1. 显示主窗口。
2. 检测当前 Linux 会话类型。
3. 提供“开始共享”和“停止共享”按钮。
4. 调用屏幕采集 API。
5. 创建 WebRTC offer。
6. 将 offer 和 ICE candidate 发给信令服务。
7. 显示房间号。
8. 显示连接状态。
9. 显示当前是否正在共享。
10. 停止共享时释放全部 MediaStreamTrack。

### apps/viewer

浏览器观看端。

职责：

1. 输入房间号。
2. 连接信令服务。
3. 接收 host offer。
4. 创建 answer。
5. 接收 remote track。
6. 将远程 MediaStream 挂载到 video 元素。
7. 显示连接状态。
8. 支持断开连接。
9. 视频区域自适应窗口大小。
10. 观看端不请求任何本地媒体权限。

### apps/signaling-server

WebSocket 信令服务。

职责：

1. 创建房间。
2. 加入房间。
3. 转发 WebRTC offer。
4. 转发 WebRTC answer。
5. 转发 ICE candidate。
6. 处理 peer 断开。
7. 清理空房间。
8. 限制单个房间的 viewer 数量。
9. 提供简单健康检查接口。
10. 输出结构化日志。

## 信令协议

所有 WebSocket 消息使用 JSON。

基础结构：

```ts
type SignalMessage =
  | CreateRoomMessage
  | RoomCreatedMessage
  | JoinRoomMessage
  | ViewerJoinedMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | LeaveMessage
  | ErrorMessage;
```

消息类型：

```ts
type Role = "host" | "viewer";

interface BaseMessage {
  type: string;
  roomId?: string;
  peerId?: string;
}

interface CreateRoomMessage extends BaseMessage {
  type: "create-room";
  role: "host";
}

interface RoomCreatedMessage extends BaseMessage {
  type: "room-created";
  roomId: string;
  hostPeerId: string;
}

interface JoinRoomMessage extends BaseMessage {
  type: "join-room";
  role: "viewer";
  roomId: string;
}

interface ViewerJoinedMessage extends BaseMessage {
  type: "viewer-joined";
  roomId: string;
  viewerPeerId: string;
}

interface OfferMessage extends BaseMessage {
  type: "offer";
  roomId: string;
  fromPeerId: string;
  toPeerId: string;
  sdp: RTCSessionDescriptionInit;
}

interface AnswerMessage extends BaseMessage {
  type: "answer";
  roomId: string;
  fromPeerId: string;
  toPeerId: string;
  sdp: RTCSessionDescriptionInit;
}

interface IceCandidateMessage extends BaseMessage {
  type: "ice-candidate";
  roomId: string;
  fromPeerId: string;
  toPeerId: string;
  candidate: RTCIceCandidateInit;
}

interface LeaveMessage extends BaseMessage {
  type: "leave";
  roomId: string;
  peerId: string;
}

interface ErrorMessage extends BaseMessage {
  type: "error";
  code: string;
  message: string;
}
```

## 房间模型

第一阶段采用单 host、多 viewer 模型。

限制：

1. 每个 room 只能有一个 host。
2. 每个 room 默认最多 4 个 viewer。
3. roomId 使用 6 位数字或 8 位短码。
4. roomId 需要避免容易混淆的字符。
5. host 断开后，room 立即销毁。
6. viewer 断开后，从 room 中移除。
7. 空 room 自动清理。
8. 不需要持久化 room 状态。

## WebRTC 连接模型

第一阶段优先实现 host 与每个 viewer 单独建立 PeerConnection。

也就是：

```text
host <-> viewer 1
host <-> viewer 2
host <-> viewer 3
```

不要在第一阶段实现 SFU。

Host 逻辑：

1. 用户点击“开始共享”。
2. 调用 `navigator.mediaDevices.getDisplayMedia()` 获取屏幕流。
3. 连接信令服务器。
4. 创建 room。
5. 等待 viewer 加入。
6. 每个 viewer 加入时，为该 viewer 创建独立 RTCPeerConnection。
7. 将屏幕流里的 video track 添加到 peer connection。
8. 创建 offer。
9. 通过信令服务发送给指定 viewer。
10. 接收 answer。
11. 交换 ICE candidate。
12. 连接成功后更新 UI 状态。

Viewer 逻辑：

1. 用户输入 roomId。
2. 连接信令服务器。
3. 加入 room。
4. 接收 host offer。
5. 创建 RTCPeerConnection。
6. 设置 remote description。
7. 创建 answer。
8. 设置 local description。
9. 通过信令服务发送 answer。
10. 接收 remote track。
11. 播放远程视频。

## ICE 配置

第一阶段默认配置：

```ts
const rtcConfig: RTCConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};
```

必须将 ICE 配置做成可配置项。

后续需要支持 TURN：

```ts
interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}
```

配置来源优先级：

1. 环境变量。
2. 配置文件。
3. 默认 STUN。

## Electron Host 实现要求

### 安全设置

BrowserWindow 必须使用安全默认值：

```ts
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  preload: preloadPath,
}
```

禁止在 renderer 中直接访问 Node.js API。

preload 只暴露必要 IPC：

```ts
window.hostAPI = {
  getRuntimeInfo: () => Promise<RuntimeInfo>,
};
```

Renderer 中的 WebRTC 和 getDisplayMedia 可以直接使用浏览器 API。

### 屏幕采集优先级

优先使用标准 API：

```ts
navigator.mediaDevices.getDisplayMedia({
  video: {
    frameRate: { ideal: 30, max: 30 },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
});
```

不要默认采集音频。

可选实现 Electron 主进程中的 `setDisplayMediaRequestHandler`，用于更好地接入 Electron 桌面源选择能力。

要求：

1. X11 下应能正常弹出或使用 Electron 的屏幕选择流程。
2. Wayland 下应优先使用系统选择器。
3. 不要试图绕过系统授权。
4. 如果没有可用屏幕源，要给出明确错误提示。
5. 如果用户取消授权，要显示“用户取消共享”，不要当成程序崩溃。

### Linux / UOS 运行时检测

Host 启动时读取：

```ts
process.env.XDG_SESSION_TYPE
process.env.DISPLAY
process.env.WAYLAND_DISPLAY
process.env.XDG_CURRENT_DESKTOP
process.env.DESKTOP_SESSION
```

渲染到 UI 的诊断信息中。

UI 显示示例：

```text
会话类型：x11
桌面环境：deepin
显示服务：:0
Wayland Display：-
```

如果检测到 Wayland，显示提示：

```text
当前为 Wayland 会话，屏幕共享可能依赖系统选择器、PipeWire 和 xdg-desktop-portal。
如果无法共享，请确认系统屏幕共享权限和 portal 服务是否可用。
```

### 停止共享

停止共享必须完整释放资源：

1. 调用所有 local track 的 `stop()`。
2. 关闭所有 RTCPeerConnection。
3. 关闭 WebSocket 或退出 room。
4. 清空 video preview。
5. 清空 viewer 列表。
6. UI 回到未共享状态。

### 错误处理

必须处理以下错误：

1. 用户取消屏幕选择。
2. getDisplayMedia 不存在。
3. 获取屏幕流失败。
4. WebSocket 连接失败。
5. 信令服务器返回 room 不存在。
6. viewer 断开。
7. host 断开。
8. ICE connection failed。
9. 浏览器不支持 WebRTC。
10. Wayland/PipeWire 相关采集失败。

错误要展示给用户，不要只写 console。

## Viewer 实现要求

Viewer 是普通 Web 应用。

页面包含：

1. 房间号输入框。
2. 连接按钮。
3. 断开按钮。
4. 视频播放区域。
5. 连接状态。
6. 错误提示区域。

视频元素要求：

```html
<video autoplay playsinline controls></video>
```

Viewer 不应请求摄像头、麦克风或屏幕权限。

Viewer 接收到 remote stream 后：

```ts
video.srcObject = remoteStream;
await video.play();
```

如果浏览器阻止自动播放，需要显示“点击播放”。

## Signaling Server 实现要求

使用 Node.js + ws。

启动参数：

```bash
PORT=3000 pnpm dev
```

WebSocket 地址：

```text
ws://localhost:3000/ws
```

健康检查：

```text
GET /healthz
```

返回：

```json
{
  "ok": true
}
```

房间清理：

1. host 断开，删除 room。
2. viewer 断开，从 room 移除。
3. 空 room 删除。
4. 异常 socket 关闭时清理 peer。
5. 每 60 秒扫描一次孤儿 room。

基础限制：

1. 单房间 viewer 数量默认最大 4。
2. 单个 IP 的连接数量可以先不限制，但代码结构要方便后续添加。
3. 消息体大小需要限制，避免超大 JSON。
4. 非法消息返回 error，不要让服务崩溃。

## UI 要求

第一阶段 UI 简单即可。

Host 首页：

```text
UOS Screen Share

状态：未共享
会话类型：x11 / wayland / unknown
信令服务器：ws://localhost:3000/ws

[开始共享]
```

开始共享后：

```text
状态：正在共享
房间号：123456
观看地址：http://localhost:5174/?room=123456
已连接观看端：1

[停止共享]
```

Viewer 页面：

```text
UOS Screen Share Viewer

房间号：[      ]
[连接]

状态：未连接

[视频区域]
```

## 开发命令

根目录提供以下命令：

```bash
pnpm install
pnpm dev
pnpm dev:server
pnpm dev:host
pnpm dev:viewer
pnpm build
pnpm lint
pnpm test
pnpm typecheck
```

期望行为：

* `pnpm dev` 同时启动 signaling-server、viewer、host。
* `pnpm dev:server` 只启动信令服务。
* `pnpm dev:host` 只启动 Electron host。
* `pnpm dev:viewer` 只启动浏览器 viewer。
* `pnpm build` 构建全部项目。
* `pnpm typecheck` 对所有 workspace 做 TypeScript 检查。

## 配置

支持 `.env`：

```env
SIGNALING_PORT=3000
SIGNALING_WS_URL=ws://localhost:3000/ws
VIEWER_PUBLIC_URL=http://localhost:5174
MAX_VIEWERS_PER_ROOM=4
RTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"}]
```

Host 和 Viewer 都应能配置 signaling server 地址。

## UOS 测试矩阵

在 `docs/uos-test-matrix.md` 中记录测试结果。

至少包含以下字段：

```text
UOS 版本：
CPU 架构：
Electron 版本：
Node.js 版本：
XDG_SESSION_TYPE：
XDG_CURRENT_DESKTOP：
是否 X11：
是否 Wayland：
是否能打开 Host：
是否能弹出屏幕选择：
是否能共享整个屏幕：
是否能共享窗口：
Viewer 是否能播放：
多屏是否正常：
缩放比例：
问题记录：
```

优先测试：

1. UOS + X11 + 单屏。
2. UOS + X11 + 多屏。
3. UOS + Wayland + 单屏。
4. UOS + Wayland + 多屏。
5. Deepin/UOS 桌面缩放 100%。
6. Deepin/UOS 桌面缩放 125% 或 150%。

## 故障排查文档

在 `docs/troubleshooting.md` 中写入以下排查项：

### 1. 无法选择屏幕

检查：

```bash
echo $XDG_SESSION_TYPE
echo $DISPLAY
echo $WAYLAND_DISPLAY
```

Wayland 下检查：

```bash
systemctl --user status pipewire
systemctl --user status xdg-desktop-portal
```

### 2. Viewer 黑屏

检查：

1. Host 是否已经选择屏幕。
2. Host video track 是否存在。
3. Signaling offer/answer 是否交换完成。
4. ICE connection state。
5. 浏览器 console。
6. 是否被防火墙阻止。
7. 是否需要 TURN。

### 3. 本机能看，跨网络不能看

说明当前只有 STUN，不保证所有 NAT 下可用。

解决方向：

1. 部署 TURN。
2. 配置 coturn。
3. 将 TURN 写入 `RTC_ICE_SERVERS`。

### 4. Wayland 下不能共享

说明：

Wayland 下屏幕共享依赖系统授权、PipeWire、xdg-desktop-portal 和桌面环境后端。应用不能绕过这些权限。

建议：

1. 确认 portal 服务运行。
2. 确认系统允许屏幕共享。
3. 尝试 X11 会话。
4. 记录 UOS 版本和桌面环境。
5. 记录 Electron 版本。

## 编码规范

1. 全部业务代码使用 TypeScript。
2. 禁止使用 `any`，必要时用明确类型。
3. 公共协议类型放到 `packages/shared`。
4. WebSocket 消息必须做运行时校验。
5. 所有异步流程必须处理异常。
6. UI 状态必须可追踪，不要散落全局变量。
7. 资源释放必须集中实现。
8. 不要把 WebRTC 和 UI 强耦合。
9. 不要把 signaling 逻辑写死在组件里。
10. 日志要包含 roomId 和 peerId，但不要记录 SDP 全文。

## 安全要求

第一阶段虽然是 MVP，但必须满足：

1. 默认不自动开始共享。
2. 必须由用户点击按钮触发共享。
3. 用户必须能随时停止共享。
4. 默认不采集音频。
5. 不实现远程控制。
6. 不暴露 Node.js API 给 renderer。
7. 不在日志里输出完整 SDP。
8. 不在日志里输出 ICE candidate 的敏感网络细节，除非 debug 模式开启。
9. 房间号不要永久有效。
10. host 退出后 room 立即失效。

## 最小验收标准

完成后必须满足以下场景：

### 场景 1：本机回环测试

1. 启动 signaling server。
2. 启动 Electron host。
3. 启动 viewer。
4. Host 点击开始共享。
5. Host 选择屏幕。
6. Host 显示 roomId。
7. Viewer 输入 roomId。
8. Viewer 成功看到 Host 屏幕。
9. Host 点击停止共享。
10. Viewer 停止播放并显示连接已断开。

### 场景 2：局域网测试

1. Host 在 UOS 机器运行。
2. Viewer 在另一台机器浏览器打开。
3. Viewer 通过局域网 IP 连接 signaling server。
4. 能看到 Host 屏幕。
5. 延迟在可接受范围内。
6. 断开后可重新连接。

### 场景 3：用户取消授权

1. Host 点击开始共享。
2. 用户在系统选择器里取消。
3. 应用不崩溃。
4. UI 显示用户取消共享。
5. 可以再次点击开始共享。

### 场景 4：Viewer 先加入不存在房间

1. Viewer 输入错误 roomId。
2. 服务端返回错误。
3. Viewer 显示房间不存在。
4. 页面不崩溃。

## 实现顺序

Codex 请按以下顺序实现：

1. 初始化 pnpm workspace。
2. 创建 shared 包，定义 signaling 协议类型。
3. 实现 signaling-server。
4. 实现 viewer 的 WebSocket 连接和基础 UI。
5. 实现 host 的 Electron 窗口和基础 UI。
6. 实现 host 的 getDisplayMedia 屏幕采集。
7. 实现 host 与 viewer 的 WebRTC offer/answer。
8. 实现 ICE candidate 交换。
9. 实现停止共享和资源释放。
10. 实现错误提示。
11. 实现环境诊断信息展示。
12. 补 README。
13. 补 UOS 测试矩阵文档。
14. 补 troubleshooting 文档。
15. 补 lint/typecheck/test 命令。

## 第一阶段完成后再考虑的功能

以下功能不要在第一阶段实现，但代码结构要允许后续添加：

1. TURN 配置界面。
2. 连接密码。
3. 房间访问令牌。
4. 多 viewer 优化。
5. SFU 服务。
6. 低码率模式。
7. 帧率选择。
8. 分辨率选择。
9. 只共享指定窗口。
10. AppImage / deb 打包优化。
11. 自动更新。
12. 企业内网部署模式。
13. 日志导出。
14. Web 管理后台。
15. 原生 PipeWire 采集模块。

## 关键原则

1. 先跑通，不要过度设计。
2. 视频流走 WebRTC，不要走 WebSocket。
3. 第一阶段只做屏幕共享，不碰远程控制。
4. Electron renderer 禁止 Node.js 权限。
5. Wayland 下遵守系统权限模型。
6. 所有资源都必须能被停止共享按钮释放。
7. 所有错误都必须能在 UI 中看到。
8. 不要依赖 UOS 私有 API。
9. 不要假设只有 X11。
10. 不要假设公网 P2P 一定可连，后续用 TURN 解决。
