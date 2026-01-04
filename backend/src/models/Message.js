import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  text: { type: String },
  fileId: { type: mongoose.Schema.Types.ObjectId }, // GridFS file id
  fileType: { type: String }, // Mime type for file
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // users who read this message
});

export default mongoose.model("Message", messageSchema);
