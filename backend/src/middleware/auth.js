const { User } = require('../../models');
const { verifyAccessToken } = require('../utils/tokens');
const { ApiError } = require('./errors');

// Requires "Authorization: Bearer <accessToken>". Loads the user into req.user
// and rejects tokens issued before a logout or password reset.
async function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Missing access token');
  }
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Access token is invalid or expired');
  }
  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Access token has been revoked');
  }
  req.user = user;
  next();
}

// Use after requireAuth: requireRole('admin', 'dispatcher')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to do that');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
