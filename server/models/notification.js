const mongoose = require('mongoose');
require('./tag.js');
require('./user.js');

const Notification = mongoose.model('Notification', {
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  detail: {
    title: {
      type: String,
      required: true
    },
    contentUri: {
       type: String
     }
  },
  expiredDate:{
    type: Date,
    required: true
  },
  createdDate: {
    type: Date,
    default: Date.now
 },
  viewsCount: {
    type: Number,
    min: 0,
    default: 0
  },
  views: {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  _creator: {
    type: mongoose.Schema.Types.ObjectId,
    default: []
  }
});

module.exports = { Notification };
