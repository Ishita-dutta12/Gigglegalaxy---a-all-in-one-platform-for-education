import Message from "../models/Message.js";
import mongoose from "mongoose";

const onlineUsers = new Map(); // username -> socket.id

export default function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Register user by username on connect
    socket.on("register", (username) => {
      onlineUsers.set(username, socket.id);
      io.emit("userStatus", { username, status: "online" });
    });

    // Handle chat message socket event
    socket.on("chatMessage", async (msg) => {
      // msg: { sender, receiver, text, fileId, fileType, timestamp }
      try {
        const message = new Message({
          sender: mongoose.Types.ObjectId(msg.sender),
          receiver: mongoose.Types.ObjectId(msg.receiver),
          text: msg.text,
          fileId: msg.fileId,
          fileType: msg.fileType,
          timestamp: new Date(msg.timestamp),
          readBy: [mongoose.Types.ObjectId(msg.sender)],
        });

        const savedMsg = await message.save();

        // Send message to sender and receiver (if online)
        io.to(socket.id).emit("chatMessage", savedMsg);

        const receiverSocketId = onlineUsers.get(msg.receiver);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("chatMessage", savedMsg);
        }
      } catch (error) {
        console.error("Error saving message", error);
      }
    });

    // Mark message read event
    socket.on("messageRead", async ({ messageId, userId }) => {
      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;
        if (!msg.readBy.includes(userId)) {
          msg.readBy.push(userId);
          await msg.save();
        }
      } catch (error) {
        console.error("Error marking message read", error);
      }
    });

    socket.on("disconnect", () => {
      // Remove disconnected user by socket id
      for (const [username, id] of onlineUsers.entries()) {
        if (id === socket.id) {
          onlineUsers.delete(username);
          io.emit("userStatus", { username, status: "offline" });
          break;
        }
      }
    });
  });
}
