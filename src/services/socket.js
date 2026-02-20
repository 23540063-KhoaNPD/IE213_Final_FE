import { io } from "socket.io-client";

export const createSocket = () => {
  return io(import.meta.env.VITE_BK_URL, {
    auth: {
      token: localStorage.getItem("token")
    }
  });
};