const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const adminRoutes = require("./routes/adminRoutes");
const healthRoutes = require("./routes/healthRoutes");

const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/errorHandler");

const app = express();

// Security and request middleware.
app.use(helmet());

app.use(
  cors({
    origin: [
      "http://localhost:5500",
      "http://127.0.0.1:5500",
    ],
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));

// Welcome route.
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to the Blog API.",
  });
});

// API routes.
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/admin", adminRoutes);

// Error handling.
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
