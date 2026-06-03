# TODO: 当前剩余任务

检查日期：2026-06-03

## 当前结论

P0/P1 中的主要代码问题已经修复并通过验证：

- [x] Host 异常断开时，Viewer 能收到 `leave`。
- [x] Host 信令错误提示不会再被 `stopSharing()` 清掉。
- [x] Viewer 收到 host `leave` 后会清理 video / PeerConnection / signaling。
- [x] Viewer 收到 signaling error 后会统一清理 UI 和底层资源。
- [x] Host ICE failed / disconnected 后会关闭对应 viewer PeerConnection 并更新 viewer 数量。

已执行验证：

- [x] `pnpm typecheck` 通过。
- [x] `pnpm lint` 通过。
- [x] `pnpm test` 通过：5 个 test files，31 个 tests。
- [x] `pnpm build` 通过。
- [x] `GET /healthz` 返回 `{"ok":true}`。
- [x] WebSocket 模拟验证通过：`create-room`、`join-room`、`viewer-joined`、`offer`、`answer`。
- [x] WebSocket 生命周期模拟通过：host socket close 后 viewer 收到 `leave`，`leave.peerId === host-test`。

说明：本 TODO 主要记录可通过代码、脚本、自动化测试和文档更新推进的事项。需要目标桌面环境验证的内容，统一记录到 `docs/uos-test-matrix.md`，由实际测试时填写结果。

## P0: 可执行任务

- [ ] 将 WebSocket 生命周期模拟固化为自动化测试。
  - 目标：把本次手工 Node 脚本验证迁移成可重复执行的测试，而不是依赖临时命令。
  - 覆盖场景：
    - host 创建 room。
    - viewer 加入 room。
    - host 收到 `viewer-joined`。
    - offer 转发到 viewer。
    - answer 转发到 host。
    - host socket close 后 viewer 收到 `leave`。
  - 建议位置：`apps/signaling-server/src/*.test.ts`。
  - 验收命令：`pnpm test`。

- [ ] 为 Viewer 清理路径补可测试的纯逻辑或轻量 DOM 测试。
  - 当前 Viewer 资源清理逻辑在 `apps/viewer/src/main.ts` 中，主要依赖 DOM 和 WebSocket 实例。
  - 建议抽出可单测的状态转换/清理 helper，或用 jsdom 覆盖以下行为：
    - 收到 signaling `error` 后按钮恢复、错误保留、视频占位恢复。
    - 收到 host `leave` 后 video 清空、PeerConnection close、signaling disconnect。
  - 验收命令：`pnpm test`。

- [ ] 为 Host 错误保留行为补自动化覆盖。
  - 当前 Host 在 signaling `disconnected` / `error` 时调用 `stopSharing({ keepError: true })`。
  - 建议抽出可测 helper 或用轻量 DOM 测试覆盖：
    - 信令断开后错误区域仍可见。
    - 状态显示为错误。
    - 本地 stream tracks 被 stop。
    - room 信息和 viewer 数量被清理。
  - 验收命令：`pnpm test`。

## P1: 工程质量

- [ ] 清理或压制 Host 构建警告。
  - 当前 `pnpm build` 通过，但 Host main 构建仍有 Vite warning：
    - `new URL(".", import.meta.url) doesn't exist at build time`
  - 建议：
    - 如果这是预期行为，按 Vite 建议加 `/* @vite-ignore */`。
    - 或改用更稳定的 runtime 路径计算方式。
  - 验收命令：`pnpm build` 不再出现该 warning。

- [ ] 检查 Electron main/preload 的 ESM 运行兼容性并形成明确结论。
  - 当前在 NixOS 环境下曾出现 Electron runtime 对 `electron` named export 不兼容的问题；这可能与 NixOS/npm Electron 二进制环境有关。
  - 保持 `pnpm typecheck`、`pnpm build` 通过。
  - 在 `docs/troubleshooting.md` 记录 NixOS 环境限制和建议的常规 Linux / UOS 验证方式。
  - 不要把“已在 NixOS 成功启动 Electron Host”写入结论，除非真的有可复现命令和输出。

- [ ] 更新 `docs/troubleshooting.md` 的 NixOS / Electron 说明。
  - 建议记录：
    - NixOS 上 npm Electron 二进制可能缺少动态库，需要 dev shell / FHS 环境。
    - `ps --no-headers` 需要 GNU `procps`，BusyBox `ps` 不兼容。
    - 若 `electron` npm 包没有下载二进制，需在 dev shell 内重新安装依赖或运行 Electron install 脚本。
    - NixOS 上不能替代 UOS/Deepin 的真实验收。

- [ ] 更新 `docs/uos-test-matrix.md`，添加目标环境验收清单。
  - 只维护表格和步骤，未实际执行的结果保持空白。
  - 建议保留待人工填写字段：
    - 是否能打开 Host。
    - 是否能弹出屏幕选择器。
    - 是否能共享整个屏幕。
    - 是否能共享窗口。
    - Viewer 是否能播放。
    - Host 停止共享后 Viewer 是否断开。
    - 用户取消授权后是否可再次开始共享。

## P2: 可选优化

- [ ] 去重 Host / Viewer 的 ICE server 解析逻辑。
  - 当前 Host 和 Viewer 各自解析 `VITE_RTC_ICE_SERVERS` / `VITE_ICE_SERVERS`。
  - 建议抽到 shared 或 renderer 公共 helper，避免配置解析行为分叉。
  - 验收命令：`pnpm typecheck && pnpm test && pnpm build`。

- [ ] 给 signaling room lifecycle 增加更多边界测试。
  - 建议覆盖：
    - host 重复 create-room 返回 `ALREADY_IN_ROOM`。
    - viewer 重复 join-room 返回 `ALREADY_IN_ROOM`。
    - target peer 不存在时返回 `PEER_NOT_FOUND`。
    - room 满员后返回 `ROOM_FULL`。
  - 验收命令：`pnpm test`。

- [ ] 检查 TODO/README/PROJECT 三者描述是否一致。
  - README 中不要声称已经通过真实 UOS 端到端测试。
  - PROJECT 是目标说明，TODO 是当前剩余任务，二者角色应保持清晰。

## 目标环境验收项

- [ ] UOS/Deepin 实体机或虚拟机上的真实屏幕共享验收。
- [ ] Wayland 下 portal / PipeWire 授权弹窗真实表现。
- [ ] Viewer 实际播放 Host 屏幕画面。
- [ ] 多屏、缩放比例、窗口共享等桌面环境相关结果。

这些事项需要在目标系统上执行，并把结果填写到 `docs/uos-test-matrix.md`。
