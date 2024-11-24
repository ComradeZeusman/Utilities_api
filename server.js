import express from "express";
import bodyParser from "body-parser";
import connectDB from "./Middleware/database_connection.js";
import cors from "cors";
import router from "./Routes/routes.js";
import sessionManagement from "./Middleware/session.js";
import dotenv from "dotenv";
import passport from "./Middleware/passportConfig.js";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["JWT_SECRET", "SESSION_SECRET", "MONGODB_URI"];
const missingEnvVars = requiredEnvVars.filter((env) => !process.env[env]);

if (missingEnvVars.length) {
  console.error(
    "Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  process.exit(1);
}

const app = express();

// Basic middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use("/uploads", express.static("uploads"));

// Database and session setup
await connectDB();
await sessionManagement(app);

// Routes
app.use("/", router);

// Logout route
app.get("/logout", (req, res) => {
  try {
    res.clearCookie("jwt");
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.redirect("/");
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Failed to logout" });
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
