import crypto from "crypto";

//generate a random key
const API_KEY = crypto.randomBytes(16).toString("hex");

export default API_KEY;
