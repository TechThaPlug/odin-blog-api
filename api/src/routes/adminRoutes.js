const express = require("express");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const {
  listAllPosts,
  createPost,
  updatePost,
  publishPost,
  unpublishPost,
  deletePost,
} = require("../controllers/postController");

const {
  listComments,
  setCommentApproval,
  deleteComment,
} = require("../controllers/commentController");

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get("/posts", listAllPosts);
router.post("/posts", createPost);
router.patch("/posts/:id", updatePost);
router.patch("/posts/:id/publish", publishPost);
router.patch("/posts/:id/unpublish", unpublishPost);
router.delete("/posts/:id", deletePost);

router.get("/comments", listComments);
router.patch("/comments/:id/approval", setCommentApproval);
router.delete("/comments/:id", deleteComment);

module.exports = router;
