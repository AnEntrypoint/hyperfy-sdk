#!/usr/bin/env node

import { createTestServer } from './test-server-manager.js';
import { E2ETestUtils, runE2ETests, PerformanceTester } from './e2e-test-utils.js';

/**
 * Hyperfy Test Setup Script
 *
 * This script sets up the complete testing environment for the Hyperfy SDK.
 * It can be used to:
 * - Start a test server
 * - Run E2E tests
 * - Perform performance testing
 * - Generate test reports
 */

class TestSetup {
  constructor() {
    this.server = null;
    this.testUtils = null;
    this.perfTester = null;
  }

  async setupEnvironment(options = {}) {
    console.log('🚀 Setting up Hyperfy test environment...\n');

    const serverOptions = {
      port: options.port || 3001,
      host: options.host || 'localhost',
      startupTimeout: options.startupTimeout || 30000,
      ...options
    };

    try {
      // Start test server
      this.server = createTestServer(serverOptions);
      await this.server.start();

      // Initialize test utilities
      this.testUtils = new E2ETestUtils(serverOptions);
      this.perfTester = new PerformanceTester(serverOptions);

      console.log(`✅ Test environment ready on http://${serverOptions.host}:${serverOptions.port}`);
      console.log(`📊 Health check: http://${serverOptions.host}:${serverOptions.port}/health`);
      console.log(`🔌 WebSocket: ws://${serverOptions.host}:${serverOptions.port}/ws\n`);

      return {
        server: this.server,
        testUtils: this.testUtils,
        perfTester: this.perfTester,
        url: `http://${serverOptions.host}:${serverOptions.port}`
      };

    } catch (error) {
      console.error('❌ Failed to setup test environment:', error.message);
      throw error;
    }
  }

  async runFullTestSuite() {
    console.log('🧪 Running complete test suite...\n');

    if (!this.testUtils) {
      throw new Error('Test environment not initialized. Call setupEnvironment() first.');
    }

    const results = {
      startTime: Date.now(),
      tests: {},
      success: false
    };

    try {
      // Run E2E tests
      console.log('1️⃣ Running E2E tests...');
      results.tests.e2e = await this.testUtils.runTestSuite();
      console.log(`   ${results.tests.e2e.success ? '✅' : '❌'} E2E tests: ${results.tests.e2e.tests.filter(t => t.success).length}/${results.tests.e2e.tests.length} passed\n`);

      // Run performance tests
      console.log('2️⃣ Running performance tests...');
      results.tests.performance = await this.perfTester.testLoad(10, 5000);
      console.log(`   ${results.tests.performance.success ? '✅' : '❌'} Performance test: ${results.tests.performance.metrics.successRate.toFixed(1)}% success rate\n`);

      // Generate summary
      results.success = results.tests.e2e.success && results.tests.performance.success;
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;

      console.log(`🎯 Test suite completed in ${results.duration}ms`);
      console.log(`📊 Overall result: ${results.success ? '✅ PASSED' : '❌ FAILED'}`);

      return results;

    } catch (error) {
      results.error = error.message;
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      return results;
    }
  }

  async generateReport(results, outputPath = './test-report.json') {
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      results
    };

    const fs = await import('fs');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Test report generated: ${outputPath}`);
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test environment...');

    if (this.testUtils) {
      this.testUtils.cleanup();
    }

    if (this.server) {
      await this.server.stop();
    }

    console.log('✅ Cleanup complete');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  const setup = new TestSetup();

  try {
    switch (command) {
      case 'start':
        const env = await setup.setupEnvironment();
        console.log('🎯 Test server is running. Press Ctrl+C to stop.');

        process.on('SIGINT', async () => {
          await setup.cleanup();
          process.exit(0);
        });

        // Keep process alive
        await new Promise(() => {});
        break;

      case 'test':
        await setup.setupEnvironment();
        const results = await setup.runFullTestSuite();
        await setup.generateReport(results);
        await setup.cleanup();

        process.exit(results.success ? 0 : 1);
        break;

      case 'quick':
        console.log('🚀 Running quick E2E tests...');
        const quickResults = await runE2ETests({ port: 3004 });
        await setup.generateReport(quickResults, './quick-test-report.json');

        console.log('\n📊 Quick test results:');
        console.log(JSON.stringify(quickResults, null, 2));

        process.exit(quickResults.success ? 0 : 1);
        break;

      case 'demo':
        console.log('🎯 Running demo test suite...');

        // Setup environment
        const demoEnv = await setup.setupEnvironment({ port: 3005 });

        // Wait a moment for server to be fully ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Run tests
        const demoResults = await setup.runFullTestSuite();

        // Generate report
        await setup.generateReport(demoResults, './demo-test-report.json');

        // Cleanup
        await setup.cleanup();

        // Display results
        console.log('\n🎉 Demo completed!');
        console.log('📊 Results Summary:');
        console.log(`   Duration: ${demoResults.duration}ms`);
        console.log(`   E2E Tests: ${demoResults.tests.e2e.success ? 'PASSED' : 'FAILED'}`);
        console.log(`   Performance: ${demoResults.tests.performance.success ? 'PASSED' : 'FAILED'}`);
        console.log(`   Overall: ${demoResults.success ? 'PASSED' : 'FAILED'}`);

        process.exit(demoResults.success ? 0 : 1);
        break;

      case 'help':
      default:
        console.log(`
🧪 Hyperfy Test Setup Utility

Usage: node test-setup.js <command> [options]

Commands:
  start    - Start test server and keep it running
  test     - Run complete test suite (E2E + Performance)
  quick    - Run quick E2E tests only
  demo     - Run demo test suite with reporting
  help     - Show this help message

Examples:
  node test-setup.js start          # Start test server on port 3001
  node test-setup.js test           # Run full test suite
  node test-setup.js quick          # Run quick E2E tests
  node test-setup.js demo           # Run demo with detailed reporting

Environment Variables:
  NODE_ENV=test                     # Enable test mode
  PORT=3001                         # Server port (default: 3001)
  HOST=localhost                    # Server host (default: localhost)

Features:
  ✅ HTTP API testing
  ✅ WebSocket connectivity testing
  ✅ Concurrent connection testing
  ✅ Performance load testing
  ✅ Health checks and monitoring
  ✅ Automated cleanup procedures
  ✅ Detailed test reporting

The test server provides:
  🌐 HTTP server on http://localhost:3001
  🔌 WebSocket server on ws://localhost:3001/ws
  📊 Health check on http://localhost:3001/health
  🧪 Test interface on http://localhost:3001/
        `);
        break;
    }

  } catch (error) {
    console.error('💥 Command failed:', error.message);
    await setup.cleanup();
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TestSetup };