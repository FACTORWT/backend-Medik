"use strict";

const commonEnv = require("./common");

const devURLs = {
  backend: "http://localhost:8000",
  frontend: "http://localhost:3200",
  publicPics: "http://localhost:8000/uploads/publicPics",
};

const prodURLs = {
  backend: "https://ai-medik.com",
  frontend: "https://www.ai-medik.com",

  publicPics: "https://www.ai-medik.com/uploads/publicPics",
};

const allowedOrigins = [
  "https://ai-medik.com",
  "https://www.ai-medik.com",
  "http://localhost:3200",
  "http://localhost:8000",
  "http://10.0.2.2:3200",
];

const config = {
  ...commonEnv,
  allowedOrigins,
  ...(process.env.NODE_ENV === "production" ? prodURLs : devURLs),
};

module.exports = config;
