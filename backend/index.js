import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import socketLogic from "./socket.js";
config();

import { connectToDB } from "./db.js";

import authRoutes from "./routes/authRoutes.js";
import drawingRoutes from "./routes/drawingRoutes.js";

const app = express();
connectToDB();

app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

socketLogic(io);

app.get("/", (req, res) => {
  return res.send("Hello world");
});

app.use("/api/auth", authRoutes);
app.use("/api/drawing", drawingRoutes);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
});
