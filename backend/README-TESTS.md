# 🧪 Sistema de Testes - Lembrety Backend

Sistema completo de testes unitários e de integração configurado com Jest e TypeScript.

## 📋 Configuração

### Tecnologias Utilizadas
- **Jest** - Framework de testes
- **ts-jest** - Preset para TypeScript
- **Supertest** - Testes de integração HTTP
- **@types/jest** - Tipos TypeScript para Jest

### Estrutura dos Testes
```
backend/
├── tests/
│   ├── setup.ts                     # Configuração global dos testes
│   ├── example.test.ts               # Exemplo básico
│   ├── helpers/
│   │   └── testHelpers.ts           # Utilitários para testes
│   ├── unit/                        # Testes unitários
│   │   ├── services/                # Testes dos services
│   │   └── controllers/             # Testes dos controllers
│   └── integration/                 # Testes de integração
│       └── api.test.ts              # Testes das APIs
├── jest.config.js                   # Configuração do Jest
└── coverage/                        # Relatórios de cobertura (gerado)
```

## 🚀 Scripts de Teste

### Comandos Disponíveis
```bash
# Executar todos os testes
npm test

# Executar testes em modo watch (reexecuta quando arquivos mudam)
npm run test:watch

# Executar testes com relatório de cobertura
npm run test:coverage

# Executar apenas testes unitários
npm run test:unit

# Executar apenas testes de integração
npm run test:integration
```

### Exemplos de Uso
```bash
# Testar arquivo específico
npm test -- tests/example.test.ts

# Testar com padrão
npm test -- --testNamePattern="deve somar"

# Executar testes com verbose
npm test -- --verbose
```

## 📝 Escrevendo Testes

### Estrutura Básica
```typescript
describe('NomeDoModulo', () => {
  beforeEach(() => {
    // Setup antes de cada teste
    jest.clearAllMocks();
  });

  describe('nomeDaFuncao', () => {
    it('deve fazer algo específico', () => {
      // Arrange (preparar)
      const input = 'valor de teste';
      
      // Act (agir)
      const result = minhaFuncao(input);
      
      // Assert (verificar)
      expect(result).toBe('resultado esperado');
    });
  });
});
```

### Testando Services
```typescript
import { PrismaClient } from '@prisma/client';
import { meuService } from '../../../src/services/meuService';

jest.mock('@prisma/client');

describe('MeuService', () => {
  let prisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
  });

  it('deve criar um registro', async () => {
    // Arrange
    const mockData = { id: 'test', name: 'teste' };
    prisma.tabela.create.mockResolvedValue(mockData);

    // Act
    const result = await meuService.criar(mockData);

    // Assert
    expect(result).toEqual(mockData);
    expect(prisma.tabela.create).toHaveBeenCalledWith({
      data: mockData,
    });
  });
});
```

### Testando Controllers
```typescript
import { Request, Response } from 'express';
import { meuController } from '../../../src/controllers/meuController';

describe('MeuController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = { body: {} };
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };
  });

  it('deve retornar sucesso', async () => {
    // Arrange
    mockRequest.body = { nome: 'teste' };

    // Act
    await meuController(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith({ success: true });
  });
});
```

### Testes de Integração
```typescript
import request from 'supertest';
import app from '../../src/app';

describe('API Integration', () => {
  it('deve criar recurso via POST', async () => {
    const response = await request(app)
      .post('/api/recurso')
      .send({ nome: 'teste' })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.nome).toBe('teste');
  });
});
```

## 🎯 Mocking

### Mocks Globais (setup.ts)
Os seguintes mocks estão configurados globalmente:
- **PrismaClient** - Mock do banco de dados
- **axios** - Mock de requisições HTTP
- **node-cron** - Mock do agendador

### Mocks Específicos
```typescript
// Mock de um service específico
jest.mock('../../../src/services/meuService', () => ({
  minhaFuncao: jest.fn(),
}));

// Mock de função específica
const mockFuncao = jest.fn();
mockFuncao.mockReturnValue('valor mockado');
mockFuncao.mockResolvedValue(Promise.resolve('valor async'));
mockFuncao.mockRejectedValue(new Error('erro simulado'));
```

### Verificações Common
```typescript
// Verificar se foi chamado
expect(mockFuncao).toHaveBeenCalled();

// Verificar chamada com parâmetros específicos
expect(mockFuncao).toHaveBeenCalledWith('parametro');

// Verificar número de chamadas
expect(mockFuncao).toHaveBeenCalledTimes(2);

// Verificar ordem de chamadas
expect(mockFuncao).toHaveBeenNthCalledWith(1, 'primeiro');
expect(mockFuncao).toHaveBeenNthCalledWith(2, 'segundo');
```

## 📊 Cobertura de Código

### Visualizar Cobertura
```bash
npm run test:coverage
```

### Relatórios Gerados
- **Terminal**: Resumo da cobertura
- **coverage/lcov-report/index.html**: Relatório HTML detalhado
- **coverage/lcov.info**: Formato LCOV para CI/CD

### Metas de Cobertura
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## 🔧 Configuração Avançada

### Variáveis de Ambiente para Testes
```env
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/test_lembrety
EVOLUTION_API_URL=https://test-evolution-api.com
EVOLUTION_API_KEY=test-api-key
WHATSAPP_INSTANCE=test-instance
```

### Executar Testes em CI/CD
```bash
# GitHub Actions exemplo
npm ci
npm run test:coverage
```

## 🐛 Debugging

### Debuggar Testes
```bash
# Executar com debugging
node --inspect-brk node_modules/.bin/jest --runInBand tests/meuTeste.test.ts

# Log detalhado
DEBUG=* npm test
```

### Problemas Comuns

1. **Mocks não funcionam**
   - Verificar se o mock está no lugar correto
   - Usar `jest.clearAllMocks()` no `beforeEach`

2. **Timeouts**
   - Aumentar timeout: `jest.setTimeout(10000)`
   - Verificar promises não resolvidas

3. **Imports/Modules**
   - Verificar paths relativos
   - Usar `moduleNameMapper` no jest.config.js

## 📚 Recursos Úteis

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

## 🎯 Próximos Passos

1. Implementar testes para todos os services
2. Adicionar testes de integração completos
3. Configurar testes E2E com banco real
4. Integrar com CI/CD pipeline
5. Adicionar mutation testing 