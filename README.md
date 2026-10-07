# SOS Online

Real-time multiplayer 16x16 SOS game.

## Stack
- React + Vite
- Node.js + Socket.IO

## Local setup

Run server and client separately:

```bash
cd server && npm install && npm run dev
cd client && npm install && npm run dev
```

The client reads `VITE_SERVER_URL` for the Socket.IO server URL; default is `http://localhost:3001`.

## Game
- 16x16 board
- Create/join private rooms
- Host starts game
- Teams A/B
- Horizontal, vertical and diagonal SOS detection
- Each unique SOS line scores exactly +1 and is struck visually
- Scored SOS lines cannot score again
- Real-time synchronization
- Mobile-responsive board and controls
