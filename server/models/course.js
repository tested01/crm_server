const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
require('./user.js');

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

function durationValidator(value){
  return (value.endDate > value.startDate);
}

var CourseSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    _creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    courseDuration: {
    type: durationSchema,
    validate: {
      validator: durationValidator,
      message: 'This is not a valid duration'
    }},
      code: {
        type: String,
        required: false
      },
  members: {
    teachers: {
      type: String,
      required: false
    },
    students: [{ type : mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }
});


var Course = mongoose.model('Course', CourseSchema);

module.exports = {Course}
