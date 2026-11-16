const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { createComment } = require("../controllers/commentController");

const router = express.Router();

router.post("/:postId/comments", authenticateToken, createComment);

module.exports = router;
