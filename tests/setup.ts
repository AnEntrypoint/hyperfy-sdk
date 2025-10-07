import 'jest';

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock WebSocket for Node.js environment
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: 1, // OPEN
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
}));

// Mock fetch for Node.js
global.fetch = jest.fn();

// Mock FormData for file uploads
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn(() => ({})),
    getLengthSync: jest.fn(() => 100),
  }));
});

// Set test environment variables
process.env.NODE_ENV = 'test';