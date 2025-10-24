// models/post.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  content: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }
});

module.exports = mongoose.models.post || mongoose.model('post', postSchema);
