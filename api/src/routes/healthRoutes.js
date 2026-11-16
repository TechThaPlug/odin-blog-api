const express = require("express");
const prisma = require("../config/prisma");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    // Confirm that the API can communicate with PostgreSQL.
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "Blog API is running successfully.",
      database: "Connected",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
