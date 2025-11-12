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
// Initialization
// ------------------------
dotenv.config();
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "shhhh";
const PORT = process.env.PORT || 3000;

// ------------------------
// MongoDB Connection
// ------------------------
let isDBConnected = false;
async function connectDB() {
  if (isDBConnected) return;
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI missing in .env");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    isDBConnected = true;
    console.log("MongoDB Connected Successfully");
  } catch (err) {
    console.error("MongoDB Error:", err.message);
    setTimeout(connectDB, 5000);
  }
}
connectDB();

// ------------------------
// Middleware & Config
// ------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname ,'public')))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ------------------------
// JWT Auth Middleware
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



// Auth Pages
app.get("/", (req, res) => res.render("login"));
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("login"));

app.post("/register", async (req, res) => {
  try {
    console.log("Received body:", req.body); // debug line

    const { username, age, email, password } = req.body;

    if (!username || !age || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const existingUser = await usermodel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new usermodel({ username, age, email, password: hashedPassword });

    await newUser.save();
    return res.redirect("/succes");

  } catch (error) {
    console.error("Error during registration:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
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
  res.redirect("/dash");
});

// Dashboard (view)
app.get('/dash', isLogin, async (req, res) => {
  try {
    const user = await usermodel.findOne({ email: req.user.email }).populate('posts');
    if (!user) return res.status(404).send("User not found");
    res.render('dash', { user });
  } catch (err) {
    console.error("dash error:", err);
    res.status(500).send("Internal server error");
  }
});

// Create Note
app.post('/dash', isLogin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content.trim()) return res.status(400).send("Content required");

    const user = await usermodel.findOne({ email: req.user.email });
    if (!user) return res.status(404).send("User not found");

    const post = await postmodel.create({ content, user: user._id });
    user.posts.push(post._id);
    await user.save();

    res.redirect('/dash');
  } catch (err) {
    console.error("Post creation error:", err);
    res.status(500).send("Failed to create post");
  }
});

// Edit Note
app.post('/edit/:id', isLogin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content.trim()) return res.status(400).send("Content required");

    await postmodel.findByIdAndUpdate(req.params.id, { content });
    res.redirect('/dash');
  } catch (err) {
    console.error("Edit error:", err);
    res.status(500).send("Failed to edit post");
  }
});

// Delete Note
app.post('/delete/:id', isLogin, async (req, res) => {
  try {
    const postId = req.params.id;
    const user = await usermodel.findOne({ email: req.user.email });
    if (!user) return res.status(404).send("User not found");

    user.posts = user.posts.filter(p => p.toString() !== postId);
    await user.save();

    await postmodel.findByIdAndDelete(postId);
    res.redirect('/dash');
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send("Failed to delete post");
  }
});

// Logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// 404
app.use((req, res) => res.status(404).send("404 - Page Not Found"));

// ------------------------
// Server Listen
// ------------------------
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
