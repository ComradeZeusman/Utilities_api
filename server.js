// server.js
import express from "express";
import bodyParser from "body-parser";
import connectDB from "./Middleware/database_connection.js";
import cors from "cors";
import router from "./Routes/routes.js";
import sessionManagement from "./Middleware/session.js";
import dotenv from "dotenv";
import passport, { initializePassport } from "./Middleware/passportConfig.js";
import session from "express-session";

// Load environment variables first
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
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use("/uploads", express.static("uploads"));

await connectDB();

await sessionManagement(app);

app.use("/", router);

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
