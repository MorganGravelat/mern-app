const mongoose = require('mongoose');
const config = require('./config');

// Atlas needs TLS, so turn it on for any database that isn't local.
// The local Docker database has no certificate, so it can't use TLS.
function connectionOptions(uri) {
  const isLocal = /^mongodb:\/\/(localhost|127\.0\.0\.1|mongodb)(:|\/)/.test(uri);
  return isLocal ? {} : { tls: true };
}

async function connect(uri = config.mongoUri) {
  await mongoose.connect(uri, connectionOptions(uri));
  return mongoose.connection;
}

module.exports = { connect, connectionOptions };
