// Global test setup
import { jest } from '@jest/globals';

// Mock do PrismaClient
const mockPrismaClient = {
  reminder: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Mock do axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Mock do node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

// Configurações de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_lembrety';
process.env.EVOLUTION_API_URL = 'https://test-evolution-api.com';
process.env.EVOLUTION_API_KEY = 'test-api-key';
process.env.WHATSAPP_INSTANCE = 'test-instance';

// Cleanup após cada teste
afterEach(() => {
  jest.clearAllMocks();
}); 