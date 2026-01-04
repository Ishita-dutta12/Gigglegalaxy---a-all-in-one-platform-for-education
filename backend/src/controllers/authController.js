import User from "../models/User.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/generateToken.js";

export const signup = async (req, res) => {
  try {
    const { role, name, email, password, profilePic } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    if (role === "ghost") {
      // ghost user: only email required
      const user = await User.create({
        role: "ghost",
        name: "Ghost User",
        email,
        profilePic: profilePic || "",
      });
      const token = generateToken({ id: user._id, role: user.role });
      return res.status(201).json({ message: "Ghost signup successful", token, user });
    }

    // regular user: require password
    if (!password) return res.status(400).json({ message: "Password required for regular signup" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      role: "regular",
      name: name || "",
      email,
      password: hashed,
      profilePic: profilePic || "",
    });

    const token = generateToken({ id: user._id, role: user.role });
    res.status(201).json({ message: "Signup successful", token, user });
  } catch (err) {
    console.error("signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const signin = async (req, res) => {
  try {
    const { role, email, password } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (role === "ghost") {
      // allow ghost sign-in if user exists and is ghost or treat existing regular as allowed
      const token = generateToken({ id: user._id, role: user.role });
      return res.status(200).json({ message: "Ghost sign-in successful", token, user });
    }

    // regular signin: check password
    if (!password) return res.status(400).json({ message: "Password required" });
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    const token = generateToken({ id: user._id, role: user.role });
    res.status(200).json({ message: "Signin successful", token, user });
  } catch (err) {
    console.error("signin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const me = async (req, res) => {
  // req.user should be set by auth middleware
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Not authorized" });
  res.json({ user });
};
