module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js', '<rootDir>/tests/routes/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/controllers/**/*.js', 'src/routes/**/*.js', 'src/middleware/**/*.js',
    'src/utils/**/*.js', 'src/app.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'json-summary', 'lcov'],
};
