import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDB } from './config/db.js';
import { initMeetingSocket } from './modules/meeting/meeting.socket.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await connectDB(process.env.MONGODB_URI);

    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      },
      pingTimeout: 60000,
    });

    initMeetingSocket(io);

    server.listen(PORT, () => {
      console.log(`API and WebRTC Signaling listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
