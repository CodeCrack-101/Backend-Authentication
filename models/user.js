// models/user.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },  // not 'name', but 'username' since you use that
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  age: Number,
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'post' }]
});

module.exports = mongoose.models.user || mongoose.model('user', userSchema);
