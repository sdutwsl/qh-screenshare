const CHARSET = "0123456789";

export function generateRoomId(): string {
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return id;
}

export function isValidRoomId(roomId: string): boolean {
  return /^[0-9]{6}$/.test(roomId);
}
