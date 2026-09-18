import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // En producción limitar a la URL del dashboard
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Endpoint para que Next.js o el Webhook de Kommo notifiquen un cambio y se emita a los clientes
app.post('/api/emit', (req, res) => {
  const { event, data } = req.body;
  if (event && data) {
    io.emit(event, data);
    console.log(`Evento emitido a clientes: ${event}`);
    return res.status(200).json({ success: true });
  }
  return res.status(400).json({ error: 'Falta event o data' });
});

const PORT = process.env.SOCKET_PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor WebSockets corriendo en http://localhost:${PORT}`);
});
