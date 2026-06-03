export function detectEnv(): {
  xdgSessionType: string;
  display: string;
  waylandDisplay: string;
  xdgCurrentDesktop: string;
  desktopSession: string;
  isWayland: boolean;
  isX11: boolean;
} {
  const xdgSessionType = process.env.XDG_SESSION_TYPE || "unknown";
  const display = process.env.DISPLAY || "-";
  const waylandDisplay = process.env.WAYLAND_DISPLAY || "-";
  const xdgCurrentDesktop = process.env.XDG_CURRENT_DESKTOP || "unknown";
  const desktopSession = process.env.DESKTOP_SESSION || "unknown";

  const isWayland = xdgSessionType === "wayland";
  const isX11 = xdgSessionType === "x11";

  return {
    xdgSessionType,
    display,
    waylandDisplay,
    xdgCurrentDesktop,
    desktopSession,
    isWayland,
    isX11,
  };
}
