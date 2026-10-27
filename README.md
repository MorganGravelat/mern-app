# IT Work Order App (MERN)

A Jira-style work order system for an IT services company. Admins and dispatchers create work orders, dispatchers assign them to technicians, and technicians complete them through a web dashboard (React) and a mobile app (Flutter).

## Project layout

```text
mern-app/
├── backend/                 Express API + MongoDB
│   ├── src/
│   │   ├── server.js        starts the API (connects to MongoDB, listens on PORT)
│   │   ├── app.js           Express app: security headers, routes, Swagger docs
│   │   ├── routes/auth.js   register, verify email, login, refresh, logout, forgot/reset password, me
│   │   ├── middleware/      requireAuth / requireRole, input validation, error handling
│   │   └── utils/           JWT + email-token helpers, email sending (Resend)
│   ├── models/              Mongoose models: User, WorkOrder
│   ├── tests/               one test group per endpoint (npm test)
│   ├── openapi.yaml         API description, served at /api/docs and used for SwaggerHub
│   ├── mongo-init.js        creates collections, validation, indexes, and test data
│   ├── docker-compose.yml       local: MongoDB (+ the API if you want)
│   ├── docker-compose.prod.yml  server: API + Caddy (HTTPS), database on Atlas
│   └── Dockerfile, Caddyfile
├── docs/
│   ├── DATABASE.md          schema, ERD, design decisions
│   ├── DEPLOY.md            droplet setup + Friday lab walkthrough
│   └── postman/             Postman collection for the API
└── (web/, mobile/ later)
```

## Run it locally

```bash
cd backend
cp .env.example .env          # then fill in JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
npm install
npm run db:reset              # start MongoDB with a fresh copy of the test data
npm run dev                   # API on http://localhost:5000
```

- Health check: <http://localhost:5000/api/health>
- API docs (try requests in the browser): <http://localhost:5000/api/docs>
- Test logins: `amoreno` (admin), `dchen` (dispatcher), `mjohnson` (technician), all with password `Password123!`
- With no `RESEND_API_KEY`, verification and reset emails are printed in the terminal running `npm run dev`.

> The users collection gained new fields (for email verification and password reset), so an existing local database **must be reset** with `npm run db:reset`. Otherwise MongoDB's validator rejects new sign-ups.

## Tests

```bash
cd backend
npm test
```

The tests use a throwaway in-memory MongoDB, which is downloaded automatically the first time. They don't touch your Docker database. GitHub Actions runs them on every push (`.github/workflows/backend-tests.yml`).

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md).
