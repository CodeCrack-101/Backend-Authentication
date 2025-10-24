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
const serverless = require('serverless-http');
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
// MongoDB connection
// ------------------------
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env file!");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

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
// Routes
// ------------------------

// Pages
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

// Register
app.post('/register', async (req, res) => {
  const { username, email, password, age } = req.body;
  try {
    if (!username || !email || !password || !age)
      return res.status(400).send("All fields are required!");

    const existingUser = await usermodel.findOne({ email });
    if (existingUser) return res.status(400).send("User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await usermodel.create({ username, email, age, password: hashedPassword });

    const token = jwt.sign(
      { email: user.email, userid: user._id, username: user.username, age: user.age },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie("token", token, { httpOnly: true });
    res.redirect('/succes');
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await usermodel.findOne({ email });
    if (!user) return res.status(400).send("Invalid email or password");

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send("Invalid email or password");

    const token = jwt.sign({ email: user.email, userid: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie("token", token, { httpOnly: true });
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

// Profile
app.get('/profile', isLogin, async (req, res) => {
  try {
    const user = await usermodel.findOne({ email: req.user.email }).populate('posts');
    if (!user) return res.status(404).send("User not found");
    res.render('profile', { user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});

// Create post
app.post('/dash', isLogin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim() === '') return res.status(400).send("Post content cannot be empty");

    const user = await usermodel.findById(req.user.userid);
    if (!user) return res.status(404).send("User not found");

    const post = await postmodel.create({ content, user: user._id });
    user.posts.push(post._id);
    await user.save();

    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to create post");
  }
});

// Delete post
app.post('/delete/:id', isLogin, async (req, res) => {
  try {
    const post = await postmodel.findById(req.params.id);
    if (!post) return res.status(404).send("Post not found");

    await postmodel.findByIdAndDelete(req.params.id);
    await usermodel.findByIdAndUpdate(post.user, { $pull: { posts: req.params.id } });

    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to delete post");
  }
});

// Edit post
app.post('/edit/:id', isLogin, async (req, res) => {
  try {
    const post = await postmodel.findById(req.params.id);
    if (!post) return res.status(404).send("Post not found");
    if (post.user.toString() !== req.user.userid) return res.status(403).send("Unauthorized");

    post.content = req.body.content;
    await post.save();
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to edit post");
  }
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// 404
app.use((req, res) => res.status(404).send("404 - Page not found"));

// ------------------------
// Local server
// ------------------------
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => console.log(`🚀 Server running locally at http://localhost:${port}`));
}

// ------------------------
// Vercel serverless export
// ------------------------
module.exports.handler = serverless(app);
