const mongoose = require('mongoose');
require('./user.js');

/*

 Log type:
   * join a course
   * create a course
   * like a post
   * unlike a post
   * read a post
   * submit a task
   * release a task mission

*/
var PersonalNotifications = mongoose.model('PersonalNotifications', {
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notifType: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  haveRead: {
    type: Boolean,
    default: false,
    require: true },
  happenAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  readAt: {
    type: Date
  }
});

module.exports = { PersonalNotifications };
