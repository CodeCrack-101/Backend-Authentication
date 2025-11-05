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
// App initialization
// ------------------------
dotenv.config();
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "shhhh";
const port = process.env.PORT || 3000;

// ------------------------
// MongoDB connection (Serverless safe)
// ------------------------
let isDBConnected = false;

async function connectDB() {
  if (isDBConnected) return;

  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI missing.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    isDBConnected = true;
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ DB Error: ", err);
  }
}
connectDB();

// ------------------------
// App config
// ------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ------------------------
// Middleware
// ------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ------------------------
// Auth middleware
// ------------------------
const isLogin = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie("token");
    res.redirect("/login");
  }
};

// ------------------------
// Routes (unchanged)
// ------------------------
app.get('/', (req, res) => res.render('login'));
app.get('/login', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('login'));
app.get('/succes', (req, res) => {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, JWT_SECRET);
    res.render('succes', { user: decoded });
  } catch {
    res.clearCookie("token");
    res.redirect("/login");
  }
});

// register
app.post('/register', async (req, res) => {
  const { username, email, password, age } = req.body;
  try {
    if (!username || !email || !password || !age)
      return res.status(400).send("All fields are required");

    const existingUser = await usermodel.findOne({ email });
    if (existingUser) return res.status(400).send("User exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await usermodel.create({ username, email, age, password: hashedPassword });

    const token = jwt.sign({ email: user.email, userid: user._id }, JWT_SECRET, { expiresIn: "1h" });

    res.cookie("token", token, { httpOnly: true });
    res.redirect('/succes');
  } catch {
    res.status(500).send("Server error");
  }
});

// login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await usermodel.findOne({ email });
    if (!user) return res.status(400).send("Invalid login");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send("Invalid login");

    const token = jwt.sign({ email: user.email, userid: user._id }, JWT_SECRET, { expiresIn: "1h" });
    res.cookie("token", token, { httpOnly: true });
    res.redirect('/profile');
  } catch {
    res.status(500).send("Server error");
  }
});

// profile
app.get('/profile', isLogin, async (req, res) => {
  const user = await usermodel.findOne({ email: req.user.email }).populate("posts");
  res.render('profile', { user });
});

// post create, edit, delete unchanged...

app.get('/logout', (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// 404
app.use((req, res) => res.status(404).send("404 - Page not found"));

// ------------------------
// Export app (Do NOT listen here)
// ------------------------
module.exports = app;

// Local dev only
if (require.main === module) {
  app.listen(port, () => console.log(`🚀 Running http://localhost:${port}`));
}
