const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const User = require('../models/UserModel');
const Room = require('../models/RoomModel');
const Assignment = require('../models/AssignmentModel');
const Resource = require('../models/ResourceModel');
const Schedule = require('../models/ScheduleModel');
const Routes = require('../routes/Route')
const {redisClient} = require('../controllers/roomController')

const app = express();
beforeAll(async () => {
    const mongoDBUrl = process.env.MONGO_URL || "mongodb://localhost:27017/learnen_test";

    await mongoose.connect(mongoDBUrl, { useNewUrlParser: true, useUnifiedTopology: true });
}, 30000); 


app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

app.use(express.json());


app.use('/', Routes);


describe('User Routes', () => {
  let testUser;

  it('should register a new user', async () => {
    const response = await request(app)
      .post('/signup')
      .send({
        signupname: 'Test User',
        signupemail: 'test@example.com',
        signuppass: 'Test123@',
        phonenumber: '1234567890',
        securityquestion: 'Security Question',
        securityanswer: 'Security Answer'
      });

    expect(response.statusCode).toBe(200);

    
    testUser = await User.findOne({ email: 'test@example.com' });
    expect(testUser).toBeTruthy();
  });

  it('should log in a user', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        email: 'test@example.com',
        password: 'Test123@'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.email).toBe('test@example.com');
  });

  it('should log out a user', async () => {
    const response = await request(app)
      .get('/logout');

    expect(response.statusCode).toBe(200);
  });
});

describe('Room Routes', () => {
  let testUser;
  let testRoom;

  beforeAll(async () => {
    // Create the test user before all tests in this suite
    testUser = new User({
      userName: 'Test User',
      email: 'test2@example.com',
      password: 'Test123@',
      phoneNumber: '1234567890',
      Security_Question: 'Security Question',
      Security_Answer: 'Security Answer',
      Joined_Room: [],
      Created_Room: [],
      Position: "mentor",
      Tags: []
    });
  
    await testUser.save();
  });


  beforeEach(async () => {
  
    testRoom = new Room({
      title: 'Test Room',
      price: 100,
      meetlink: 'https://example.com/meet',
      skills: ['Test Skill'],
      description: 'Test Description',
      mentor: {
        user: testUser._id
      }
    });
  
    await testRoom.save();
  });
  

  it('should add a new room', async () => {
    const response = await request(app)
      .post('/addroom')
      .send({
        roomTitle: 'New Room',
        price: 200,
        meetLink: 'https://example.com/new-meet',
        skills: ['New Skill'],
        description: 'New Description',
        userId: testUser._id
      });

    expect(response.statusCode).toBe(200);

    const room = await Room.findOne({ title: 'New Room' });
    expect(room).toBeTruthy();
  });

  it('should get a courses', async () => {
    const response = await request(app)
    .get(`/getCourse?courseId=${testRoom._id}`)

    expect(response.statusCode).toBe(200);
  });

  it('should get explore courses', async () => {
    const response = await request(app)
      .get('/explorecourses');

    expect(response.statusCode).toBe(200);
    expect(response.body.courses.length).toBeGreaterThan(0);
  });

  it('should buy a course', async () => {
    const response = await request(app)
      .post('/buycourse')
      .send({
        userId: testUser._id,
        roomId: testRoom._id
      });

    expect(response.statusCode).toBe(200);

    const user = await User.findById(testUser._id);
    const room = await Room.findById(testRoom._id);
    expect(user.Joined_Room).toContainEqual(testRoom._id);
    const participantIds = room.participants.map(participant => participant._id);
    expect(participantIds).toContainEqual(testUser._id);
  });

  it('should get created courses', async () => {
    const response = await request(app)
      .post('/getcreatedcourses')
      .send({ userId: testUser._id });

    expect(response.statusCode).toBe(200);
    expect(response.body.courses.length).toBeGreaterThan(0);
  });

  it('should get joined courses', async () => {
    
    await testUser.Joined_Room.push(testRoom._id);
    await testUser.save();

    const response = await request(app)
      .post('/getjoinedcourses')
      .send({ userId: testUser._id });

    expect(response.statusCode).toBe(200);
    expect(response.body.courses.length).toBeGreaterThan(0);
  });

  it('should get admin Room List', async () => {
    const response = await request(app)
      .get('/adminRooms');

    expect(response.statusCode).toBe(200);
  }
  );
});

describe('Assignment Routes', () => {
  let testRoom;
  let testAssignment;

  beforeAll(async () => {

    testUser = new User({
      userName: 'Test User',
      email: 'test3@example.com',
      password: 'Test123@',
      phoneNumber: '1234567890',
      Security_Question: 'Security Question',
      Security_Answer: 'Security Answer',
      Joined_Room: [],
      Created_Room: [],
      Position: "mentor",
      Tags: []
    });
  
    await testUser.save();
    testRoom = new Room({
      title: 'Test Room',
      price: 100,
      meetlink: 'https://example.com/meet',
      skills: ['Test Skill'],
      description: 'Test Description',
      mentor: {
        user: testUser._id
      }
    });

    await testRoom.save();
  })
  
  beforeEach(async () => {
    

    // Create a test assignment
    testAssignment = new Assignment({
      title: 'Test Assignment',
      deadline: new Date(),
      link: 'https://example.com/assignment',
    });

    await testAssignment.save();
  });

  it('should create a new assignment', async () => {
    const response = await request(app)
      .post('/addassignment')
      .send({
        title: 'New Assignment',
        deadline: new Date(),
        link: 'https://example.com/new-assignment',
        courseId: testRoom._id
      });

    expect(response.statusCode).toBe(201);

    const room = await Room.findById(testRoom._id);
    expect(room.assignment.length).toBe(1);
  });

  it('should get all assignments', async () => {
    const response = await request(app)
      .get('/getassignments');

    expect(response.statusCode).toBe(200);
    expect(response.body.assignments.length).toBeGreaterThan(0);
  });

  it('should get assignments by course', async () => {
    const response = await request(app)
      .post('/getcourseassignments')
      .send({ courseId: testRoom._id });

    expect(response.statusCode).toBe(200);
    expect(response.body.assignments.length).toBe(1);
  });

  it('should get assignments joined by user', async () => {
    const response = await request(app)
      .post('/getAssignmentsJoined')
      .send({ joinedRooms: [testRoom._id] });

    expect(response.statusCode).toBe(200);
    expect(response.body.assignments.length).toBeGreaterThan(0);
  });
});

describe('Resource Routes', () => {
  let testRoom;
  let testResource;

  beforeAll(async () => {

    testUser = new User({
      userName: 'Test User',
      email: 'test4@example.com',
      password: 'Test123@',
      phoneNumber: '1234567890',
      Security_Question: 'Security Question',
      Security_Answer: 'Security Answer',
      Joined_Room: [],
      Created_Room: [],
      Position: "mentor",
      Tags: []
    });
  
    await testUser.save();
    testRoom = new Room({
      title: 'Test Room',
      price: 100,
      meetlink: 'https://example.com/meet',
      skills: ['Test Skill'],
      description: 'Test Description',
      mentor: {
        user: testUser._id
      }
    });

    await testRoom.save();
  })


  beforeEach(async () => {
    // Create a test room
    

    // Create a test resource
    testResource = new Resource({
      title: 'Test Resource',
      description: 'Test Description',
      link: 'https://example.com/resource',
    });

    await testResource.save();
  });

  it('should add a new resource', async () => {
    const response = await request(app)
      .post('/addresource')
      .send({
        title: 'New Resource',
        description: 'New Description',
        link: 'https://example.com/new-resource',
        courseId: testRoom._id
      });

    expect(response.statusCode).toBe(201);

    const room = await Room.findById(testRoom._id);
    expect(room.resource.length).toBe(1);
  });

  it('should get resources by course', async () => {
    const response = await request(app)
      .post('/getresources')
      .send({ courseId: testRoom._id });

    expect(response.statusCode).toBe(200);
    expect(response.body.resources.length).toBe(1);
  });

  it('should get resources joined by user', async () => {
    const response = await request(app)
      .post('/getresourcesJoined')
      .send({ joinedRooms: [testRoom._id] });

    expect(response.statusCode).toBe(200);
    expect(response.body.resources.length).toBeGreaterThan(0);
  });
});


describe('Schedule Routes', () => {
  let testRoom;
  let testSchedule;

  beforeAll(async () => {

    testUser = new User({
      userName: 'Test User',
      email: 'test5@example.com',
      password: 'Test123@',
      phoneNumber: '1234567890',
      Security_Question: 'Security Question',
      Security_Answer: 'Security Answer',
      Joined_Room: [],
      Created_Room: [],
      Position: "mentor",
      Tags: []
    });
  
    await testUser.save();
    testRoom = new Room({
      title: 'Test Room',
      price: 100,
      meetlink: 'https://example.com/meet',
      skills: ['Test Skill'],
      description: 'Test Description',
      mentor: {
        user: testUser._id
      }
    });

    await testRoom.save();
  })

  beforeEach(async () => {
    testSchedule = new Schedule({
      title: 'Test Schedule',
      time: new Date(),
      link: 'https://example.com/schedule',
    });

    await testSchedule.save();
  });

  it('should add a new schedule', async () => {
    const response = await request(app)
      .post('/addschedule')
      .send({
        title: 'New Schedule',
        time: new Date(),
        link: 'https://example.com/new-schedule',
        courseId: testRoom._id
      });

    expect(response.statusCode).toBe(201);

    const room = await Room.findById(testRoom._id);
    expect(room.schedule.length).toBe(1);
  });

  it('should get schedule by course', async () => {
    const response = await request(app)
      .post('/getSchedulesByCourse')
      .send({ courseId: testRoom._id });

    expect(response.statusCode).toBe(200);
    expect(response.body.schedules.length).toBe(1);
  });

  it('should get schedule', async () => {
    const response = await request(app)
      .post('/getSchedule')
      .send({ 
        joinedRooms: [testRoom._id],
        createdRooms: [testRoom._id]
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.schedules.length).toBeGreaterThan(0);
  });
});




afterAll(async () => {
  await User.deleteMany({});
  await Room.deleteMany({});
  await mongoose.connection.close();
  redisClient.FLUSHALL()
  redisClient.quit();
}); 
