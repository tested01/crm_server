require('./config/config');
const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');

var {mongoose} = require('./db/mongoose');
var {Course} = require('./models/course');
var {User} = require('./models/user');
var {authenticate} = require('./middleware/authenticate');

var app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

//Course

var crypto = require('crypto');

function courseCode (howMany, chars) {
    chars = chars
        || "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
    var rnd = crypto.randomBytes(howMany)
        , value = new Array(howMany)
        , len = chars.length;

    for (var i = 0; i < howMany; i++) {
        value[i] = chars[rnd[i] % len]
    };

    return value.join('');
}

app.post('/courses', authenticate, (req, res) => {
  //Only teacher can create courses
  if(!(req.user.role=='teacher')){
    return res.status(403).send();
  }
  //code is random number composed of number chars
  var endDate = Date.parse(req.body.endDate);
  var startDate = Date.parse(req.body.startDate);
    var course = new Course({
      _creator: req.user._id,
      name: req.body.name,
      courseDuration:{
        startDate,
        endDate
      },
      code: courseCode(10, '0123456789')
    });
  course.save().then((doc) => {
    res.send(doc);
  }, (e) => {
    res.status(400).send(e);
  });
});
//This function aims to check is passed parameters is valid
//prevent for injection attacks
function isNormalInteger(str) {
  var n = Math.floor(Number(str));
  return String(n) === str && n >= 0;
}

app.post('/courses/:code/members/:memberId', authenticate, (req, res) => {
  var code = req.params.code;
  var memberId = req.params.memberId;

  if(!isNormalInteger(code)){
    return res.status(404).send();
  }

  if (!ObjectID.isValid(memberId)) {
    return res.status(404).send();
  }
  Course.findOne({
    code,
    _creator: req.user._id
  }).then((course) => {
    if (!course) {
      return res.status(404).send();
    }
    /*
    //The usage demostration of Array#some 
    var existingStudent = course.members.students.some(function (student) {
      return (student == memberId);
    });
    */
    var existingStudent = (course.members.students.indexOf(memberId) > 0);

    if (!(existingStudent)){
      course.members.students.push(memberId);
      course.save();
    }
    res.send({course});
  });

});

app.get('/courses', authenticate, (req, res) => {
  Course.find({
    _creator: req.user._id
  }).populate('_creator')
  .populate('members.students')
  .then((courses) => {
    res.send({courses});
  }, (e) => {
    res.status(400).send(e);
  });
});

app.get('/courses/:id', authenticate, (req, res) => {
  var id = req.params.id;

  if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }

  Course.findOne({
    _id: id,
    _creator: req.user._id
  }).populate('_creator')
  .populate('members.students')
  .then((course) => {
    if (!course) {
      return res.status(404).send();
    }

    res.send({course})
  }).catch((e) => {
    res.status(400).send();
  });

});

app.delete('/courses/:id', authenticate, (req, res) => {
  var id = req.params.id;

  if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }

  Course.findOneAndRemove({
    _id: id,
    _creator: req.user._id
  }).then((course) => {
    if (!course) {
      return res.status(404).send();
    }

    res.send({course});
  }).catch((e) => {
    res.status(400).send();
  });
});

app.delete('/courses/:code/members/:memberId', authenticate, (req, res) => {
  var code = req.params.code;
  var memberId = req.params.memberId;

  if(!isNormalInteger(code)){
    return res.status(404).send();
  }

  if (!ObjectID.isValid(memberId)) {
    return res.status(404).send();
  }
  Course.findOne({
    code,
    _creator: req.user._id
  }).then((course) => {
    if (!course) {
      return res.status(404).send();
    }
    var existingStudent = (course.members.students.indexOf(memberId));

    if (existingStudent > 0){
      // Find and remove item from an array
      course.members.students.splice(existingStudent, 1);
      course.save();
    }
    res.send({course});
  });

});

app.patch('/courses/:id', authenticate, (req, res) => {
  var id = req.params.id;
  var body = _.pick(req.body, ['text', 'completed']);

  if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }

  if (_.isBoolean(body.completed) && body.completed) {
    body.completedAt = new Date().getTime();
  } else {
    body.completed = false;
    body.completedAt = null;
  }

  Course.findOneAndUpdate({_id: id, _creator: req.user._id}, {$set: body}, {new: true}).then((course) => {
    if (!course) {
      return res.status(404).send();
    }

    res.send({course});
  }).catch((e) => {
    res.status(400).send();
  })
});

// POST /users
app.post('/users', (req, res) => {
  var body = _.pick(req.body, ['email', 'password', 'role']);
  var user = new User(body);

  user.save().then(() => {
    return user.generateAuthToken();
  }).then((token) => {
    res.header('x-auth', token).send(user);
  }).catch((e) => {
    res.status(400).send(e);
  })
});

app.get('/users/me', authenticate, (req, res) => {
  res.send(req.user);
});

app.post('/users/login', (req, res) => {
  var body = _.pick(req.body, ['email', 'password']);

  User.findByCredentials(body.email, body.password).then((user) => {
    return user.generateAuthToken().then((token) => {
      res.header('x-auth', token).send(user);
    });
  }).catch((e) => {
    res.status(400).send();
  });
});

app.delete('/users/me/token', authenticate, (req, res) => {
  req.user.removeToken(req.token).then(() => {
    res.status(200).send();
  }, () => {
    res.status(400).send();
  });
});

app.listen(port, () => {
  console.log(`Started up at port ${port}`);
});

module.exports = {app};
