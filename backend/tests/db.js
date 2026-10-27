const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Each test file uses its own temporary in-memory MongoDB.
let server;

async function start() {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

async function clear() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function stop() {
  await mongoose.disconnect();
  await server.stop();
}

module.exports = { start, clear, stop };
