const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Node connected:', socket.id);

  socket.on('mesh_broadcast', (packet) => {
    // Relay to all other connected nodes
    socket.broadcast.emit('mesh_receive', packet);
  });

  // NEW: Relay the removal event
  socket.on('mesh_remove', (packetId) => {
    socket.broadcast.emit('mesh_remove', packetId);
  });

  socket.on('disconnect', () => {
    console.log('Node disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
