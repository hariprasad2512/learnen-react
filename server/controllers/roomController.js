const { mongoose, set } = require('mongoose');
require('dotenv').config();
const Room = require('../models/RoomModel');
const User = require('../models/UserModel');
const Report = require('../models/ReportModel');
const redis = require("redis");
const {createClient} = require('redis');


const redisClient = createClient({
    password: process.env.REDIS_PASSWORD || undefined,
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379
    }
});

(async () => {

  redisClient.on("error", (error) => console.error(`Error : ${error}`));

  await redisClient.connect();
})();

const DEFAULT_EXPIRATION = 3600;

const setCache = (key, value) => {
    redisClient.setEx(key, DEFAULT_EXPIRATION, JSON.stringify(value));
};

const clearCache = (key) => {
    redisClient.del(key);
};

// Function to clear and set cache
const updateCache = async (key, value) => {
    await clearCache(key);
    setCache(key, value);
};

const adminRoomList = async (req, res , next) => {
    if (true) {
        try {
            const rooms = await Room.find().populate('mentor.user');
            const roomsWithMentors = await Promise.all(rooms.map(async (room) => {
                const mentor = room.mentor.user;
                const mentorDetails = await User.findById(mentor);

                return {
                    ...room.toObject(),
                    mentor: mentorDetails,
                };
            }));
            const users = await User.find();
            res.status(200).json({ Rooms: roomsWithMentors, users: users });
        } catch (err) {
            console.log(err);
            res.status(500).json({ error: "Could not fetch rooms" });
            next(err);
        }
    } else {
        res.status(500).json({ error: "Not an admin" });
        return;
    }
};

const buyCourse = async (req, res,next) => {
    const userId = req.body.userId;
    const roomId = req.body.roomId;
    try {
        const room = await Room.findById(roomId);
        const user = await User.findById(userId);
        if (!room || !user) {
            res.status(404).json({ error: "Room or User not found" });
            return;
        }
        const userCourses = user.Joined_Room;
        const roomParticipants = room.participants;
        if (userCourses.includes(roomId) || roomParticipants.includes(userId)) {
            res.status(400).json({ error: "User already in course" });
            return;
        }

        userCourses.push(roomId);
        roomParticipants.push(userId);
        user.Joined_Room = userCourses;
        room.participants = roomParticipants;
        
        await user.save();
        await room.save();
        updateCache("courses", await Room.find()); // Clear and update cache
        res.status(200).json({ message: "Course added successfully" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Could not add course" });
        next(err);
    }
};

const getCourses = async (req, res,next) => {
    const { userId } = req.session.user;
    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const userCourses = user.Joined_Room;
        const courses = await Room.find({ _id: { $in: userCourses } });
        res.status(200).json({ courses: courses });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Could not fetch courses" });
        next(err);
    }
};
const getCourse = async (req, res,next) => {
    const courseId = req.query.courseId;
    try {
        const room = await Room.findById(courseId);
        if (!room) {
            res.status(404).json({ error: "Course not found" });
            return;
        }
        const mentor = await User.findById(room.mentor.user);
        res.status(200).json({ course: room , mentor: mentor });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Could not fetch courses" });
        next(err);
    }
};

const getExploreCourses = async (req, res,next) => {
    try {
        const cachedCourses = await redisClient.get("courses");
        if (cachedCourses) {
            res.status(200).json({ courses: JSON.parse(cachedCourses) });
            return;
        } else {
            const courses = await Room.find();
            setCache("courses", courses);
            res.status(200).json({ courses: courses });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Could not fetch courses" });
        next(err);
    }
};

const addRoom = async (req, res,next) => {
    const { roomTitle , price , meetLink , skills , description , userId } = req.body;
    try {
        const cachedCreatedCourses = await redisClient.get("courses");
        if (cachedCreatedCourses) {
            await redisClient.del("createdCourses");
            await redisClient.del("courses");
        }
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const room = new Room({
            title:roomTitle,
            price,
            meetlink:meetLink,
            skills,
            description,
            mentor: {
                user: userId
            }
        });
        await room.save();
        user.Created_Room.push(room._id);
        await user.save();
        updateCache("createdCourses", await Room.find({ _id: { $in: user.Created_Room } })); 
        updateCache("courses", await Room.find());
        res.status(200).json({ message: "Room added successfully" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Could not add room" });
        next(err);
    }
};   

const getCreatedCourses = async (req, res,next) => {
    const  userId  = req.body.userId;
    try {
        const user = await User.findById(userId)
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        else{
            const user = await User.findById(userId)
            if (!user) {
                res.status(404).json({ error: "User not found" });
                return;
            }
            const userCourses = user.Created_Room;
            const courses = await Room.find({ _id: { $in: userCourses } });
            setCache("createdCourses", courses);
            res.status(200).json({ courses: courses });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Could not fetch courses" });
        next(err);
    }
};

const getJoinedCourses = async (req, res,next) => {
    const  userId  = req.body.userId;
    try {
        const user = await User.findById(userId)
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        else{
            const user = await User.findById(userId)
            if (!user) {
                res.status(404).json({ error: "User not found" });
                return;
            }
            const userCourses = user.Joined_Room;
            const courses = await Room.find({ _id: { $in: userCourses } });
            setCache("joinedCourses", courses);
            res.status(200).json({ courses: courses });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Could not fetch courses" });
        next(err);
    }
};

const submitReports = async (req, res, next) => {
    const { userId, userName, courseId, courseName, subject, message } = req.body;
    try {
      const report = new Report({
        title: subject,
        description: message,
        userName: userName,
        userId: userId,
        courseId: courseId,
        courseName: courseName,
      });
      await report.save();
      const room = await Room.findById(courseId);
      if (!room) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      room.reports.push(report._id);
      await room.save();
      res.status(200).json({ message: "Report submitted successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Could not submit report" });
      next(err);
    }
};
  
const getReports = async (req, res, next) => {
    try {
      const reports = await Report.find();
      res.status(200).json({ reports:reports });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Could not submit report" });
      next(err);
    }
};

module.exports = {
    adminRoomList,
    buyCourse,
    getCourses,
    getExploreCourses,
    addRoom,
    getCreatedCourses,
    getCourse,
    getJoinedCourses,
    submitReports,
    getReports,
    redisClient
};
