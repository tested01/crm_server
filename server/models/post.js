const mongoose = require('mongoose');
require('./tag.js');
require('./resource.js');
require('./user.js');

var Post = mongoose.model('Post', {
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  advisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  detail: {
    title: {
      type: String,
      required: true
    },
    resources: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }]
  },
  createdDate: {
    type: Date,
    default: Date.now()
 },
  likesCount: {
    type: Number,
    min: 0,
    default: 0
  },
  likes: {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  mission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mission'
  },
  coursesVisible: {
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    default: []
  },
  publicVisible: { //展演大廳, xx 之星
    visible: [{ type: String }],
    default: []
  },
  openaccess: {
    type: Boolean,
    default: true,
    require: true
  },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  _creator: {
    type: mongoose.Schema.Types.ObjectId,
    default: []
  }
});

//TODO: sync the likes and likeCounts
//For further sorting (e.g. hot posts)
/*
Post.methods.syncLikeCounts = function(oid) {
  let currentPost = this.model('Post').find({'_id': oid});
};
*/
module.exports = {Post};
