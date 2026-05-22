import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameRoom } from './gameRoom';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// roomId -> GameRoom
const rooms = new Map<string, GameRoom>();

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('connect:', socket.id);

  socket.on('create_room', (cb: (roomId: string) => void) => {
    const roomId = generateRoomId();
    const room = new GameRoom(roomId);
    room.addPlayer(socket.id);
    rooms.set(roomId, room);
    socket.join(roomId);
    cb(roomId);
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on('join_room', (roomId: string, cb: (ok: boolean, error?: string) => void) => {
    const room = rooms.get(roomId);
    if (!room) return cb(false, 'ルームが見つかりません');
    if (room.players.length >= 2) return cb(false, 'ルームが満員です');
    if (room.players.includes(socket.id)) return cb(false, '既に参加済みです');

    room.addPlayer(socket.id);
    socket.join(roomId);
    cb(true);

    if (room.players.length === 2) {
      room.startGame();
      io.to(roomId).emit('game_start', {
        players: room.players,
        state: room.getStateForPlayer(0),
      });
      // player0とplayer1で別々の状態を送る
      const [p0, p1] = room.players;
      io.to(p0).emit('game_state', room.getStateForPlayer(0));
      io.to(p1).emit('game_state', room.getStateForPlayer(1));
    }
  });

  socket.on('game_action', (roomId: string, action: any) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const playerIndex = room.players.indexOf(socket.id);
    if (playerIndex === -1) return;

    room.applyAction({ ...action, player: playerIndex });

    const [p0, p1] = room.players;
    if (p0) io.to(p0).emit('game_state', room.getStateForPlayer(0));
    if (p1) io.to(p1).emit('game_state', room.getStateForPlayer(1));
  });

  socket.on('disconnect', () => {
    console.log('disconnect:', socket.id);
    // ルームからプレイヤーを除去
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.includes(socket.id)) {
        io.to(roomId).emit('player_left', socket.id);
        rooms.delete(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
