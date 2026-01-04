import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("Contact", contactSchema);
