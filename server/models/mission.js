var mongoose = require('mongoose');
require('./course.js');
require('./user.js');
require('./filter.js');
//intentionTarget: [{ type : mongoose.Schema.Types.ObjectId, ref: 'Course' }],
//extentionTarget: [{ type : mongoose.Schema.Types.ObjectId, ref: 'Filter'  }],
var durationSchema = {
  startDate: {
    type: Date,
    required: true
},
  endDate: {
    type: Date,
    required: true
}
};

var Mission = mongoose.model('Mission', {
  title: {
    type: String,
    required: true,
    minlength: 1,
    trim: true
  },
  status: {
    type: String,
    default: 'OPEN'
  },
  missionDuration: {
    type: durationSchema,
    required: true
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  students: {
    submitted: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}]
  },
  createdDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  _creator: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  }
});

module.exports = { Mission };
