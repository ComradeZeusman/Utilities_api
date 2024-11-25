import multer from "multer";
import path from "path";
import fs from "fs";

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const dirs = ["uploads/videos", "uploads/images", "uploads/documents"];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadDirs();

// File type configurations
const fileTypes = {
  video: {
    mimeTypes: [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-ms-wmv",
      "video/x-flv",
      "video/x-matroska",
    ],
    maxSize: 300 * 1024 * 1024, // 300MB
    destination: "uploads/videos",
  },
  image: {
    mimeTypes: ["image/jpeg", "image/jpg", "image/png"],
    maxSize: 5 * 1024 * 1024, // 5MB
    destination: "uploads/images",
  },
  document: {
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    destination: "uploads/documents",
  },
};

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine destination based on file type
    let uploadDir = "uploads";

    Object.entries(fileTypes).forEach(([type, config]) => {
      if (config.mimeTypes.includes(file.mimetype)) {
        uploadDir = config.destination;
      }
    });

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Sanitize filename and add timestamp
    const fileName = `${Date.now()}_${path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9-_.]/g, "_")}`;
    cb(null, fileName);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Get all allowed mime types
  const allowedTypes = Object.values(fileTypes).flatMap(
    (config) => config.mimeTypes
  );

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  }
};

// Create multer instance with configurations
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: Math.max(
      ...Object.values(fileTypes).map((config) => config.maxSize)
    ),
    files: 10,
  },
});

// Specific upload middlewares
const uploadConfigs = {
  // For split screen feature
  splitScreen: upload.array("videos", 4),

  // For watermark feature
  watermark: upload.single("video"),

  // For multiple file types
  mixed: upload.fields([
    { name: "videos", maxCount: 4 },
    { name: "images", maxCount: 5 },
    { name: "documents", maxCount: 3 },
  ]),

  // For specific file types
  videos: upload.array("videos", 4),
  images: upload.array("images", 5),
  documents: upload.array("documents", 3),
};

// Error handler middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        details: `Maximum file size is ${Math.floor(
          err.field === "videos" ? 300 : 10
        )} MB`,
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Too many files",
        details: "Maximum number of files exceeded",
      });
    }
  }
  next(err);
};

export { upload, uploadConfigs, handleUploadError };
