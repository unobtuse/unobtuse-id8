import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

let socket = null;

// Use the same base URL as the API (without /api path)
const SOCKET_URL = "https://id8.unobtuse.com";

export const connectSocket = async () => {
  if (socket?.connected) {
    return socket;
  }

  const token = await AsyncStorage.getItem("token");
  if (!token) {
    console.log("[Socket] No token, skipping connection");
    return null;
  }

  console.log("[Socket] Connecting to", SOCKET_URL);

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected");
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.log("[Socket] Connection error:", error.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const joinIdea = (ideaId) => {
  if (socket?.connected) {
    socket.emit("join:idea", ideaId);
  }
};

export const leaveIdea = (ideaId) => {
  if (socket?.connected) {
    socket.emit("leave:idea", ideaId);
  }
};

export const onSocketEvent = (event, callback) => {
  if (!socket) return () => {};

  socket.on(event, callback);

  // Return unsubscribe function
  return () => {
    socket?.off(event, callback);
  };
};

export const offSocketEvent = (event, callback) => {
  if (socket) {
    socket.off(event, callback);
  }
};
