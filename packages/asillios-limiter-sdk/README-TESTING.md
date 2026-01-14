on: [push, pull_request]
jobs:

# Basic Testing Guide for Asillios Limiter SDK

## Setup

1. **Install dependencies:**
   ```bash
   npm install -D vitest @vitest/coverage-v8
   ```

2. **(Optional) Add test scripts to package.json:**
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "test:coverage": "vitest run --coverage"
     }
   }
   ```

## Running Tests

```bash
# Run all tests
npx vitest run

# Watch mode
npx vitest

# Coverage report
npx vitest run --coverage
```

## Test Structure

Currently, the test suite has one file:

- **limiter.test.ts** — Tests basic rate limiting features

## Writing New Tests

See limiter.test.ts for examples. Use Vitest's `describe`, `it`, and `expect` for assertions.

## Coverage

Open `coverage/index.html` after running coverage to view details.
