module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
};
