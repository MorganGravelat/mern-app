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
│   │   ├── routes/workorders.js  list/search/filter, detail, create, edit/assign/status/checklist, delete
│   │   ├── routes/users.js  technician list for the assignment dropdown
│   │   ├── middleware/      requireAuth / requireRole, input validation, error handling
│   │   └── utils/           JWT + email-token helpers, email sending (Resend), work order rules, order numbers
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
├── web/                     React website (Vite + TypeScript): auth, work order list, detail, create/edit
│   ├── src/api.ts           fetch wrapper and error handling
│   ├── src/auth/            small login context (tokens kept in memory)
│   ├── src/pages/           one file per screen
│   ├── src/workOrders/      work order types and small helpers
│   └── src/components/      layout, protected routes, form fields, assign form
└── mobile/                  Flutter app (Dart): same screens as the website, same API
    ├── lib/services/        small HTTP service, session state, work order calls
    ├── lib/screens/         auth screens, work order list/detail/form
    └── test/                unit and widget tests (flutter test)
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
- Test logins: `amoreno` (admin), `dchen` (dispatcher), `sramirez` and `kokafor` (technicians), all with password `Password123!`. `mjohnson` and `hlee` are technicians marked unavailable in the seed data, so they do not appear in the "Assign" list.
- With no `RESEND_API_KEY`, verification and reset emails are printed in the terminal running `npm run dev`.

### Web app

In `backend/.env` set `APP_URL=http://localhost:5173` and `CORS_ORIGINS=http://localhost:5173` (see `.env.example`), then restart the API.

```bash
cd web
npm install
npm run dev                   # http://localhost:5173
```

The API address defaults to `http://localhost:5000`; copy `web/.env.example` to `web/.env` to change it. Login tokens are kept in memory only, so reloading the page means logging in again. The email verification link opens the API and shows a short JSON message; return to the web login page afterwards.

> The users collection gained new fields (for email verification and password reset), so an existing local database **must be reset** with `npm run db:reset`. Otherwise MongoDB's validator rejects new sign-ups.

## Tests

```bash
cd backend
npm test

cd ../web
npm test                      # React screens and login logic (Vitest)
npm run build                 # type-checks and builds

cd ../mobile
flutter analyze               # needs the Flutter SDK, see mobile/README.md
flutter test
```

