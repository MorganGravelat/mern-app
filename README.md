# IT Work Order App (MERN)

A Jira-style work order system for an IT services company. Admins and dispatchers create work orders, dispatchers assign them to technicians, and technicians complete them through a web dashboard (React) and a mobile app.

## Project layout

```text
mern-app/
├── backend/            Express API + MongoDB (database is set up; API coming next)
│   ├── docker-compose.yml
│   ├── mongo-init.js   creates collections, validation, indexes, and test data
│   └── models/         Mongoose models: User, WorkOrder
├── docs/
│   └── DATABASE.md     schema, ERD, design decisions, demo steps
└── (frontend/, mobile/ later)
```

## Quick start (database)

```bash
cd backend
docker compose up -d
```

Then connect MongoDB Compass to `mongodb://localhost:27017` and open **WorkOrderDB**. See [docs/DATABASE.md](docs/DATABASE.md) for details.
