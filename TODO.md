# TODO: 当前剩余优化项

检查日期：2026-06-03

## 当前结论

上一轮列出的主要工程阻塞已经基本修复：类型检查、lint、测试、生产构建均已通过；signaling server 健康检查可用；create-room、join-room、viewer-joined、offer、answer 的 WebSocket 转发链路可模拟跑通。

仍建议继续优化的重点集中在连接生命周期、错误展示、真实 Electron/UOS 端到端验证。

## 已验证通过

- [x] `pnpm typecheck` 通过。
- [x] `pnpm lint` 通过。
- [x] `pnpm test` 通过：5 个 test files，30 个 tests。
- [x] `pnpm build` 通过。
- [x] `GET /healthz` 返回 `{"ok":true}`。
- [x] WebSocket 模拟验证通过：`create-room`、`join-room`、`viewer-joined`、`offer`、`answer`。
- [x] WebSocket 错误房间验证通过：不存在房间返回 `ROOM_NOT_FOUND`。
- [x] WebSocket 超大消息验证通过：超限消息返回 `MESSAGE_TOO_LARGE`。
- [x] `pnpm dev:viewer` 可启动，viewer 首页可正常返回 HTML。

## P0: 会影响最小验收的剩余问题

- [ ] 修复 host 异常断开时 viewer 收不到 `leave` 的问题。
  - 复现：WebSocket 模拟中 host socket close 后，viewer 等待 `leave` 超时。
  - 原因：`removePeer()` 里 host 离开时先调用 `destroyRoom()` 删除 room，之后 `cleanupPeer()` 再 `sendToPeer()`，此时 viewer 已经无法从 roomMap 中找到。
  - 相关代码：
    - `apps/signaling-server/src/rooms.ts`：`removePeer()` host 分支先 `destroyRoom(roomId)`。
    - `apps/signaling-server/src/index.ts`：`cleanupPeer()` 在 `result.wasHost` 后遍历 viewer ids 再发送 `leave`。
  - 建议：在销毁 room 前拿到 viewer WebSocket 并先广播 `leave` / `room-closed`，或让 `removePeer()` 返回可发送的 viewer sockets，再删除 room。
  - 建议补测试：新增 signaling lifecycle 测试，覆盖 host close 后 viewer 收到 `leave`。

## P1: 连接生命周期和 UI 体验优化

- [ ] 保留 Host 的信令错误提示，不要被 `stopSharing()` 清掉。
  - 现状：Host 在 signaling `disconnected` / `error` 分支中先 `showError()`，随后调用 `stopSharing()`；`stopSharing()` 会重置状态并 `hideError()`。
  - 影响：WebSocket 连接失败或断开时，用户可能看不到刚刚产生的错误。
  - 建议：给 `stopSharing()` 增加选项，例如 `stopSharing({ keepError: true, statusText: "信令断开" })`；或拆分资源释放函数和 UI 重置函数。

- [ ] Viewer 收到 host `leave` 后同时关闭 signaling socket。
  - 现状：`ViewerPeer` 收到 `leave` 后触发 `onDisconnected()` 并关闭 PeerConnection，但 `signaling` 仍可能保持连接。
  - 影响：Host 停止共享后 Viewer UI 已回到未连接，但底层 WebSocket 可能残留；用户再次连接会创建新的 signaling client。
  - 建议：`onDisconnected()` 里复用 `disconnect()`，或新增只清理 socket 且不发送 leave 的 `disconnect({ notify: false })`。

- [ ] Viewer 连接错误后同步恢复 UI 和底层资源。
  - 现状：收到 signaling `error` 消息时会显示错误和状态，但未统一调用 `viewerPeer.close()` / `cleanupVideo()` / socket 断开。
  - 建议：房间不存在、目标 peer 不存在、WebRTC offer 失败时，都走统一清理路径，确保按钮、视频、PeerConnection、WebSocket 状态一致。

- [ ] Host ICE 失败后考虑关闭对应 viewer 的 PeerConnection 并更新 viewer 数量。
  - 现状：Host 已把 ICE failed/disconnected 展示到 UI，但对应 viewer 连接仍留在 `viewers` map 中。
  - 建议：ICE failed 时关闭该 viewer connection，并触发 `onViewerLeft()` 或单独显示“连接失败的 viewer”。

## P2: 工程质量和可维护性优化

- [ ] 给 host 断开通知、viewer 清理路径补自动化测试。
  - 建议新增测试覆盖：
    - host socket close 后 viewer 收到 `leave`。
    - viewer 收到 `leave` 后 video/PeerConnection/signaling 状态清理。
    - signaling error 后 Host 不隐藏错误提示。

- [ ] 清理或压制 Host 构建警告。
  - 当前 `pnpm build` 通过，但有 Vite 警告：`new URL(".", import.meta.url) doesn't exist at build time`。
  - 建议：如果这是预期行为，按 Vite 建议加 `/* @vite-ignore */`；或改用更稳定的 runtime 路径计算方式。

- [ ] 把当前环境依赖问题补进 `docs/troubleshooting.md`。
  - 建议记录 Electron Linux 常见依赖，例如 `libgobject-2.0.so.0` 所属系统包。
  - 建议记录 BusyBox `ps` 与 `vite-plugin-electron` 的兼容问题，提示安装完整 `procps`。

- [ ] 在 `docs/uos-test-matrix.md` 写入真实测试结果。
  - 目前模板已存在，但还没有真实 UOS/X11/Wayland 测试记录。
  - 建议至少记录：
    - UOS + X11 + 单屏。
    - UOS + X11 + 多屏。
    - UOS + Wayland + 单屏。
    - UOS + Wayland + 多屏。
    - 100% / 125% / 150% 缩放。

## 已基本完成的 PROJECT.md 项

- [x] 仓库主体结构符合 `PROJECT.md`。
- [x] Electron BrowserWindow 安全默认值已配置：`contextIsolation`、`nodeIntegration: false`、`sandbox`、`preload`。
- [x] Host 使用标准 `navigator.mediaDevices.getDisplayMedia({ video, audio: false })`。
- [x] Viewer 不请求本地摄像头、麦克风或屏幕权限。
- [x] 视频数据走 WebRTC，不走 WebSocket。
- [x] signaling server 提供 `/healthz`。
- [x] signaling server 支持 create-room、join-room、offer、answer、ice-candidate、leave 基础协议。
- [x] `peerId` 主链路已统一为客户端上报并由服务端沿用。
- [x] Host 和 Viewer 已接入 Vite env 配置。
- [x] ICE servers 已支持 Vite env 解析并保留默认 STUN。
- [x] `SignalingClient` 已避免重复追加 `/ws`。
- [x] roomId 创建已避免覆盖已有 room。
- [x] `docs/uos-test-matrix.md` 和 `docs/troubleshooting.md` 已创建。
