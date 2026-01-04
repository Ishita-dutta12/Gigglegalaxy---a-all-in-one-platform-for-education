import express from "express";
import Message from "../models/Message.js";
import User from "../models/user.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../config/gridfs.js";
import mongoose from "mongoose";

const router = express.Router();

// Send message with optional file upload
router.post("/send", protect, upload.single("file"), async (req, res) => {
  const { receiverId, text, groupId } = req.body;
  try {
    const newMsg = new Message({
      sender: req.user._id,
      receiver: receiverId || null,
      groupId: groupId || null,
      text,
      fileId: req.file ? req.file.id : null,
      fileType: req.file ? req.file.mimetype : null,
      timestamp: new Date(),
      readBy: [req.user._id], // mark sender as having read
    });
    await newMsg.save();
    res.json(newMsg);
  } catch (error) {
    res.status(500).json({ message: "Message send failed", error });
  }
});

// Fetch chat history 1-to-1 or groups
router.get("/:id", protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.id },
        { sender: req.params.id, receiver: req.user._id },
      ],
    }).populate("sender receiver", "username");
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching chat", error });
  }
});

// Mark message as read by current user
router.post("/read/:messageId", protect, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });

    if (!msg.readBy.includes(req.user._id)) {
      msg.readBy.push(req.user._id);
      await msg.save();
    }
    res.json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Could not update read status", error });
  }
});

export default router;
