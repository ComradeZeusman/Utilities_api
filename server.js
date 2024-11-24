import express from "express";
import bodyParser from "body-parser";
import connectDB from "./Middleware/database_connection.js";
import cors from "cors";
import router from "./Routes/routes.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use("/uploads", express.static("uploads"));

await connectDB();

app.use("/", router);

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
