import { count } from "console";
import mongoose from "mongoose";
import { freemem } from "os";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  api_key: {
    type: String,
    required: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  expires_at: {
    type: Date,
    required: false,
  },
  request_count: {
    type: Number,
    required: false,
  },
  request_limit: {
    type: Number,
    required: false,
  },
  request_limit_reset: {
    type: Date,
    required: false,
  },
  request_limit_reset_interval: {
    type: Number,
    required: false,
  },
  request_limit_interval: {
    type: Number,
    required: false,
  },
  free_trial: {
    type: Boolean,
    required: false,
  },
  paid_amount: {
    type: Number,
    required: false,
  },
});

const User = mongoose.model("User", userSchema);

export default User;
