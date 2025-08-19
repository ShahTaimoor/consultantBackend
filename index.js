// server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();
require("./config/passport"); // Import passport config

const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");

connectDB()

const app = express();


// Middlewares
const corsOptions = {
  origin: process.env.FRONTEND_URL, // your frontend's URL
  credentials: true, // allow cookies & auth headers
};
app.use(cors(corsOptions));

app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// API Routes
app.use('/api', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', assessmentRoutes);


// File upload (multer config)
const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (req, res) => {
  res.send('Welcome to the backend');
});

app.listen(process.env.PORT, () => {
  console.log(`✅ Server running on port ${process.env.PORT}`);
});
