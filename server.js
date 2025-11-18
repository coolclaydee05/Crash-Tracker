const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb+srv://coolclayde05_db_user:xdqtA83wwQkzLrLL@cluster0.bgbymf2.mongodb.net/?appName=Cluster0";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// Define Schemas
const trackerSchema = new mongoose.Schema({
  deviceId: String,
  lat: Number,
  lng: Number,
  gforce: Number,
  gyro: Number,
  timestamp: String,
  status: String,
  crash: Boolean
});

const crashSchema = new mongoose.Schema({
  deviceId: String,
  lat: Number,
  lng: Number,
  gforce: Number,
  gyro: Number,
  timestamp: String
});

const deviceSchema = new mongoose.Schema({
  userEmail: String,
  devices: [{ id: String, name: String }]
});

const thresholdSchema = new mongoose.Schema({
  value: { type: Number, default: 5 }
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true }
});

// Models
const Tracker = mongoose.model("Tracker", trackerSchema);
const Crash = mongoose.model("Crash", crashSchema);
const Device = mongoose.model("Device", deviceSchema);
const Threshold = mongoose.model("Threshold", thresholdSchema);
const User = mongoose.model("User", userSchema);

// Initialize default threshold if not exists
Threshold.findOne().then(threshold => {
  if (!threshold) {
    new Threshold().save();
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid token" });
  }
};

// Auth endpoints
app.post("/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password required" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ _id: user._id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ _id: user._id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Fallback files for local testing (remove in production)
const TRACKER_FILE = path.join(__dirname, "tracker.json");
const DEVICES_FILE = path.join(__dirname, "devices.json");
const CRASHES_FILE = path.join(__dirname, "crashes.json");

app.post("/tracker/update", async (req, res) => {
  const { lat, lng, gforce, gyro, deviceId } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number" || typeof gforce !== "number" || typeof gyro !== "number" || !deviceId || typeof deviceId !== "string") {
    return res.status(400).json({ error: "invalid payload: lat, lng, gforce, gyro must be numbers, deviceId must be string" });
  }
  const threshold = await Threshold.findOne();
  const thresholdValue = threshold ? threshold.value : 5;
  const crash = (gforce || 0) > thresholdValue;
  const data = {
    deviceId,
    lat, lng, gforce: gforce || 0, gyro: gyro || 0,
    timestamp: new Date().toISOString(),
    status: "ONLINE",
    crash
  };
  await Tracker.findOneAndUpdate({ deviceId }, data, { upsert: true });

  // Store crash history if crash detected
  if (crash) {
    const crashData = {
      deviceId,
      lat, lng, gforce, gyro,
      timestamp: new Date().toISOString()
    };
    await new Crash(crashData).save();
  }

  res.json({ ok: true });
});

app.get("/tracker/latest", async (req, res) => {
  const { deviceId } = req.query;
  if (deviceId) {
    const data = await Tracker.findOne({ deviceId });
    if (!data) return res.status(404).json({ error: "Device not found" });
    // Determine status based on last update time (online if within last 30 seconds and not in future)
    const lastUpdate = new Date(data.timestamp);
    const now = new Date();
    const timeDiff = (now - lastUpdate) / 1000; // seconds
    data.status = timeDiff <= 30 && timeDiff >= 0 ? "ONLINE" : "OFFLINE";
    res.json(data);
  } else {
    // For all devices, update status dynamically
    const trackers = await Tracker.find({});
    const updatedData = {};
    trackers.forEach(data => {
      const lastUpdate = new Date(data.timestamp);
      const now = new Date();
      const timeDiff = (now - lastUpdate) / 1000; // seconds
      data.status = timeDiff <= 30 && timeDiff >= 0 ? "ONLINE" : "OFFLINE";
      updatedData[data.deviceId] = data;
    });
    res.json(updatedData);
  }
});

app.post("/devices/register", verifyToken, async (req, res) => {
  const { deviceId, deviceName } = req.body;
  if (!deviceId || !deviceName) {
    return res.status(400).json({ error: "Device ID and name required" });
  }
  const userEmail = req.user.email;
  let deviceDoc = await Device.findOne({ userEmail });
  if (!deviceDoc) {
    deviceDoc = new Device({ userEmail, devices: [] });
  }
  if (deviceDoc.devices.find(d => d.id === deviceId)) {
    return res.status(400).json({ error: "Device ID already exists" });
  }
  deviceDoc.devices.push({ id: deviceId, name: deviceName });
  await deviceDoc.save();
  res.json({ ok: true });
});

app.get("/devices", verifyToken, async (req, res) => {
  const userEmail = req.user.email;
  const deviceDoc = await Device.findOne({ userEmail });
  res.json(deviceDoc ? deviceDoc.devices : []);
});

app.get("/tracker/history", async (req, res) => {
  const { deviceId } = req.query;
  if (!deviceId) return res.status(400).json({ error: "Device ID required" });
  const crashes = await Crash.find({ deviceId }).sort({ timestamp: -1 });
  res.json(crashes);
});

// New endpoints for threshold management
app.get("/threshold", async (req, res) => {
  const threshold = await Threshold.findOne();
  res.json({ value: threshold ? threshold.value : 5 });
});

app.post("/threshold", async (req, res) => {
  const { value } = req.body;
  if (typeof value !== "number" || value <= 0) {
    return res.status(400).json({ error: "Invalid threshold value" });
  }
  await Threshold.findOneAndUpdate({}, { value }, { upsert: true });
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
