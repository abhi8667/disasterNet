const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins for hackathon demo
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`Radio Emulation: Node connected: ${socket.id}`);

  // The 'mesh_broadcast' event simulates a node broadcasting a packet over the air
  socket.on('mesh_broadcast', (packet) => {
    console.log(`[RADIO] Broadcasting packet ${packet.id} from node ${packet.sender}`);
    // Broadcast to all clients EXCEPT the sender
    socket.broadcast.emit('mesh_receive', packet);
  });

  socket.on('disconnect', () => {
    console.log(`Radio Emulation: Node disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Radio Emulation Socket.io server running on port ${PORT}`);
});
