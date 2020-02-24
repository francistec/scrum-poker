const uuid = require('uuid/v4');

// Initial state
const rooms = {};

const getRoomResponse = (room) => ({
  ...room,
  guests: room.guests.map(({ socket, ...guestData }) => guestData),
});

/**
 * Clear all guests votes in a room
 * @param {Object} socket connection
 * @param {String} roomId id of the room
 */
const clearVotes = (socket, roomId) => {
  const room = rooms[roomId];
  if (!room) {
    socket.emit('unexistingRoom');
  } else {
    const { vote, ...hostData } = room.host;
    room.host = hostData;
    room.guests = room.guests.map(({ vote, ...guestData }) => guestData);
    socket.emit('votesCleared', getRoomResponse(room));
  }
}

/**
 * Used by guests to vote
 * @param {Object} io connection
 * @param {Object} socket connection
 * @param {String} roomId id of the room
 * @param {String} value voted value
 */
const vote = (io, socket, { roomId, value }) => {
  const room = rooms[roomId];
  if (!room) {
    socket.emit('unexistingRoom');
  } else {
    if (socket.id === room.host.id) {
      room.host.vote = value;
    } else {
      const guest = room.guests.find(({ id }) => id === socket.id);
      guest.vote = value;
    }
    // socket.broadcast.to(roomId).emit('voted', getRoomResponse(room));
    io.sockets.emit('voted', getRoomResponse(room));
  }
}

/**
 * Kick the guest out of all the rooms where is in
 * @param {Object} socket connection
 */
const leaveRooms = (socket) => {
  const emptyRoomIds = [];

  for (const [roomId, { guests }] of Object.entries(rooms)) {
    const guestInRoom = guests.find(({ id }) => id === socket.id);
    if (guestInRoom) {
      socket.leave(roomId);
      const room = rooms[roomId];
      room.guests = room.guests.filter(({ id }) => id !== socket.id);
      socket.broadcast.to(roomId).emit('guestLeft', getRoomResponse(room));

      if (![room.host, room.guests].length) {
        emptyRoomIds.push(roomId);
      }
    }

    for (const emptyRoomId of emptyRoomIds) {
      delete rooms[emptyRoomId];
    }
  }
};

/**
 *
 * @param {Object} socket connection object
 * @param {String} roomName name of the room
 * @param {Function} callback function
 */
const joinRoom = (socket, { roomId, guestName }, callback) => {
  const room = rooms[roomId];
  if (!room) {
    socket.emit('unexistingRoom');
  } else {
    socket.join(roomId, () => {
      if (socket.id !== room.host.id) {
        room.guests.push({
          id: socket.id,
          name: guestName,
          socket,
        });
      }
      socket.broadcast.to(roomId).emit('guestJoined', getRoomResponse(room));
      if (callback) callback(getRoomResponse(room));
    });
  }
};

/**
 *
 * @param {Object} socket connection object
 * @param {String} roomName name of the room
 * @param {Function} callback function
 */
const createRoom = (socket, { hostName, roomName }, callback) => {
  const room = {
    id: uuid(),
    name: roomName,
    host: {
      id: socket.id,
      name: hostName,
    },
    guests: [],
  };
  rooms[room.id] = room;
  joinRoom(socket, { roomId: room.id, guestName: hostName }, callback);
};

/**
 * Manages socket connections
 * @param {Object} io socket io app
 */
module.exports = (io) => {
  io.on('connect', (socket) => {
    socket.on('createRoom', (params, callback) => createRoom(socket, params, callback));
    socket.on('joinRoom', (params, callback) => joinRoom(socket, params, callback));
    socket.on('leaveRoom', () => leaveRooms(socket));
    socket.on('vote', (params) => vote(io, socket, params));
    socket.on('clearVotes', (roomId) => clearVotes(socket, roomId));
    socket.on('disconnect', () => leaveRooms(socket));
  });
};