const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

// Random token for an email link, and the hash that we save in the database.
function createEmailToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// tv is the user's tokenVersion. If it doesn't match anymore the token is no good.
function issueTokens(user) {
  const claims = { sub: user._id.toString(), role: user.role, tv: user.tokenVersion };
  return {
    accessToken: jwt.sign({ ...claims, type: 'access' }, config.jwtAccessSecret, { expiresIn: config.accessTokenTtl }),
    refreshToken: jwt.sign({ ...claims, type: 'refresh' }, config.jwtRefreshSecret, { expiresIn: config.refreshTokenTtl })
  };
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.jwtAccessSecret);
  if (payload.type !== 'access') throw new Error('Not an access token');
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwtRefreshSecret);
  if (payload.type !== 'refresh') throw new Error('Not a refresh token');
  return payload;
}

module.exports = { createEmailToken, hashToken, issueTokens, verifyAccessToken, verifyRefreshToken };
