# The Odin Blog

A full-stack blog application built with Node.js, Express, PostgreSQL, Prisma and JavaScript.

## Features

- User registration and login
- JWT authentication
- Role-based admin access
- Create, edit, publish and delete articles
- Public article browsing
- Reader comments
- Admin comment moderation
- Password hashing and API security
- PostgreSQL database with Prisma ORM

## Technologies

- Node.js and Express
- PostgreSQL
- Prisma ORM
- JWT and bcrypt
- HTML, CSS and JavaScript

## Project Structure

- api/ — Backend REST API
- reader/ — Public blog website
- admin/ — Admin dashboard

## Local Setup

1. Clone this repository.
2. Open the api folder.
3. Install dependencies:

   npm install

4. Create an api/.env file with DATABASE_URL and JWT_SECRET.
5. Configure your PostgreSQL database.
6. Run database migrations:

   npx prisma migrate deploy

7. Start the API:

   npm run dev

8. Serve the project root with a local static server.

## Security

Never commit .env files, database credentials, JWT secrets or passwords.

## Author

Blog project built as part of The Odin Project.
