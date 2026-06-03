# Troubleshooting

## 1. 无法选择屏幕

检查当前会话类型：

```bash
echo $XDG_SESSION_TYPE
echo $DISPLAY
echo $WAYLAND_DISPLAY
```

### Wayland 下检查：

```bash
systemctl --user status pipewire
systemctl --user status xdg-desktop-portal
```

如果 portal 服务未运行，尝试：

```bash
systemctl --user start xdg-desktop-portal
```

### 常见原因

- Wayland 下需要 PipeWire 和 xdg-desktop-portal
- Electron 版本过低不支持 Wayland 屏幕采集
- 系统未授予屏幕共享权限

## 2. Viewer 黑屏

排查步骤：

1. Host 是否已经选择屏幕
2. Host video track 是否存在（检查本地预览）
3. Signaling offer/answer 是否交换完成（检查 Network 标签）
4. ICE connection state（打开浏览器 console 查看）
5. 浏览器 console 是否有错误
6. 是否被防火墙阻止
7. 是否需要 TURN

## 3. 本机能看，跨网络不能看

说明当前只有 STUN，不保证所有 NAT 下可用。

解决方向：

1. 部署 TURN 服务器
2. 配置 coturn
3. 将 TURN 写入 RTC_ICE_SERVERS 环境变量

## 4. Wayland 下不能共享

Wayland 下屏幕共享依赖系统授权、PipeWire、xdg-desktop-portal 和桌面环境后端。应用不能绕过这些权限。

建议：

1. 确认 portal 服务运行
2. 确认系统允许屏幕共享
3. 尝试 X11 会话
4. 记录 UOS 版本和桌面环境
5. 记录 Electron 版本

## 5. 信令服务连接失败

检查：

```bash
curl http://localhost:3000/healthz
```

应该返回 `{"ok":true}`。

如果返回错误：

1. 确认 signaling server 已启动
2. 确认端口未被占用
3. 检查防火墙设置
