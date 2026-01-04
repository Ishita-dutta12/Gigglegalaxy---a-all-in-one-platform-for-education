import { GridFsStorage } from "multer-gridfs-storage";
import multer from "multer";

const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/galaxy_user";

export const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => ({
    filename: `${Date.now()}-${file.originalname}`,
    bucketName: "uploads",
  }),
});

export const upload = multer({ storage });
