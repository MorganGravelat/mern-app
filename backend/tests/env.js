// Runs before the tests (see "test" in package.json).
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.PUBLIC_URL = 'http://api.test';
process.env.APP_URL = 'http://app.test';
