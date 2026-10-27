const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const config = require('./config');
const authRoutes = require('./routes/auth');
const { notFound, errorHandler } = require('./middleware/errors');

const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));

const app = express();

app.set('trust proxy', 1); // Caddy is in front of the API, so use the real client ip

// Swagger docs. These go before helmet() because helmet's default security
// policy breaks Swagger when the site is on http.
app.get('/api/openapi.json', (req, res) => res.json(openapi));
app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapi));

app.use(helmet());
app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'up' : 'down';
  res.status(db === 'up' ? 200 : 503).json({ status: db === 'up' ? 'ok' : 'degraded', db });
});

app.use('/api/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
