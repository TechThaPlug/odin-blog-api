const prisma = require("../config/prisma");

// Convert article titles into URL-friendly slugs.
function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// Generate a unique slug, including when another post uses the same title.
async function createUniqueSlug(title, excludeId) {
  const base = slugify(title) || `post-${Date.now()}`;
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.post.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function getPagination(query) {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedLimit = Number.parseInt(query.limit, 10);

  const page = Number.isSafeInteger(requestedPage)
    ? Math.max(1, requestedPage)
    : 1;

  const limit = Number.isSafeInteger(requestedLimit)
    ? Math.min(20, Math.max(1, requestedLimit))
    : 10;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

// GET /api/posts
// Public: return published articles only.
async function listPublishedPosts(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const where = { isPublished: true };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          createdAt: true,
          author: {
            select: { username: true },
          },
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/posts/:slug
// Public: unpublished articles must never be returned.
async function getPublishedPost(req, res, next) {
  try {
    const post = await prisma.post.findFirst({
      where: {
        slug: req.params.slug,
        isPublished: true,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        createdAt: true,
        author: {
          select: { username: true },
        },
        comments: {
          where: { isApproved: true },
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: {
              select: { username: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Published post not found.",
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/posts
// Admin only: include drafts and published posts.
async function listAllPosts(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        include: {
          author: {
            select: { username: true, email: true },
          },
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.post.count(),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/admin/posts
// Admin only: create a new draft.
async function createPost(req, res, next) {
  try {
    const { title, excerpt, content } = req.body || {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Title is required and must not exceed 180 characters.",
      });
    }

    if (
      typeof content !== "string" ||
      !content.trim() ||
      content.length > 100000
    ) {
      return res.status(400).json({
        success: false,
        message: "Content is required and must not exceed 100,000 characters.",
      });
    }

    if (
      excerpt !== undefined &&
      excerpt !== null &&
      (typeof excerpt !== "string" || excerpt.trim().length > 300)
    ) {
      return res.status(400).json({
        success: false,
        message: "Excerpt must not exceed 300 characters.",
      });
    }

    const slug = await createUniqueSlug(title.trim());

    const post = await prisma.post.create({
      data: {
        title: title.trim(),
        slug,
        excerpt: excerpt?.trim() || null,
        content: content.trim(),
        isPublished: false,
        publishedAt: null,
        authorId: req.user.id,
      },
      include: {
        author: {
          select: { username: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Draft created successfully.",
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/posts/:id
// Admin only: edit a draft or published article.
async function updatePost(req, res, next) {
  try {
    const { title, excerpt, content } = req.body || {};
    const data = {};

    if (title !== undefined) {
      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 180
      ) {
        return res.status(400).json({
          success: false,
          message: "Title must contain 1-180 characters.",
        });
      }

      data.title = title.trim();
      data.slug = await createUniqueSlug(title.trim(), req.params.id);
    }

    if (content !== undefined) {
      if (
        typeof content !== "string" ||
        !content.trim() ||
        content.length > 100000
      ) {
        return res.status(400).json({
          success: false,
          message: "Content must contain 1-100,000 characters.",
        });
      }

      data.content = content.trim();
    }

    if (excerpt !== undefined) {
      if (
        excerpt !== null &&
        (typeof excerpt !== "string" || excerpt.trim().length > 300)
      ) {
        return res.status(400).json({
          success: false,
          message: "Excerpt must not exceed 300 characters.",
        });
      }

      data.excerpt = excerpt?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data,
      include: {
        author: {
          select: { username: true },
        },
      },
    });

    res.json({
      success: true,
      message: "Post updated successfully.",
      data: post,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A post with that slug already exists.",
      });
    }

    next(error);
  }
}

// PATCH /api/admin/posts/:id/publish
async function publishPost(req, res, next) {
  try {
    const existing = await prisma.post.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        isPublished: true,
        publishedAt: existing.publishedAt || new Date(),
      },
    });

    res.json({
      success: true,
      message: "Post published successfully.",
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/admin/posts/:id/unpublish
async function unpublishPost(req, res, next) {
  try {
    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    });

    res.json({
      success: true,
      message: "Post unpublished successfully.",
      data: post,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    next(error);
  }
}

// DELETE /api/admin/posts/:id
async function deletePost(req, res, next) {
  try {
    await prisma.post.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: "Post deleted successfully.",
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    next(error);
  }
}

module.exports = {
  listPublishedPosts,
  getPublishedPost,
  listAllPosts,
  createPost,
  updatePost,
  publishPost,
  unpublishPost,
  deletePost,
};
