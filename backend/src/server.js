"use client";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Message from "./models/Message.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/galaxy_user")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// Basic test route
app.get("/", (req, res) => {
  res.send("Chat backend running 🚀");
});

// Mock user store
const users = [];

// Your original signup/signin routes unchanged
app.post("/api/auth/signup", async (req, res) => {
  const { email, password, name, role, profilePic } = req.body;
  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ message: "User already exists" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ email, password: hashedPassword, name, role, profilePic });
  const token = jwt.sign({ email, role }, process.env.JWT_SECRET || "secretkey", { expiresIn: "1h" });
  res.json({ token, message: "Signup successful" });
});

app.post("/api/auth/signin", async (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(401).json({ message: "User not found" });
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: "Invalid password" });
  const token = jwt.sign({ email, role: user.role }, process.env.JWT_SECRET || "secretkey", { expiresIn: "1h" });
  res.json({ token, message: "Signin successful" });
});

// --- ADDITIONAL DATA STRUCTURES FOR NEW FEATURES ---

// Track online users: Map email → socket.id
const onlineUsers = new Map();

// Track user contact requests in memory, structure: { email: { sent: Set(), pending: Set(), contacts: Set() } }
const userRequests = new Map();

// Initialize userRequests entry if not exist
function initUserRequests(email) {
  if (!userRequests.has(email)) {
    userRequests.set(email, { sent: new Set(), pending: new Set(), contacts: new Set() });
  }
}

// Helper: notify user by email, if online
function notifyUser(email, event, data) {
  const socketId = onlineUsers.get(email);
  if (socketId) io.to(socketId).emit(event, data);
}

// Socket logic enhanced but your original preserved
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User registration for online tracking
  socket.on("register", (email) => {
    onlineUsers.set(email, socket.id);
    initUserRequests(email);
    io.emit("userStatus", { email, status: "online" }); // broadcast online status globally
  });

  // Your original message send preserved
  socket.on("sendMessage", async (msgData) => {
    console.log("Message:", msgData);
    // Save to DB
    const newMsg = new Message(msgData);
    await newMsg.save();

    // Emit only to sender and receiver (not everyone)
    socket.emit("receiveMessage", newMsg);
    const receiverSocketId = onlineUsers.get(msgData.receiver);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveMessage", newMsg);
    }
  });

  // New event: Send contact request
  socket.on("sendContactRequest", ({ from, to }) => {
    initUserRequests(from);
    initUserRequests(to);

    // Avoid duplicates and if already contacts
    if (userRequests.get(from).contacts.has(to) || userRequests.get(from).sent.has(to)) {
      socket.emit("requestError", { message: "Already sent or contacts" });
      return;
    }

    userRequests.get(from).sent.add(to);
    userRequests.get(to).pending.add(from);

    notifyUser(to, "newContactRequest", { from });
  });

  // Accept contact request
  socket.on("acceptContactRequest", ({ user, from }) => {
    initUserRequests(user);
    initUserRequests(from);

    if (userRequests.get(user).pending.has(from)) {
      userRequests.get(user).pending.delete(from);
      userRequests.get(from).sent.delete(user);

      userRequests.get(user).contacts.add(from);
      userRequests.get(from).contacts.add(user);

      notifyUser(user, "contactRequestAccepted", { from });
      notifyUser(from, "contactRequestAccepted", { user });
    }
  });

  // Reject contact request
  socket.on("rejectContactRequest", ({ user, from }) => {
    initUserRequests(user);
    initUserRequests(from);

    userRequests.get(user).pending.delete(from);
    userRequests.get(from).sent.delete(user);

    notifyUser(user, "contactRequestRejected", { from });
    notifyUser(from, "contactRequestRejected", { user });
  });

  // Handle message read event
  socket.on("messageRead", async ({ messageId, user }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;
      if (!msg.readBy.includes(user)) {
        msg.readBy.push(user);
        await msg.save();
      }

      // Notify sender about read receipt
      notifyUser(msg.sender.toString(), "messageReadReceipt", { messageId, reader: user });
    } catch (error) {
      console.error("Error on messageRead", error);
    }
  });

  // Disconnect handling
  socket.on("disconnect", () => {
    for (const [email, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(email);
        io.emit("userStatus", { email, status: "offline" });
        break;
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
