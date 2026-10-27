const { ApiError } = require('./errors');

// Checks req.body against a zod schema. If it passes, req.body is replaced
// with the cleaned up version (trimmed, lowercased, etc.).
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', details);
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
