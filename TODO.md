# TODO: PROJECT.md 实现差距

检查日期：2026-06-03

## 当前结论

项目已经搭起 Electron Host、Browser Viewer、WebSocket signaling server、共享协议类型、基础 UI、UOS 诊断信息和排障文档，但尚未达到 `PROJECT.md` 的最小验收标准。主要阻塞点是 WebRTC peerId 协议不一致、Host 构建失败，以及 lint/test 命令不可用。

已执行验证：

- [x] `pnpm typecheck` 通过。
- [ ] `pnpm build` 失败：Host 的 Vite/Electron entry 被解析为 `src/renderer/src/main/main.ts`。
- [ ] `pnpm lint` 失败：缺少 TypeScript ESLint 配置，ESLint 按默认 JS parser 解析 `.ts`。
- [ ] `pnpm test` 失败：没有任何 `*.test.ts` / `*.spec.ts` 文件，Vitest 以 code 1 退出。

## P0: 阻塞最小验收

- [ ] 修复客户端和服务端 `peerId` 来源不一致，当前会导致 offer/answer/ICE 被客户端忽略。
  - 现状：Host 和 Viewer 在客户端用 `randomUUID()` 生成本地 `peerId`，见 `apps/host/src/renderer/main.ts:143`、`apps/viewer/src/main.ts:71`。
  - 现状：signaling server 又在连接时生成自己的 `peerId`，并在转发 offer/answer/ICE 时覆盖 `fromPeerId`，见 `apps/signaling-server/src/index.ts:34`、`apps/signaling-server/src/index.ts:144`。
  - 影响：Viewer 收到 offer 时检查 `msg.toPeerId === this.peerId`，但 `toPeerId` 是服务端 viewer id，本地 `this.peerId` 是客户端随机 id，见 `apps/viewer/src/webrtc/viewer-peer.ts:43`。Host 收到 answer/ICE 也有同类问题，见 `apps/host/src/renderer/webrtc/host-peer.ts:66`、`apps/host/src/renderer/webrtc/host-peer.ts:73`。
  - 建议：统一使用服务端分配的 peerId，并让 Host 使用 `room-created.hostPeerId`；Viewer 加房后需要收到自己的 `viewerPeerId`，或改为服务端信任客户端上报的 `peerId`。

- [ ] 修复 Host 构建失败。
  - 现状：`apps/host/vite.config.ts:7` 设置 `root: "src/renderer"`，但 electron plugin entry 使用 `src/main/main.ts` 和 `src/preload/preload.ts`，见 `apps/host/vite.config.ts:20`、`apps/host/vite.config.ts:36`。
  - 影响：`pnpm build` 报错 `Could not resolve entry module "src/renderer/src/main/main.ts"`。
  - 建议：调整 electron entry 为相对正确路径，或拆分 renderer/main/preload 构建配置。

- [ ] 修复 Host 停止共享后 Viewer 侧播放状态和资源释放。
  - 现状：Viewer 收到 `leave` 只调用 `ViewerPeer.close()`，不会清空 `remoteVideo.srcObject`、隐藏视频或显示占位，见 `apps/viewer/src/webrtc/viewer-peer.ts:57`、`apps/viewer/src/main.ts:108`。
  - 现状：WebSocket `disconnected` 事件只更新按钮和状态，不关闭 peer 或清空 video，见 `apps/viewer/src/main.ts:84`。
  - 验收目标：Host 点击“停止共享”后，Viewer 停止播放并显示连接已断开。

## P1: 补齐 PROJECT.md 明确要求

- [ ] 让 Host 和 Viewer 真正支持 `.env` / 配置项。
  - Host 现在硬编码 `DEFAULT_SIGNALING_URL` 和 `VIEWER_PUBLIC_URL`，见 `apps/host/src/renderer/main.ts:24`。
  - Viewer 使用 `import.meta.env.VITE_SIGNALING_URL`，但根 `.env` 写的是 `SIGNALING_WS_URL`，见 `apps/viewer/src/main.ts:5`、`.env:2`。
  - signaling server 使用 `process.env`，但当前启动脚本没有显式加载 `.env`。
  - `SignalingClient` 会无条件追加 `/ws`，如果配置值已经是 `ws://host:3000/ws` 会变成 `/ws/ws`，见 `apps/host/src/renderer/webrtc/signaling-client.ts:21`、`apps/viewer/src/webrtc/signaling-client.ts:21`。

- [ ] 实现可配置 ICE servers。
  - 现状：Host 和 Viewer 的 `parseIceServers()` 都只返回 `DEFAULT_RTC_CONFIG`，没有解析 `RTC_ICE_SERVERS` 或配置文件，见 `apps/host/src/renderer/webrtc/host-peer.ts:21`、`apps/viewer/src/webrtc/viewer-peer.ts:14`。
  - 验收目标：配置优先级满足“环境变量 -> 配置文件 -> 默认 STUN”，并保留 TURN 扩展格式。

- [ ] 修复局域网/自定义 signaling server 支持。
  - Host CSP 只允许 `ws://localhost:*` 和 `wss://localhost:*`，会阻止连接局域网 IP 或自定义域名，见 `apps/host/src/renderer/index.html:8`。
  - Host UI 未显示“信令服务器：...”字段，不符合 Host 首页 UI 示例。

- [ ] 补齐错误处理并全部展示到 UI。
  - Host 未显式处理 `navigator.mediaDevices.getDisplayMedia` 不存在。
  - Host 在已拿到屏幕流后如果 WebSocket 连接失败，只显示错误，不会停止本地 track 或恢复 UI，见 `apps/host/src/renderer/main.ts:134`、`apps/host/src/renderer/main.ts:160`。
  - Host ICE `failed` / `disconnected` 只写 debug log，没有展示给用户，见 `apps/host/src/renderer/webrtc/host-peer.ts:112`。
  - Viewer `handleOffer()` 没有 try/catch，`setRemoteDescription`、`createAnswer`、`setLocalDescription` 失败时可能成为未处理异常，见 `apps/viewer/src/webrtc/viewer-peer.ts:105`。

- [ ] 修复 signaling server 的消息大小限制。
  - 现状：`ws` message handler 收到的是 `Buffer`，但 `isValidWebSocketMessage()` 只检查 string，见 `apps/signaling-server/src/index.ts:39`、`apps/signaling-server/src/protocol.ts:59`。
  - 验收目标：超大 JSON 返回 `MESSAGE_TOO_LARGE`，服务不崩溃。

- [ ] 避免 roomId 冲突。
  - 现状：`generateRoomId()` 随机生成 6 位数字，`createRoom()` 没有检查是否已存在，可能覆盖已有 room，见 `packages/shared/src/room-id.ts:3`、`apps/signaling-server/src/rooms.ts:28`。

- [ ] 调整 host 断开生命周期通知。
  - 现状：`removePeer()` 在 host 离开时先 `destroyRoom()` 并关闭 viewer socket，再返回一个空 viewers map，后续 `cleanupPeer()` 已无法向原 viewer 列表发送明确 `leave`，见 `apps/signaling-server/src/rooms.ts:68`、`apps/signaling-server/src/rooms.ts:87`、`apps/signaling-server/src/index.ts:171`。
  - 建议：销毁 room 前先向原 viewers 广播 `leave` / `room-closed`，再关闭 socket 或允许 viewer 自行断开。

## P2: 工程质量和验收覆盖

- [ ] 增加 ESLint 配置。
  - 当前 root `package.json:10` 有 `pnpm lint`，但仓库没有 `.eslintrc*` 或 `eslint.config.*`，导致所有 `.ts` 文件 parsing error。

- [ ] 增加 Vitest 测试，至少覆盖非 WebRTC 核心逻辑。
  - 建议优先覆盖 `generateRoomId()` / `isValidRoomId()`、`validateMessage()`、room 创建/加入/上限/清理、超大消息拒绝。
  - 确保 `pnpm test` 在没有业务失败时返回 0。

- [ ] 增加端到端或手动验收记录。
  - `docs/uos-test-matrix.md` 已有模板，但还没有真实 UOS/X11/Wayland 测试结果。
  - 最小场景需要记录：本机回环、局域网、用户取消授权、Viewer 加入不存在房间。

- [ ] 日志格式进一步结构化。
  - 当前 logger 有 timestamp、level、roomId、peerId，但不是 JSON 结构化日志。若按 `PROJECT.md` 严格要求“输出结构化日志”，建议输出单行 JSON 或提供可切换格式。

## 已满足或基本满足的部分

- [x] 仓库主体结构基本符合 `PROJECT.md`。
- [x] Electron BrowserWindow 使用 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`preload`。
- [x] Host 通过标准 `navigator.mediaDevices.getDisplayMedia({ video, audio: false })` 采集屏幕。
- [x] Viewer 不请求本地摄像头、麦克风或屏幕权限。
- [x] 视频数据没有通过 WebSocket 转发，代码路径是 WebRTC offer/answer/ICE。
- [x] signaling server 有 `/healthz`，有 create-room、join-room、offer、answer、ice-candidate、leave 基础处理。
- [x] `docs/uos-test-matrix.md` 和 `docs/troubleshooting.md` 已创建。
