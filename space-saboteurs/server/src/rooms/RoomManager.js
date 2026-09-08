const GameRoom = require("./GameRoom");
const { MAX_PLAYERS } = require("../validation/InputValidator");

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 ambiguity

function generateRoomCode(existingCodes) {
  let code;
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (existingCodes.has(code));
  return code;
}

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomId -> GameRoom
    this.quickPlayQueueRoomId = null;
    setInterval(() => this.cleanupEmptyRooms(), 30000);
  }

  createRoom() {
    const code = generateRoomCode(new Set(this.rooms.keys()));
    const room = new GameRoom(code, this.io);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  findQuickPlayRoom() {
    if (this.quickPlayQueueRoomId) {
      const room = this.rooms.get(this.quickPlayQueueRoomId);
      if (room && room.phase === "LOBBY" && room.players.size < MAX_PLAYERS) {
        return room;
      }
    }
    const room = this.createRoom();
    this.quickPlayQueueRoomId = room.roomId;
    return room;
  }

  cleanupEmptyRooms() {
    for (const [code, room] of this.rooms.entries()) {
      const age = Date.now() - room.createdAt;
      if (room.isEmpty() && age > 60000) {
        room.destroy();
        this.rooms.delete(code);
        if (this.quickPlayQueueRoomId === code) this.quickPlayQueueRoomId = null;
      }
    }
  }
}

module.exports = RoomManager;
