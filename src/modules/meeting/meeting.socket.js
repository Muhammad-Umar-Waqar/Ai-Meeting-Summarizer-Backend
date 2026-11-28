import Meeting from '../../models/meeting.model.js';

// In-memory room state: Map<meetingCode, RoomData>
const rooms = new Map();

function getOrCreateRoom(code) {
  const cleanCode = code.toLowerCase().trim();
  if (!rooms.has(cleanCode)) {
    rooms.set(cleanCode, {
      code: cleanCode,
      hostSocketId: null,
      hostUserId: null,
      participants: new Map(), // socketId -> participant info
      waitingQueue: new Map(), // socketId -> waiting user info
      handRaiseQueue: [], // ordered list of socketIds
    });
  }
  return rooms.get(cleanCode);
}

export function initMeetingSocket(io) {
  io.on('connection', (socket) => {
    let currentMeetingCode = null;

    // --- Join Meeting / Knock Workflow ---
    socket.on('room:join', async (payload) => {
      try {
        const {
          meetingCode,
          displayName,
          userId,
          isHost = false,
          micOn = true,
          camOn = true,
          color = '#1a73e8',
        } = payload;

        if (!meetingCode) {
          return socket.emit('room:error', { message: 'Meeting code is required' });
        }

        const cleanCode = meetingCode.toLowerCase().trim();
        const meetingDoc = await Meeting.findOne({ code: cleanCode });

        if (!meetingDoc) {
          return socket.emit('room:error', { message: 'Meeting not found' });
        }

        if (meetingDoc.settings?.isLocked && !isHost) {
          return socket.emit('room:error', {
            message: 'This meeting is currently locked by the host.',
          });
        }

        const room = getOrCreateRoom(cleanCode);

        // If user claims host or matches DB host
        const isActualHost =
          isHost ||
          (userId && meetingDoc.host && meetingDoc.host.toString() === userId.toString());

        if (isActualHost) {
          room.hostSocketId = socket.id;
          room.hostUserId = userId;
        }

        // Waiting room gate check (if enabled and user is not host)
        if (meetingDoc.settings?.waitingRoomEnabled && !isActualHost) {
          room.waitingQueue.set(socket.id, {
            socketId: socket.id,
            userId,
            displayName: displayName || 'Guest',
            color,
            joinedQueueAt: Date.now(),
          });

          socket.emit('waiting:status', {
            status: 'waiting',
            message: 'Waiting for the host to admit you to the meeting…',
          });

          // Notify host if present
          if (room.hostSocketId) {
            io.to(room.hostSocketId).emit('host:knock-request', {
              socketId: socket.id,
              userId,
              displayName: displayName || 'Guest',
            });
          }
          return;
        }

        // Direct admission
        admitParticipantToRoom(socket, room, {
          userId,
          displayName: displayName || (isActualHost ? meetingDoc.hostName : 'Participant'),
          isHost: isActualHost,
          micOn,
          camOn,
          color,
        });

        currentMeetingCode = cleanCode;
      } catch (err) {
        socket.emit('room:error', { message: err.message });
      }
    });

    // --- Host Admits Waiting User ---
    socket.on('host:admit', ({ meetingCode, targetSocketId }) => {
      const room = rooms.get(meetingCode?.toLowerCase().trim());
      if (!room || room.hostSocketId !== socket.id) return;

      const waitingUser = room.waitingQueue.get(targetSocketId);
      if (waitingUser) {
        room.waitingQueue.delete(targetSocketId);
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('waiting:status', { status: 'admitted' });
          admitParticipantToRoom(targetSocket, room, {
            ...waitingUser,
            isHost: false,
            micOn: true,
            camOn: true,
          });
        }
      }
    });

    // --- Host Denies Waiting User ---
    socket.on('host:deny', ({ meetingCode, targetSocketId }) => {
      const room = rooms.get(meetingCode?.toLowerCase().trim());
      if (!room || room.hostSocketId !== socket.id) return;

      if (room.waitingQueue.has(targetSocketId)) {
        room.waitingQueue.delete(targetSocketId);
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('waiting:status', {
            status: 'denied',
            message: 'The meeting host declined your request to join.',
          });
          targetSocket.disconnect(true);
        }
      }
    });

    // --- WebRTC Signaling Relay ---
    socket.on('webrtc:offer', ({ targetSocketId, offer, callerInfo }) => {
      io.to(targetSocketId).emit('webrtc:offer', {
        offer,
        callerSocketId: socket.id,
        callerInfo,
      });
    });

    socket.on('webrtc:answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('webrtc:answer', {
        answer,
        responderSocketId: socket.id,
      });
    });

    socket.on('webrtc:ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc:ice-candidate', {
        candidate,
        senderSocketId: socket.id,
      });
    });

    // --- In-Call Media Track State Change ---
    socket.on('media:toggle', ({ meetingCode, micOn, camOn, screenSharing }) => {
      const code = meetingCode || currentMeetingCode;
      const room = rooms.get(code?.toLowerCase().trim());
      if (!room) return;

      const p = room.participants.get(socket.id);
      if (p) {
        if (typeof micOn === 'boolean') p.micOn = micOn;
        if (typeof camOn === 'boolean') p.camOn = camOn;
        if (typeof screenSharing === 'boolean') p.screenSharing = screenSharing;

        socket.to(room.code).emit('peer:media-changed', {
          socketId: socket.id,
          micOn: p.micOn,
          camOn: p.camOn,
          screenSharing: p.screenSharing,
        });
      }
    });

    // --- In-Call Chat ---
    socket.on('chat:message', ({ meetingCode, text, isPrivate = false, targetSocketId = null }) => {
      const code = meetingCode || currentMeetingCode;
      const room = rooms.get(code?.toLowerCase().trim());
      if (!room) return;

      const p = room.participants.get(socket.id);
      const senderName = p ? p.displayName : 'Participant';

      const messagePayload = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        senderSocketId: socket.id,
        senderName,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isPrivate: Boolean(isPrivate),
      };

      if (isPrivate && targetSocketId) {
        messagePayload.targetSocketId = targetSocketId;
        io.to(targetSocketId).emit('chat:message', messagePayload);
        socket.emit('chat:message', messagePayload);
      } else {
        io.to(room.code).emit('chat:message', messagePayload);
      }
    });

    // --- Floating Reactions ---
    socket.on('reaction:send', ({ meetingCode, emoji }) => {
      const code = meetingCode || currentMeetingCode;
      const room = rooms.get(code?.toLowerCase().trim());
      if (!room) return;

      const p = room.participants.get(socket.id);
      io.to(room.code).emit('reaction:received', {
        emoji,
        senderName: p ? p.displayName : 'Participant',
        socketId: socket.id,
      });
    });

    // --- Hand Raise Queue ---
    socket.on('hand:toggle', ({ meetingCode, handRaised }) => {
      const code = meetingCode || currentMeetingCode;
      const room = rooms.get(code?.toLowerCase().trim());
      if (!room) return;

      const p = room.participants.get(socket.id);
      if (p) {
        p.handRaised = Boolean(handRaised);

        if (p.handRaised) {
          if (!room.handRaiseQueue.includes(socket.id)) {
            room.handRaiseQueue.push(socket.id);
          }
        } else {
          room.handRaiseQueue = room.handRaiseQueue.filter((id) => id !== socket.id);
        }

        io.to(room.code).emit('hand:updated', {
          socketId: socket.id,
          handRaised: p.handRaised,
          handRaiseQueue: room.handRaiseQueue,
        });
      }
    });

    // --- Host Moderation Controls ---
    socket.on('host:mute-all', ({ meetingCode }) => {
      const code = meetingCode || currentMeetingCode;
      const room = rooms.get(code?.toLowerCase().trim());
      if (!room || room.hostSocketId !== socket.id) return;

      // Broadcast mute command to everyone except host
      socket.to(room.code).emit('host:command-mute-all');
    });

    socket.on('host:kick', ({ meetingCode, targetSocketId }) => {
      const code = meetingCode || currentMeetingCode;
      const room = rooms.get(code?.toLowerCase().trim());
      if (!room || room.hostSocketId !== socket.id) return;

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit('host:command-kicked', {
          message: 'You have been removed from the meeting by the host.',
        });
        targetSocket.disconnect(true);
      }
    });

    // --- Disconnect & Cleanup ---
    socket.on('disconnect', () => {
      for (const [code, room] of rooms.entries()) {
        if (room.waitingQueue.has(socket.id)) {
          room.waitingQueue.delete(socket.id);
        }

        if (room.participants.has(socket.id)) {
          const leaving = room.participants.get(socket.id);
          room.participants.delete(socket.id);
          room.handRaiseQueue = room.handRaiseQueue.filter((id) => id !== socket.id);

          socket.to(code).emit('peer:left', {
            socketId: socket.id,
            displayName: leaving?.displayName,
          });

          // If room becomes completely empty, clear it after 10 mins
          if (room.participants.size === 0) {
            setTimeout(() => {
              const active = rooms.get(code);
              if (active && active.participants.size === 0) {
                rooms.delete(code);
              }
            }, 600000);
          }
        }
      }
    });
  });
}

function admitParticipantToRoom(socket, room, participantInfo) {
  socket.join(room.code);

  const participantData = {
    socketId: socket.id,
    userId: participantInfo.userId || null,
    displayName: participantInfo.displayName || 'Participant',
    isHost: Boolean(participantInfo.isHost),
    micOn: participantInfo.micOn !== false,
    camOn: participantInfo.camOn !== false,
    screenSharing: false,
    handRaised: false,
    color: participantInfo.color || '#1a73e8',
  };

  room.participants.set(socket.id, participantData);

  // 1. Send all existing peers in room to the newly joined socket
  const existingPeers = [];
  for (const [sId, p] of room.participants.entries()) {
    if (sId !== socket.id) {
      existingPeers.push(p);
    }
  }

  socket.emit('room:joined', {
    self: participantData,
    peers: existingPeers,
    code: room.code,
  });

  // 2. Broadcast new peer to all existing peers in the room
  socket.to(room.code).emit('peer:joined', participantData);
}
