const app = require('./app');
const config = require('./config');
const db = require('./db');

async function main() {
  await db.connect();
  console.log('Connected to MongoDB');
  app.listen(config.port, () => {
    console.log(`API listening on port ${config.port} (${config.env})`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
