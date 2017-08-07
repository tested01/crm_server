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
var ActivityLog = mongoose.model('ActivityLog', {
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  logType: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  predicate: { type: String },
  object:  { type: mongoose.Schema.Types.ObjectId },
  delegated: {
    type: Boolean,
    default: false,
    require: true },
  happenAt: {
    type: Date,
    default: Date.now,
    required: true
}
});

module.exports = {ActivityLog};
