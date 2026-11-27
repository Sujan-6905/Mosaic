import { io } from "socket.io-client";

const socketUrl = process.env.NEXT_PUBLIC_API_URL;

// Connects only once a caller supplies the auth token every mutating event requires.
export const socket = io(socketUrl, { autoConnect: false });
