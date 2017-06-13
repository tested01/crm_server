var mongoose = require('mongoose');
require('./post.js');

var Resource = mongoose.model('Resource', {
  title: {
    type: String,
    required: false,
    minlength: 1,
    trim: true
  },
  description: {
    type: String,
    required: false
  },
  uri: {
    type: String,
    required: true
  },
  index: {
    type: Number
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Post'
  },
  _creator: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
});

module.exports = {Resource};
