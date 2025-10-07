# Hyperfy SDK Testing Infrastructure

This document describes the comprehensive testing infrastructure setup for the Hyperfy SDK, enabling automated end-to-end testing against a real Hyperfy server environment.

## Overview

The testing infrastructure consists of several key components:

- **Test Server** (`test-server.js`) - Lightweight HTTP/WebSocket server for testing
- **Server Manager** (`test-server-manager.js`) - Server lifecycle management with health checks
- **E2E Test Utils** (`e2e-test-utils.js`) - Comprehensive testing utilities
- **Test Setup** (`test-setup.js`) - CLI tool for managing test environments

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Quick Tests

```bash
# Run quick E2E tests
node test-setup.js quick

# Run full test suite with performance testing
node test-setup.js test

# Run demo with detailed reporting
node test-setup.js demo
```

### 3. Start Test Server for Manual Testing

```bash
# Start test server (default port 3001)
node test-setup.js start

# Access test interface
open http://localhost:3001
```

## Testing Components

### Test Server

**File:** `test-server.js`

A lightweight Node.js server that mimics Hyperfy's core functionality:

- HTTP server with health checks and API endpoints
- WebSocket server for real-time communication
- Built-in test interface for manual verification
- Graceful shutdown and error handling

**Features:**
- Port: 3001 (configurable)
- Health endpoint: `/health`
- Test API: `/api/test`
- WebSocket: `/ws`
- Test interface: `/` (browser-based)

### Server Manager

**File:** `test-server-manager.js`

Manages the complete lifecycle of test servers:

- Automatic startup/shutdown procedures
- Health monitoring with periodic checks
- Retry logic for failed startups
- Event-driven architecture
- Resource cleanup

**Usage:**
```javascript
import { createTestServer } from './test-server-manager.js';

const server = createTestServer({ port: 3001 });
await server.start();

// Check server health
const health = await server.checkHealth();

// Test connection
const test = await server.testConnection();

// Stop server
await server.stop();
```

### E2E Test Utils

**File:** `e2e-test-utils.js`

Comprehensive testing utilities for end-to-end scenarios:

- WebSocket connectivity testing
- HTTP API endpoint testing
- Concurrent connection testing
- Performance load testing
- Test result collection and reporting

**Usage:**
```javascript
import { E2ETestUtils, runE2ETests } from './e2e-test-utils.js';

// Quick E2E tests
const results = await runE2ETests({ port: 3001 });

// Advanced testing with utils
const utils = new E2ETestUtils({ port: 3001 });
await utils.runTestSuite();
```

### Test Setup CLI

**File:** `test-setup.js`

Command-line interface for managing test environments:

```bash
# Start test server
node test-setup.js start

# Run full test suite
node test-setup.js test

# Quick E2E tests only
node test-setup.js quick

# Demo with detailed reporting
node test-setup.js demo

# Show help
node test-setup.js help
```

## Test Scenarios

### 1. Basic Connectivity Tests

```javascript
import { runE2ETests } from './e2e-test-utils.js';

const results = await runE2ETests();
// Tests: HTTP API, WebSocket connectivity, concurrent connections
```

### 2. Performance Testing

```javascript
import { PerformanceTester } from './e2e-test-utils.js';

const perfTester = new PerformanceTester({ port: 3001 });
const results = await perfTester.testLoad(50, 10000); // 50 connections, 10 seconds
```

### 3. Custom Test Scenarios

```javascript
import { withTestServer, E2ETestUtils } from './e2e-test-utils.js';

// Run tests with managed server
await withTestServer({ port: 3001 }, async (server) => {
  const utils = new E2ETestUtils();
  await utils.testWebSocketConnectivity();
  await utils.testHttpApi();
  // ... custom tests
});
```

## Test Reports

The testing infrastructure generates detailed JSON reports:

```bash
# Reports are saved to:
./test-report.json        # Full test suite
./quick-test-report.json  # Quick tests
./demo-test-report.json   # Demo tests
```

**Report Structure:**
```json
{
  "timestamp": "2025-10-07T15:00:00.000Z",
  "environment": {
    "nodeVersion": "v20.19.4",
    "platform": "linux",
    "arch": "x64"
  },
  "results": {
    "startTime": 1728345600000,
    "endTime": 1728345650000,
    "duration": 50000,
    "success": true,
    "tests": {
      "e2e": { ... },
      "performance": { ... }
    }
  }
}
```

## Configuration

### Environment Variables

```bash
NODE_ENV=test                    # Enable test mode
PORT=3001                        # Server port
HOST=localhost                   # Server host
```

### Server Options

```javascript
const options = {
  port: 3001,                    // Server port
  host: 'localhost',             // Server host
  startupTimeout: 30000,         // Startup timeout (ms)
  healthCheckInterval: 5000,     // Health check interval (ms)
  maxRetries: 3                  // Maximum startup retries
};
```

## Integration with Hyperfy SDK

### Testing SDK Against Real Server

```javascript
import HyperfySDK from './src/index.js';
import { runE2ETests } from './e2e-test-utils.js';

async function testSDK() {
  // Start test server
  await runE2ETests({ port: 3001 });

  // Initialize SDK against test server
  const sdk = new HyperfySDK({
    serverUrl: 'http://localhost:3001',
    websocketUrl: 'ws://localhost:3001/ws'
  });

  // Test SDK functionality
  await sdk.connect();
  await sdk.createEntity('test-entity');
  // ... more SDK tests
}
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: node test-setup.js test
      - uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: '*-test-report.json'
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill process using port 3001
   lsof -ti:3001 | xargs kill -9
   # Or use different port
   node test-setup.js start --port 3002
   ```

2. **WebSocket Connection Failed**
   - Check if server is running: `curl http://localhost:3001/health`
   - Verify WebSocket endpoint: `wscat -c ws://localhost:3001/ws`

3. **Tests Timing Out**
   - Increase timeout in server options
   - Check system resources
   - Reduce test load for performance tests

### Debug Mode

Enable debug logging:
```bash
NODE_ENV=test DEBUG=* node test-setup.js test
```

### Manual Testing

Access the built-in test interface:
1. Start server: `node test-setup.js start`
2. Open browser: `http://localhost:3001`
3. Use the test controls to verify functionality

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Infrastructure                       │
├─────────────────────────────────────────────────────────────┤
│  test-setup.js (CLI)                                       │
│  ├── Test Server Management                                 │
│  ├── Test Execution                                        │
│  └── Report Generation                                     │
├─────────────────────────────────────────────────────────────┤
│  test-server-manager.js                                    │
│  ├── Server Lifecycle                                      │
│  ├── Health Monitoring                                     │
│  └── Event Management                                      │
├─────────────────────────────────────────────────────────────┤
│  e2e-test-utils.js                                         │
│  ├── WebSocket Testing                                     │
│  ├── HTTP API Testing                                      │
│  ├── Performance Testing                                   │
│  └── Result Collection                                     │
├─────────────────────────────────────────────────────────────┤
│  test-server.js                                            │
│  ├── HTTP Server                                           │
│  ├── WebSocket Server                                      │
│  └── Test Interface                                       │
└─────────────────────────────────────────────────────────────┘
```

## Best Practices

1. **Always clean up** after tests to prevent resource leaks
2. **Use unique ports** for parallel test execution
3. **Monitor test performance** to identify bottlenecks
4. **Generate reports** for test documentation and CI/CD
5. **Mock external dependencies** when possible
6. **Run tests in isolation** to prevent interference

## Future Enhancements

- [ ] Integration with Hyperfy's actual server
- [ ] Database state management testing
- [ ] Asset upload/download testing
- [ ] Multi-region deployment testing
- [ ] Real-time collaboration testing
- [ ] Mobile client testing capabilities