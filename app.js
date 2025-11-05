// ------------------------
// Imports
// ------------------------
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const usermodel = require('./models/user');
const postmodel = require('./models/post');

// ------------------------
// Initialize
// ------------------------
dotenv.config();
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "shhhh";
const PORT = process.env.PORT || 3000;

// ------------------------
// MongoDB Connection (Render & Atlas Safe)
// ------------------------
let isDBConnected = false;

async function connectDB() {
  if (isDBConnected) return;
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI missing in Render ENV");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
    });

    isDBConnected = true;
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.log("⏳ Retrying in 5 seconds...");
    setTimeout(connectDB, 5000);
  }
}
connectDB();

// ------------------------
// Express & Views Config
// ------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ------------------------
// JWT Middleware
// ------------------------
const isLogin = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.clearCookie("token");
    res.redirect("/login");
  }
};

// ------------------------
// Routes
// ------------------------

// Health check route for Render
app.get("/health", (req, res) => res.send("✅ Server is healthy"));

// Default
app.get("/", (req, res) => res.render("login"));
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("login"));

// Register
app.post("/register", async (req, res) => {
  const { username, email, password, age } = req.body;

  if (!username || !email || !password || !age)
    return res.status(400).send("All fields are required");

  const existingUser = await usermodel.findOne({ email });
  if (existingUser) return res.status(400).send("User already exists");

  const hash = await bcrypt.hash(password, 10);
  const user = await usermodel.create({ username, email, age, password: hash });

  const token = jwt.sign({ email: user.email, userid: user._id }, JWT_SECRET);
  res.cookie("token", token, { httpOnly: true });
  res.redirect("/succes");
});

// Success Page
app.get("/succes", (req, res) => {
  try {
    const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
    res.render("succes", { user: decoded });
  } catch {
    res.clearCookie("token");
    res.redirect("/login");
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await usermodel.findOne({ email });
  if (!user) return res.status(400).send("Invalid credentials");

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).send("Invalid credentials");

  const token = jwt.sign({ email: user.email, userid: user._id }, JWT_SECRET);
  res.cookie("token", token, { httpOnly: true });
  res.redirect("/profile");
});

// Profile
app.get("/profile", isLogin, async (req, res) => {
  const user = await usermodel.findOne({ email: req.user.email }).populate("posts");
  res.render("profile", { user });
});

// Logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// 404 Page
app.use((req, res) => res.status(404).send("404 - Page Not Found"));

// ------------------------
// Server Listen for Render
// ------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
