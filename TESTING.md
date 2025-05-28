# RaaS Platform Testing Guide

## Overview

The RaaS platform has a comprehensive testing suite covering unit tests, integration tests, and component tests to ensure reliability and maintainability.

## Testing Stack

### Backend Testing
- **Framework**: Jest with TypeScript
- **Coverage Target**: 80% (branches, functions, lines, statements)
- **Test Types**: Unit tests, Integration tests
- **Key Libraries**: 
  - `jest` - Testing framework
  - `ts-jest` - TypeScript support
  - `supertest` - API testing
  - `jest-mock-extended` - Enhanced mocking

### Frontend Testing
- **Framework**: Jest with React Testing Library
- **Coverage Target**: 75% (branches, functions, lines, statements)
- **Test Types**: Component tests, Integration tests
- **Key Libraries**:
  - `@testing-library/react` - React component testing
  - `@testing-library/jest-dom` - DOM matchers
  - `@testing-library/user-event` - User interaction simulation

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

## Test Structure

### Backend Test Organization
```
backend/
├── tests/
│   ├── unit/
│   │   └── services/
│   │       ├── auth.service.test.ts
│   │       ├── job.service.test.ts
│   │       └── matching.service.test.ts
│   ├── integration/
│   │   └── auth.test.ts
│   ├── utils/
│   │   └── test-helpers.ts
│   └── setup.ts
├── jest.config.js
└── .env.test
```

### Frontend Test Organization
```
frontend/
├── src/
│   ├── components/
│   │   └── __tests__/
│   │       └── ui/
│   │           └── button.test.tsx
│   └── app/
│       └── login/
│           └── __tests__/
│               └── login.test.tsx
├── jest.config.js
└── jest.setup.js
```

## Test Coverage Areas

### Backend Coverage

#### Unit Tests
- **Auth Service**: Registration, login, logout, token refresh, password reset
- **Job Service**: CRUD operations, search, recommendations, statistics
- **Matching Service**: Score calculation, job recommendations, candidate matching
- **Application Service**: Application submission, status updates, tracking
- **User Service**: Profile management, preferences, skills
- **Company Service**: Company profiles, team management
- **Interview Service**: Scheduling, conflicts, reminders
- **Notification Service**: Email, in-app notifications, preferences
- **Analytics Service**: Data aggregation, reporting, metrics

#### Integration Tests
- **Auth Endpoints**: Full authentication flow testing
- **Job Endpoints**: API endpoint validation
- **Application Flow**: End-to-end application process
- **Rate Limiting**: Request throttling validation
- **Error Handling**: Global error handler testing

### Frontend Coverage

#### Component Tests
- **UI Components**: Buttons, forms, cards, modals
- **Form Validation**: Input validation, error displays
- **Authentication**: Login, registration, password reset
- **Dashboard Components**: Job cards, application lists, charts
- **Search & Filters**: Search functionality, filter controls
- **Real-time Updates**: WebSocket message handling

#### Integration Tests
- **Page Navigation**: Routing and redirects
- **API Integration**: Service layer testing
- **State Management**: Zustand store testing
- **Error Boundaries**: Error handling UI

## Testing Best Practices

### 1. Test Naming Convention
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should perform expected behavior when condition is met', () => {
      // Test implementation
    });
  });
});
```

### 2. AAA Pattern
- **Arrange**: Set up test data and mocks
- **Act**: Execute the function/component
- **Assert**: Verify the outcome

### 3. Mock Management
```typescript
// Always clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Use test helpers for common mocks
import { createMockUser, createMockJob } from '../utils/test-helpers';
```

### 4. Async Testing
```typescript
// Use async/await for cleaner async tests
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// Use waitFor for DOM updates
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

### 5. Testing Error Cases
```typescript
// Always test both success and failure paths
it('should handle errors gracefully', async () => {
  mockService.method.mockRejectedValueOnce(new Error('Test error'));
  
  await expect(functionUnderTest()).rejects.toThrow('Test error');
});
```

## Continuous Integration

### Pre-commit Hooks
```json
// package.json
"husky": {
  "hooks": {
    "pre-commit": "npm run lint && npm test"
  }
}
```

### GitHub Actions (future)
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

## Debugging Tests

### Visual Debugging
```typescript
// Use screen.debug() to see component output
screen.debug();

// Use console.log for service debugging
console.log('Mock called with:', mockService.mock.calls);
```

### Running Single Tests
```bash
# Run tests matching pattern
npm test -- auth.service

# Run specific test file
npm test -- auth.service.test.ts

# Run tests in specific directory
npm test -- tests/unit
```

### Coverage Reports
```bash
# Generate HTML coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

## Common Testing Patterns

### Testing API Calls
```typescript
it('should fetch data successfully', async () => {
  const mockData = { id: 1, name: 'Test' };
  mockAxios.get.mockResolvedValueOnce({ data: mockData });
  
  const result = await service.getData();
  
  expect(result).toEqual(mockData);
  expect(mockAxios.get).toHaveBeenCalledWith('/api/data');
});
```

### Testing React Hooks
```typescript
import { renderHook, act } from '@testing-library/react';

it('should update state', () => {
  const { result } = renderHook(() => useCustomHook());
  
  act(() => {
    result.current.updateValue('new value');
  });
  
  expect(result.current.value).toBe('new value');
});
```

### Testing Protected Routes
```typescript
it('should redirect to login when not authenticated', () => {
  const mockPush = jest.fn();
  useRouter.mockReturnValue({ push: mockPush });
  useAuthStore.mockReturnValue({ user: null });
  
  render(<ProtectedPage />);
  
  expect(mockPush).toHaveBeenCalledWith('/login');
});
```

## Maintenance

### Adding New Tests
1. Create test file next to the component/service
2. Follow existing patterns and conventions
3. Ensure minimum 80% coverage for new code
4. Update this documentation if adding new patterns

### Updating Tests
1. Run tests before making changes
2. Update tests alongside code changes
3. Ensure all tests pass before committing
4. Review coverage reports for gaps

## Troubleshooting

### Common Issues

1. **Module not found errors**
   - Check jest.config.js moduleNameMapper
   - Ensure all imports use correct aliases

2. **Async timeout errors**
   - Increase timeout: `jest.setTimeout(10000)`
   - Check for unresolved promises

3. **Mock not working**
   - Verify mock is before import
   - Check mock path matches import

4. **Coverage not accurate**
   - Clear jest cache: `npm test -- --clearCache`
   - Check collectCoverageFrom patterns

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)