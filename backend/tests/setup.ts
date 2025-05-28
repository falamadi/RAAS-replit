// Test environment setup
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock database connection
jest.mock('../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  },
}));

// Mock Redis connection
jest.mock('../src/config/redis', () => ({
  redisClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    hGet: jest.fn(),
    hSet: jest.fn(),
    hDel: jest.fn(),
    sAdd: jest.fn(),
    sRemove: jest.fn(),
    sMembers: jest.fn(),
  },
}));

// Mock Elasticsearch
jest.mock('../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn(),
    search: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    bulk: jest.fn(),
  },
}));

// Global test utilities
global.mockClear = () => {
  jest.clearAllMocks();
};

// Increase timeout for async operations
jest.setTimeout(10000);
