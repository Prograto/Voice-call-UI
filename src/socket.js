import { io } from "socket.io-client";

const socket = io("https://voicecallservice.onrender.com", {
  transports: ["websocket"], // enforce WebSocket
});

export default socket;
