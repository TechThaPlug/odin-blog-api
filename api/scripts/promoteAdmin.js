const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();

  if (!email) {
    throw new Error("Usage: npm run admin:promote -- user@example.com");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error(
      `No account found for ${email}. Register the account first.`,
    );
  }

  if (user.role === "ADMIN") {
    console.log(`${email} is already an administrator.`);
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
    },
  });

  console.log("Administrator account successfully created:");
  console.log(updatedUser);
}

main()
  .catch((error) => {
    console.error("Admin promotion failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
