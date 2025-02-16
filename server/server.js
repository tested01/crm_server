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
const { Notification } = require('./models/notification');
const { PersonalNotifications } = require('./models/personalNotifications');
const { ActivityLog } = require('./models/activitylog');
const { Resource } = require('./models/resource');
const { authenticate } = require('./middleware/authenticate');
const multer = require('multer');
const { NotificationTypes, LogTypes } = require('./constants');
const app = express();
const port = process.env.PORT;
//const cors = require('express-cors')

/*
app.use(cors({
    allowedOrigins: [
        '*'
    ]
}));
*/

// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); //, OPTIONS, PUT, PATCH, DELETE'

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Accept, x-auth');


    res.setHeader('Access-Control-Expose-Headers', 'x-auth');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();

});

app.use(bodyParser.json());
//app.use(multer({ dest: './uploads/' }));

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

const upload = multer({
  dest: path.join(__dirname, '../public/uploads/temp')
});

app.use(express.static('public'));

function genCode(howMany, charsP) {
    const chars = charsP
        || "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
    const rnd = crypto.randomBytes(howMany);
    const value = new Array(howMany);
    const len = chars.length;

    for (let i = 0; i < howMany; i++) {
        value[i] = chars[rnd[i] % len]
    }

    return value.join('');
}

function courseCode(howMany, chars) {
  return genCode(howMany, chars);
}

//Logging mechanism
function doActivityLog(activity){
  let { subject, logType, predicate, object, data } = activity;
  const activityLog = new ActivityLog({
    subject,
    logType,
    predicate,
    data,
    object,
  });
  activityLog.save().then((doc) => {
    //res.send(doc);
    delegateActivityLog(activity);
    return { success: true, data: doc};
  }, (e) => {
    //res.status(400).send(e);
    return { success: false, data: e};
  });
}

function delegateActivityLog(activity){
  let { subject, logType, object, data } = activity;
  let notification = {}; //owner, logType, data
    //delegate notifications to each corresponding users
  User.findOne({_id: subject}).exec((err, triggerUser) => {
    let subjectFullName = triggerUser.lastName + triggerUser.firstName;
    switch(logType){
      case LogTypes.JOINCOURSE:
        console.log('JOINCOURSE');

        //Audience: students of the course excepts for the joining one
        //generate notification (via template)
        //send to all audiences via addPersonalNotifications(notification);
        Course.findOne({_id: object})
              .populate('_creator')
              .populate('members.students')
              .exec((err, course) => {
                let courseStudents = course.members.students;
                let courseName = course.name;
                //teacher
                let teacher_notification = {
                  owner: course._creator._id,
                  notifType: NotificationTypes.S_JOINCOURSE,
                  data: {
                    message: `${subjectFullName}加入了「${courseName}」班`
                  }
                }
                addPersonalNotifications(teacher_notification)
                //students
                courseStudents.map(
                  (student) => {
                    let studentFullName = student.lastName + student.firstName;
                    let notification = {
                      owner: student._id,
                      notifType: NotificationTypes.S_JOINCOURSE,
                      data: {
                        message: `${subjectFullName}加入了「${courseName}」班`
                      }
                    }
                    addPersonalNotifications(notification)
                  }
                );
                });
        break;
      case LogTypes.CREATETASK:
        console.log('CREATETASK');
        //NotificationTypes.T_CREATETASK
        //Audience: students of the course
        Mission.findOne({_id: object})
              .populate('_creator')
              .populate('target')
              .exec((err, mission) => {

                let missionTitle = mission.title;

                Course.findOne({_id: mission.target})
                      .populate('_creator')
                      .populate('members.students')
                      .exec((err, course) => {
                        let courseStudents = course.members.students;
                        let courseName = course.name;

                        courseStudents.map(
                          (student) => {
                            let studentFullName = student.lastName + student.firstName;
                            let notification = {
                              owner: student._id,
                              notifType: NotificationTypes.T_CREATETASK,
                              data: {
                                message: `${subjectFullName} 在「${courseName}」新增了一個作品繳交項目: 「${missionTitle}」`
                              }
                            }
                            addPersonalNotifications(notification)
                          }
                        );
                        });

                });
        break;
      case LogTypes.SUBMITTASK:
        console.log('SUBMITTASK');
       //Audoence:
       // 1. students of the course excepts for the submitter
       // 2. teacher of the course
       //FIXME: object is now mission id not post id...
       console.log(object);
       Post.findOne({_id: object})
             .populate('mission')
             .populate('advisor')
             .populate('author')
             .exec((err, post) => {

               let missionTitle = post.mission.title;

               Course.findOne({_id: post.mission.target})
                     .populate('_creator')
                     .populate('members.students')
                     .exec((err, course) => {
                       let courseStudents = course.members.students;
                       let courseName = course.name;
                       //teacher
                       let teacher_notification = {
                         owner: course._creator._id,
                         notifType: NotificationTypes.S_SUBMITTASK,
                         data: {
                           message: `${subjectFullName} 已在繳交項目「${missionTitle}」中上傳作品`
                         }
                       }
                       addPersonalNotifications(teacher_notification);
                       //students
                       courseStudents.map(
                         (student) => {
                           let studentFullName = student.lastName + student.firstName;
                           let notification = {
                             owner: student._id,
                             notifType: NotificationTypes.S_SUBMITTASK,
                             data: {
                               message: `${subjectFullName} 已在繳交項目「${missionTitle}」中上傳作品`
                             }
                           }
                           addPersonalNotifications(notification);
                         }
                       );
                       });

               });
        break;
      case LogTypes.LIKEAPOST:
        console.log('LIKEAPOST');
      //Audience:
      // 1. author
      //TODO: 我對我自己文章按讚
      Post.findOne({_id: object})
            .populate('author')
            .exec((err, post) => {

              let postTitle = post.detail.title;
              let authorName = post.author.lastName + post.author.firstName;
              //student
              let notification = {
                owner: post.author._id,
                notifType: NotificationTypes.A_LIKEAPOST,
                data: {
                  message: `${subjectFullName}對你的「${postTitle}」作品按讚`
                }
              }
              addPersonalNotifications(notification);
              //teacher
              //student
              let teacher_notification = {
                owner: post.advisor,
                notifType: NotificationTypes.A_LIKEAPOST,
                data: {
                  message: `${subjectFullName}對你指導${authorName}的「${postTitle}」作品按讚`
                }
              }
              addPersonalNotifications(teacher_notification);


        });
        break;
      case LogTypes.USHOWAWARD:
        console.log('USHOWAWARD');
        let postTitle = data.post.detail.title;
        if(data.tag == 'uStar'){
          //Audience:
          // 1. author(student)
          let s_notification = {
            owner: data.post.author,
            notifType: NotificationTypes.S_USHOWAWARD,
            data: {
              message: `你的作品「${postTitle}」被推薦為聯合報之星`
            }
          }
          addPersonalNotifications(s_notification);
          // 2. advisor
          let t_notification = {
            owner: data.post.advisor,
            notifType: NotificationTypes.T_USHOWAWARD,
            data: {
              message: `你指導的${subjectFullName}同學的作品「${postTitle}」被推薦為聯合報之星`
            }
          }
          addPersonalNotifications(t_notification);
        }

        break;
    }
    }
  );

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
    let activity={};
    activity.subject = req.user._id;
    activity.predicate = 'create';
    activity.logType = LogTypes.CREATETASK;//'createMission';
    activity.object = doc._id;
    doActivityLog(activity);
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
                .populate('_creator')
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
            .populate('_creator')
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

  Mission.findOne({_id: id, _creator: req.user._id})
  .populate('_creator')
  .then((mission) => {
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
  ).populate('_creator')
  .then((mission) => {
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
    let activity={};
    activity.subject = req.user._id;
    activity.predicate = 'create';
    activity.logType = LogTypes.CREATECOURSE;//'createCourse';
    activity.object = doc._id;
    doActivityLog(activity);
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
      let activity={};
      activity.subject = req.user._id;
      activity.predicate = 'join';
      activity.logType = LogTypes.JOINCOURSE; //'joinCourse';
      activity.object = course._id;
      doActivityLog(activity);
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


app.post('/users/hasemail', (req, res) => {
  var body = _.pick(req.body, [
    'email'
  ]);
  User.find({
    email: body.email
  })
  .then((users) => {
    if (!users) {
      //return res.status(404).send();
      res.send({ result: false })
    }
    if(users.length == 0){
      res.send({ result: false })
    }
    res.send({ result: true })
  }).catch((e) => {
    res.status(400).send();
  });

});

app.post('/users/hasphone', (req, res) => {
  var body = _.pick(req.body, [
    'phone'
  ]);
  User.find({
    phone: body.phone
  })
  .then((users) => {
    if (!users) {
      //return res.status(404).send();
      res.send({ result: false })
    }
    if(users.length == 0){
      res.send({ result: false })
    }
    res.send({ result: true })
  }).catch((e) => {
    res.status(400).send();
  });

});

/*
//Example of find by a given list of ids

model.find({
    '_id': { $in: [
        mongoose.Types.ObjectId('4ed3ede8844f0f351100000c'),
        mongoose.Types.ObjectId('4ed3f117a844e0471100000d'),
        mongoose.Types.ObjectId('4ed3f18132f50c491100000e')
    ]}
}, function(err, docs){
     console.log(docs);
});

*/

//This API has security issue
//sensitive data should be removed (only firstName & lastName are selected)
//ref: http://mongoosejs.com/docs/queries.html
app.post('/users/list', authenticate, (req, res) => {
  const list = req.body.list;
  const idList = list.map((id) => mongoose.Types.ObjectId(id));
  console.log(list, idList);
  User.find({
    _id: { $in: idList }
  }).select('firstName lastName')
  .then((users) => {
    if (!users) {
      return res.status(404).send();
    }
    res.send({ users })
  }).catch((e) => {
    res.status(400).send();
  });
});

app.post('/users/login', (req, res) => {
  var body = _.pick(req.body, ['email', 'password']);

  User.findByCredentials(body.email, body.password).then((user) => {
    return user.generateAuthToken().then((token) => {
      res.header('x-auth', token).send(user);
    });
  }).catch((e) => {
    console.log(e);
    res.status(400).send(e);
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
app.post('/posts/', authenticate, (req, res) => {
  var body = _.pick(req.body, [
    'detail',
    'mission',
    'advisor',
    'openaccess'
  ]);
  body.author = req.user;
  const post = new Post(body);
  //update students.submitted of mission
  let conditions = {
    _id: req.body.mission
  };
  let userId = req.user._id ;
  let update = {
      $addToSet: { 'students.submitted' :  userId }
  }

  post.save().then((post) => {
    Mission.findOneAndUpdate(conditions, update, {new: true}, function(err, doc) {
        //add only when adding the post successfully
        let activity={};
        activity.subject = req.user._id;
        activity.predicate = 'post';
        activity.logType = LogTypes.SUBMITTASK; //'postMission';
        activity.object = post._id;
        doActivityLog(activity);
    });
    res.send(post);
  }).catch((e) => {
    res.status(400).send(e);
  })
});

app.get('/posts/me', authenticate, (req, res) => {
  //req.user;
  Post.find({
    author: req.user._id//,
  }).populate('author')
  .populate('detail.resources')
  .populate('advisor')
  .then((posts) => {
    if (!posts) {
      return res.status(404).send();
    }
    res.send({ posts })
  }).catch((e) => {
    res.status(400).send();
  });
});

app.get('/posts/missions/:mid', authenticate, (req, res) => {
  const mid = new ObjectID(req.params.mid);

  if (!ObjectID.isValid(mid)) {
    return res.status(404).send();
  }
  Post.find({
    mission: mid//,
    //_creator: req.user._id
    //TODO: check if the requester is member of this course
    //TODO: upload images
  }).populate('author')
  .populate('detail.resources')
  .then((posts) => {
    if (!posts) {
      return res.status(404).send();
    }
    res.send({ posts })
  }).catch((e) => {
    res.status(400).send();
  });
});

app.patch('/posts/like/:pid', authenticate, (req, res) => {
  const pid = new ObjectID(req.params.pid);

  if (!ObjectID.isValid(pid)) {
    return res.status(404).send();
  }
  let conditions = {
    _id: pid
  };
  let userId = req.user._id ;
  let update = {
      $addToSet: { 'likes.users' :  userId }
  }

  Post.findOneAndUpdate(conditions, update, {new: true}, function(err, doc) {
      let activity={};
      activity.subject = req.user._id;
      activity.predicate = 'like';
      activity.logType = LogTypes.LIKEAPOST; //'likePost';
      activity.object = pid;
      doActivityLog(activity);
      return res.status(200).send(doc);
  });
});

app.patch('/posts/unlike/:pid', authenticate, (req, res) => {
  const pid = new ObjectID(req.params.pid);

  if (!ObjectID.isValid(pid)) {
    return res.status(404).send();
  }
  let conditions = {
    _id: pid
  };
  let userId = req.user._id ;
  let update = {
      $pullAll: { 'likes.users' :  [userId] }
  }

  Post.findOneAndUpdate(conditions, update, {new: true}, function(err, doc) {
      let activity={};
      activity.subject = req.user._id;
      activity.predicate = 'unlike';
      activity.logType = LogTypes.UNLIKEAPOST; //'unlikePost';
      activity.object = pid;
      doActivityLog(activity);
      return res.status(200).send(doc);
  });
});

//多圖上傳
app.post('/upload/photos', upload.array('article', 12), function (req, res, next){
    //req.post_id 要傳一下 post_id
    let resourceList = [];
    const indexLength = req.files.length;
    req.files.forEach(
      function (file, index) {
          /** When using the "single"
          data come in "req.file" regardless of the attribute "name". **/
          let tmp_path = file.path;
          /** The original name of the uploaded file
              stored in the variable "originalname". **/
          const temp_dir = 'public/uploads/';

              if (!fs.existsSync(temp_dir)){
                  fs.mkdirSync(temp_dir);
              }
          const targetDir = 'public/uploads/'.concat(req.body.auth_id)
          .concat('/').concat(req.body.post_id).concat('/');
          const target_path = targetDir + file.originalname;
          let uri = '/uploads/' + req.body.auth_id +
                    '/' + req.body.post_id +
                    '/' + file.originalname;
          //TODO: add image to patch resource array of the post
          // i.e. resourceList
          const res ={
            uri,
            _creator: req.body.auth_id,
            post: req.body.post_id,
            index
          };

          let resource = new Resource(res);
          resource.save().then((doc) => resourceList.push(doc._id)).catch((e) => {
            console.log('resource save error --- ', e);
          });
          mkdirp(targetDir, function (err) {
              if (err){
                console.error(err);
              }
              else{
                /** A better way to copy the uploaded file. **/

                let src = fs.createReadStream(tmp_path);
                let dest = fs.createWriteStream(target_path);
                src.pipe(dest);
                src.on('end', function(){
                  //res.render('complete');
                  if(index == indexLength-1){
                    console.log(resourceList, 'resourceList');

                    //TODO: patch post's resource
                    let conditions = {
                      _id: req.body.post_id
                    };
                    let updateContent = {
                      'detail.resources': resourceList
                    };
                    let update = {
                        //$pullAll: { 'likes.users' :  [userId] }
                        $set: updateContent
                    }

                    Post.findOneAndUpdate(conditions, update, {new: true},
                      function (err, doc) {
                        console.log('updated images of the post', doc);
                    });

                  }
                });
                src.on('error', function(err) {
                  //res.render('error');
                  console.log('error', err);
                });
              }
          });
      }
    );
});


//單張頭像照片上傳
app.post('/upload/avatar', upload.single('avatar'), function(req, res, next){
    /** When using the "single"
    data come in "req.file" regardless of the attribute "name". **/
    let tmp_path = req.file.path;
    const targetDir = 'public/uploads/userImg/'.concat(req.body.auth_id)
                       .concat('/');
    let pieces = file.originalname.split('.');
    let fileExtension = pieces[pieces.length-1];
    //check fileExtention to prevent attack
    if(['png', 'jpg'].includes(fileExtension)){
      const target_path = targetDir + 'avatar.' + fileExtension;
      let uri = '/uploads/userImg/' + req.body.auth_id +
                '/' + 'avatar.' + fileExtension;
                mkdirp(targetDir, function (err) {
                    if (err){
                          console.error(err);
                    }
                    else {
                          let src = fs.createReadStream(tmp_path);
                          let dest = fs.createWriteStream(target_path);
                          src.pipe(dest);
                          src.on('end', function() {
                            console.log('complete');
                          });
                          src.on('error', function(err) {
                            console.log('error', err);
                          });
                    }
                  });
                } else {
                        res.send(404); //Forbidden: invalid file extension
                       }
    });

// API ---- shows
function delegateTagAdd(req, res, tag){
  let conditions = {
    _id: req.body.post,
    advisor: req.user._id
  };
  let update = {};
  if(req.body.operation === 'add'){
    update = {$addToSet: { 'publicVisible.visible' :  tag }};
  }
  if(req.body.operation === 'delete'){
    update = {$pull: { 'publicVisible.visible' :  tag }};
  }

  Post.findOneAndUpdate(conditions, update, {new: true}, function(err, doc) {
      return res.status(200).send(doc);
  });
}

//delegateTagAddUdnTA is available only for udn internal members
function delegateTagAddUdnTA(req, res, tag){

  //TODO: query for the udn teachers set (role-based access control)
  //chech if the requester is the valid role
  //if it is, added the tag. Otherwise, reject by returning 403.

  //TODO: That is, check if req.user._id has the access role!!

  let conditions = {
    _id: req.body.post
  };
  let author = req.user._id;
  let markedDate = new Date();
  //TODO: add a log for who add the uShow or uStar tags at which time

  let update = {};
  if(req.body.operation === 'add'){
    update = {$addToSet: { 'publicVisible.visible' :  tag }};
  }
  if(req.body.operation === 'delete'){
    update = {$pull: { 'publicVisible.visible' :  tag }};
  }

  Post.findOneAndUpdate(conditions, update, {new: false}, function(err, post) {
          // 動作為加星星, 且目前不是 uStar
      if((req.body.operation === 'add') && (!post.publicVisible.visible.includes('uStar'))){
        let activity={};
        post.populate('author').populate('advisor');
        activity.subject = author;
        activity.predicate = 'tag';
        activity.logType = LogTypes.USHOWAWARD; //'tagPost';
        activity.data = {tag, post};
        activity.object = post._id;
        doActivityLog(activity);
      }

      return res.status(200).send(post);
  });
}

function delegateTagGet(req, res, tag){

  Post.find(
    { 'publicVisible.visible' :  tag }
  ).populate('advisor')
  .populate('author')
  .populate('detail.resources')
  .then((posts) => {
    if (!posts) {
      return res.status(404).send();
    }
    res.send({posts})
  }).catch((e) => {
    res.status(400).send();
  });
}

app.post('/shows', authenticate, (req, res) => {
  //update post
  //only the advisor can give this tag
  if(!(req.user.role=='teacher')){
    return res.status(403).send();
  }else{
    delegateTagAdd(req, res, 'uShow');
  }

});

/*
app.all('/users/login', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
 });
 */




//find all posts tagged by uStar
//reference: https://stackoverflow.com/questions/18148166/find-document-with-array-that-contains-a-specific-value
app.get('/shows', (req, res) => {
  delegateTagGet(req, res, 'uShow');
});

app.post('/stars', authenticate, (req, res) => {
  //update post
  //only the advisor can give this tag
  delegateTagAddUdnTA(req, res, 'uStar');
});
//find all posts tagged by uStar
//reference: https://stackoverflow.com/questions/18148166/find-document-with-array-that-contains-a-specific-value
app.get('/stars', (req, res) => {
  delegateTagGet(req, res, 'uStar');
});

app.get('/posts/filters/:filter/:limit', authenticate, (req, res)  => {
  const filter = req.params.filter;
  const limit = Number(req.params.limit);
  if (filter === 'new') {
    Post.find(
      { openaccess: true }
    ).sort({ createdDate: -1 })
    .limit(limit)
    .populate('advisor')
    .populate('author')
    .populate('detail.resources')
    .then((posts) => {
      if (!posts) {
        return res.status(404).send();
      }
      res.send({ posts })
    })
    .catch((e) => {
      res.status(400).send();
    });
  }
  if (filter === 'hot'){
    //TODO: get most popular posts
    /*
    Post.find(
      { openaccess: true }
    ).sort({ createdDate: -1 })
    .limit(20)
    .populate('advisor')
    .populate('author')
    .populate('detail.resources')
    .then((posts) => {
      if (!posts) {
        return res.status(404).send();
      }
      res.send({ posts })
    })
    .catch((e) => {
      res.status(400).send();
    });
  }
  */

  Post.aggregate(
    [
        { "$match":
          {"openaccess": true}
        },

        { "$project": {
            "detail": 1,
            "createdDate": 1,
            "mission": 1,
            "coursesVisible": 1,
            "publicVisible": 1,
            "openaccess": 1,
            "author": 1,
            "advisor": 1,
            "likes": 1,
            "likeCounts": { "$size": "$likes.users" }
        }},
        { "$sort": { "likeCounts": -1 } },
        { "$limit": limit }
    ],
    function(err,results) {
        // results in here
        console.log(err, results, 'results...');
        User.populate(results, { path: 'author' },
          function(err, populatedResults) {

            User.populate(populatedResults, { path: 'advisor' },
              function(err, results2) {

                Resource.populate(results2, { path: 'detail.resources' },
                  function(err, populatedResults2) {

                    res.send({ posts: populatedResults2 });
                });
            });

        });

    }
  );
  }
});

// API ---- notifications
app.post('/notifications', authenticate, (req, res) => {
  //Only 'backend' can create notifications
  /*
  if(!(req.user.role=='backend')){
    return res.status(403).send();
  }*/

  const expiredDate = Date.parse(req.body.expiredDate);
  const title = req.body.title;
  const contentUri = req.body.contentUri;

  const notification = new Notification({
    author: req.user._id,
    detail:{
      title,
      contentUri
    },
    expiredDate
  });
  notification.save().then((doc) => {
    res.send(doc);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.get('/notifications', authenticate, (req, res) => {
  //Only 'backend' can create notifications
  /*
  if(!(req.user.role=='backend')){
    return res.status(403).send();
  }*/

  Notification.find().then((notifications) => {
    res.send(notifications);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.get('/activity_log', authenticate, (req, res) => {
  //Aggregate adjacent activity notifs
  let user = req.user;

  ActivityLog.find().then((activityLogs) => {
    res.send(activityLogs);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.post('/activity_log', authenticate, (req, res) => {
  //Aggregate adjacent activity notifs
  let user = req.user;
  let subject = req.user._id;
  let logType = req.body.logType;
  let predicate = req.body.predicate;
  let object = req.body.object;
  let data = req.body.data;
  const activityLog = new ActivityLog({
    subject,
    logType,
    predicate,
    data,
    object,
  });
  activityLog.save().then((doc) => {
    delegateActivityLog(activityLog);
    res.send(doc);

  }, (e) => {
    res.status(400).send(e);

  });
});

app.get('/personal_notifications', authenticate, (req, res) => {
  //Aggregate adjacent activity notifs
  let user = req.user;
  PersonalNotifications.find(
    { owner: user._id }
  ).then((notifications) => {
    res.send(notifications);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.get('/personal_notifications', authenticate, (req, res) => {
  //Aggregate adjacent activity notifs
  let user = req.user;
  PersonalNotifications.find(
    { owner: user._id }
  ).sort({ happenAt: -1 })
  .then((notifications) => {
    res.send(notifications);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.patch('/personal_notifications/:id', authenticate, (req, res) => {
  var nid = req.params.id; //notification's id
  var body = _.pick(req.body, ['haveRead']);

  if (!ObjectID.isValid(nid)) {
    return res.status(404).send();
  }

  if (_.isBoolean(body.haveRead) && body.haveRead) {
    body.haveRead = true;
    body.readAt = new Date().getTime();
  } else {
    body.haveRead = false;
    body.readAt = null;
  }

  PersonalNotifications.findOneAndUpdate(
    {_id: nid, owner: req.user._id}, {$set: body}, {new: true})
    .then((notification) => {
      if (!notification) {
        return res.status(404).send();
    }

    res.send({notification});
  }).catch((e) => {
    res.status(400).send();
  })
});

function addPersonalNotifications(notification){
  let owner = notification.owner; //req.user._id;
  let notifType = notification.notifType;//req.body.notifType;
  //TODO: 'data' field should define its format for different logType (client)
  let data = notification.data; //req.body.data;
  const personalNotifications = new PersonalNotifications({
    owner,
    notifType,
    data
  });
  personalNotifications.save().then((doc) => {
    //res.send(doc);
  }, (e) => {
    //res.status(400).send(e);
  });
}

app.post('/personal_notifications', authenticate, (req, res) => {
  let owner = req.user._id;
  let notifType = req.body.notifType;
  //TODO: 'data' field should define its format for different logType (client)
  let data = req.body.data;
  const personalNotifications = new PersonalNotifications({
    owner,
    notifType,
    data
  });
  personalNotifications.save().then((doc) => {
    res.send(doc);
  }, (e) => {
    res.status(400).send(e);
  });
});

//app.set('view engine', 'jade');

app.listen(port, () => {
  console.log(`Started up at port ${port}`);
});

module.exports = {app};
