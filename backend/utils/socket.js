// Place this file at: utils/socket.js
let ioInstance = null;

function init(io) {
  ioInstance = io;
}

function getIO() {
  if (!ioInstance) throw new Error("Socket.io not initialized yet");
  return ioInstance;
}

module.exports = { init, getIO };
