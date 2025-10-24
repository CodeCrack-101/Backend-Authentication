const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const usermodel = require('./models/user');
const postmodel = require('./models/post');
const app = express();
const port = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "shhhh";

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/i-NoteBook', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB connected');
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Set EJS as view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Auth middleware
const isLogin = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch (err) {
    res.clearCookie("token");
    return res.redirect("/login");
  }
};

// Routes

// Home
app.get('/', (req, res) => {
  res.render('login');
});

// Login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Register page
app.get('/register', (req, res) => {
  res.render('login');
});

//succes
app.get('/succes', (req, res) => {
  const token = req.cookies.token;
  const decoded = jwt.verify(token, JWT_SECRET);
  res.render('succes', { user: decoded });
});



// Login logic
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
    console.error("Login error:", err);
    res.status(500).send("Internal server error");
  }
});

// Register logic
app.post('/register', async (req, res) => {
  const { username, email, password, age } = req.body;

  try {
    const existingUser = await usermodel.findOne({ email });
    if (existingUser) return res.status(400).send("User already exists");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await usermodel.create({
      username,
      email,
      age,
      password: hashedPassword,
    });

    const tokenPayload = { 
      email: user.email, 
      userid: user._id,
      username: user.username,
      age: user.age
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

    res.cookie("token", token, { httpOnly: true });
    res.redirect('/succes');
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).send("Server error");
  }
});

// Profile page (protected)
app.get('/profile', isLogin, async (req, res) => {
  const { email } = req.user;
  try {
    const user = await usermodel.findOne({ email }).populate('posts');
    if (!user) return res.status(404).send("User not found");
    res.render('profile', { user });
  } catch (err) {
    console.error("Profile error:", err);
    res.status(500).send("Internal server error");
  }
});

// Create post on profile page (protected)
app.post('/dash', isLogin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim() === '') {
      return res.status(400).send("Post content cannot be empty");
    }

    const email = req.user.email;
    const user = await usermodel.findOne({ email });
    if (!user) return res.status(404).send("User not found");

    const post = await postmodel.create({ content, user: user._id });

    user.posts.push(post._id);
    await user.save();

    res.redirect('/profile');
  } catch (err) {
    console.error("Post creation error:", err);
    res.status(500).send("Failed to create post");
  }
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

app.post('/delete/:id', isLogin, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await postmodel.findById(postId);
    if (!post) return res.status(404).send("Post not found");

    // Delete from Post collection
    await postmodel.findByIdAndDelete(postId);

    // Remove from user's posts array
    await usermodel.findByIdAndUpdate(post.user, {
      $pull: { posts: postId }
    });

    res.redirect('/profile');
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send("Failed to delete post");
  }
});

app.post('/edit/:id', isLogin, async (req, res) => {
  try {
    const postId = req.params.id;
    const newContent = req.body.content;

    const post = await postmodel.findById(postId);
    if (!post) return res.status(404).send("Post not found");

    // Optional: check if user is owner
    if (post.user.toString() !== req.user.userid) {
      return res.status(403).send("Unauthorized to edit this post");
    }

    post.content = newContent;
    await post.save();

    res.redirect('/profile');
  } catch (err) {
    console.error("Edit error:", err);
    res.status(500).send("Failed to update post");
  }
});
