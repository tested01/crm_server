require('./config/config');
const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const { ObjectID } = require('mongodb');

const { mongoose } = require('./db/mongoose');
const { Course } = require('./models/course');
const { Mission } = require('./models/mission');
const { Post } = require('./models/post');
const { User } = require('./models/user');
const { authenticate } = require('./middleware/authenticate');
const multer = require('multer');
const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

const crypto = require('crypto');

function genCode ( howMany, chars) {
    chars = chars
        || "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
    const rnd = crypto.randomBytes(howMany);
    const value = new Array(howMany);
    const len = chars.length;

    for (let i = 0; i < howMany; i++) {
        value[i] = chars[rnd[i] % len]
    };

    return value.join('');
}

function courseCode(howMany, chars) {
  return genCode(howMany, chars);
}

// API ---- Mission

app.post('/missions', authenticate, (req, res) => {
  //Only teacher can create missions
  if(!(req.user.role=='teacher')){
    return res.status(403).send();
  }
  //code is random number composed of number chars
  var endDate = Date.parse(req.body.endDate);
  var startDate = Date.parse(req.body.startDate);
    var mission = new Mission({
      _creator: req.user._id,
      title: req.body.title,
      missionDuration:{
        startDate,
        endDate
      },
      target:  req.body.target
    });
  mission.save().then((doc) => {
    res.send(doc);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.get('/missions', authenticate, (req, res) => {
  if (req.user.role === 'teacher') {
    Mission.find({
      _creator: req.user._id
    }).populate('_creator')
    .populate('target')
    .then((missions) => {
      res.send({ missions });
    }, (e) => {
      res.status(400).send(e);
    });
  }
if (req.user.role === 'student') {
  Course.find()
        .where('members.students')
        .in([req.user._id])
        .exec((err, courses) => {
          //先取得學生的班級 stdsCourses
          let stdsCourses = courses.map((course) => course.id);
          //再去取得任務
          Mission.find()
                .where('target')
                .in(stdsCourses)
                .exec((err, missions) => {
                  res.send({ missions });
                });
        });
}

  //return res.status(203).send(req.user._id);
});

app.get('/missions/courses/:courseId', authenticate, (req, res) => {
  let courseId = req.params.courseId;
  if (req.user.role === 'teacher') {
    Mission.find({
      _creator: req.user._id,
      target: courseId
    }).populate('_creator')
    .populate('target')
    .then((missions) => {
      res.send({ missions });
    }, (e) => {
      res.status(400).send(e);
    });
  }
  if (req.user.role === 'student') {
      Mission.find()
            .where('target')
            .in([courseId])
            .exec((err, missions) => {
              //TODO: check if the student can access the mission(e.g. in the course)
              res.send({ missions });
            });
      }
});

app.get('/missions/:id', authenticate, (req, res) => {
  var id = req.params.id;

  if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }


  Mission.findOne({_id: id, _creator: req.user._id}).then((mission) => {
    if (!mission) {
      return res.status(404).send();
    }

    res.send({mission});
  }).catch((e) => {
    res.status(400).send();
  })
});

app.patch('/missions/:id', authenticate, (req, res) => {
  var id = req.params.id;
  var body = _.pick(req.body, ['title', 'startDate', 'endDate', 'target']);
  /*
  var revisedMission = {
    "missionDuration": {
      startDate,
      endDate
    },
    "title": body.title,
    "target": body.target
  }
  */
  var revisedMission = {
    "missionDuration": {
    },
    "target": body.target
  }
  if (body.title.length > 0) {
    revisedMission.title = body.title;
    console.log(revisedMission, '...t...');
  }
  if (body.startDate.length > 0) {
    const startDate = Date.parse(body.startDate);
    revisedMission.missionDuration.startDate = startDate;
    console.log(revisedMission, '...sd...');
  }
  if (body.endDate.length > 0) {
    const endDate = Date.parse(body.endDate);
    revisedMission.missionDuration.endDate = endDate;
    console.log(revisedMission, '...ed...');
  }
  if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }
  Mission.findOneAndUpdate(
    {_id: id, _creator: req.user._id },
    { $set: revisedMission },
    { new: true }
  ).then((mission) => {
    if (!mission) {
      return res.status(404).send();
    }
    res.send({ mission });
  }).catch((e) => {
    res.status(400).send(e);
  })
});

// API ---- Course

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
  //var n = Math.floor(Number(str));
  //return String(n) === str && n >= 0;
  const lengthLeagle = (str.length === 10);
  const isNumber = (!isNaN(str));
  return (lengthLeagle && isNumber);
}

app.post('/courses/:code/members/:memberId', authenticate, (req, res) => {
  var code = req.params.code;
  var memberId = req.params.memberId;

  if(!isNormalInteger(code)){
    console.log('not num');
    return res.status(404).send();

  }

  if (!ObjectID.isValid(memberId)) {
    console.log('invalid id');
    return res.status(404).send();

  }
  Course.findOne({
    code,
    _creator: req.user._id
  }).then((course) => {
    if (!course) {
      console.log('no course');
      return res.status(404).send();
    }
    /*
    //The usage demostration of Array#some
    var existingStudent = course.members.students.some(function (student) {
      return (student == memberId);
    });
    */
    var existingStudent = (course.members.students.indexOf(memberId) >= 0);

    if (!(existingStudent)){
      course.members.students.push(memberId);
      course.save();
    }
    res.send({course});
  });

});

//join course by student
app.post('/courses/:code/students', authenticate, (req, res) => {
  const code = req.params.code;

  if (!isNormalInteger(code)) {
    console.log('not num');
    return res.status(404).send();
  }
  Course.findOne({
    code
  }).then((course) => {
    if (!course) {
      console.log('no course');
      return res.status(404).send();
    }
    /*
    //The usage demostration of Array#some
    var existingStudent = course.members.students.some(function (student) {
      return (student == memberId);
    });
    */
    const existingStudent = (course.members.students.indexOf(req.user._id) >= 0);

    if (!(existingStudent)) {
      course.members.students.push(req.user._id);
      course.save();
    }
    res.send({ course });
  });
});

app.get('/courses', authenticate, (req, res) => {
  if (req.user.role === 'teacher') {
    Course.find({
      _creator: req.user._id
    }).populate('_creator')
    .populate('members.students')
    .then((courses) => {
      res.send({ courses });
    }, (e) => {
      res.status(400).send(e);
    });
  }
  // { results: { $elemMatch: { product: "xyz", score: { $gte: 8 } } } }
  if (req.user.role === 'student') {
    /*
    User.find()
  .where('fb.id')
  .in([3225, 623423, 6645345])
  .exec(function (err, records) {
    //make magic happen
  });
    */
    Course.find()
          .where('members.students')
          .in([req.user._id])
          .populate('_creator')
          .exec((err, courses) => res.send({ courses }));
  }
});

app.get('/courses/:code', authenticate, (req, res) => {
  const code = req.params.code;
  /*
  if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }*/
  const lengthViolate = !(code.length === 10);
  const numViolate = (isNaN(code));
  if (lengthViolate || numViolate) {
    return res.status(404).send();
  }

  Course.findOne({
    code//,
    //_creator: req.user._id //TODO: check if the requester is member of this course
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
    const existingStudent = (course.members.students.indexOf(memberId));
    console.log('existingStudent', existingStudent);
    if (existingStudent >= 0){
      // Find and remove item from an array
      course.members.students.splice(existingStudent, 1);
      course.save();
    }
    res.send({ course });
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

// API ---- User
app.post('/users', (req, res) => {
  var body = _.pick(req.body, [
    'email',
    'password',
    'role',
    'phone',
    'firstName',
    'lastName',
    'schoolName',
    'schoolCity',
    'schoolLevel',
    'schoolType'
  ]);
  var user = new User(body);

  user.save().then(() => {
    return user.generateAuthToken();
  }).then((token) => {
    res.header('x-auth', token).send(user);
    console.log(user, 'res_user');
    console.log(req.user, 'req_user');
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


// API ---- Post
app.post('/posts', (req, res) => {
  var body = _.pick(req.body, [
    'detail',
    'mission'
  ]);
  var post = new Post(body);

  post.save().then((doc) => {
    return res.send(doc);
  }).catch((e) => {
    res.status(400).send(e);
  })
});

app.listen(port, () => {
  console.log(`Started up at port ${port}`);
});

module.exports = {app};
