const prisma = require("../config/prisma");

// A signed-in reader can comment only on published articles.
async function createComment(req, res, next) {
  try {
    const { body } = req.body || {};
    const postId = req.params.postId;

    if (typeof body !== "string" || !body.trim() || body.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Comment must contain 1-5,000 characters.",
      });
    }

    const post = await prisma.post.findFirst({
      where: { id: postId, isPublished: true },
      select: { id: true },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Published post not found.",
      });
    }

    const comment = await prisma.comment.create({
      data: {
        body: body.trim(),
        postId,
        authorId: req.user.id,
        isApproved: false,
      },
      select: {
        id: true,
        body: true,
        isApproved: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Comment submitted and awaiting approval.",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
}

// Admin: list comments, including those awaiting approval.
async function listComments(req, res, next) {
  try {
    const comments = await prisma.comment.findMany({
      include: {
        author: { select: { username: true, email: true } },
        post: { select: { id: true, title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
}

// Admin: approve or unapprove a comment.
async function setCommentApproval(req, res, next) {
  try {
    const { isApproved } = req.body || {};

    if (typeof isApproved !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isApproved must be true or false.",
      });
    }

    const comment = await prisma.comment.update({
      where: { id: req.params.id },
      data: { isApproved },
    });

    res.json({
      success: true,
      message: isApproved ? "Comment approved." : "Comment unapproved.",
      data: comment,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }
    next(error);
  }
}

// Admin: delete a comment.
async function deleteComment(req, res, next) {
  try {
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Comment deleted." });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }
    next(error);
  }
}

module.exports = {
  createComment,
  listComments,
  setCommentApproval,
  deleteComment,
};
