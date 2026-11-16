const express = require("express");

const {
  listPublishedPosts,
  getPublishedPost,
} = require("../controllers/postController");

const { authenticateToken } = require("../middleware/authMiddleware");
const { createComment } = require("../controllers/commentController");

const router = express.Router();

router.get("/", listPublishedPosts);
router.post("/:postId/comments", authenticateToken, createComment);
router.get("/:slug", getPublishedPost);

module.exports = router;
