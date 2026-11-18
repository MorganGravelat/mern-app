const { ApiError } = require('./errors');

// Checks data against a zod schema and returns the cleaned up version
// (trimmed, lowercased, etc.). Throws a 400 VALIDATION_ERROR if it doesn't fit.
function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      // Unknown fields have no path, so name them by the unexpected keys instead.
      field: i.path.join('.') || (i.keys ? i.keys.join(', ') : ''),
      message: i.message
    }));
    throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', details);
  }
  return result.data;
}

// Middleware version: req.body is replaced with the cleaned up version.
function validate(schema) {
  return (req, res, next) => {
    req.body = parse(schema, req.body);
    next();
  };
}

module.exports = { parse, validate };
