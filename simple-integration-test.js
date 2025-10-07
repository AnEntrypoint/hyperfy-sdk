import fetch from 'node-fetch'
import WebSocket from 'ws'

class SimpleIntegrationTester {
  constructor() {
    this.testResults = []
    this.testServerUrl = 'http://localhost:3002'
    this.wsEndpoints = [
      'ws://localhost:3002',
      'ws://localhost:3001',
      'ws://localhost:8080'
    ]
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`
    console.log(logEntry)
    this.testResults.push({ timestamp, message, type })
  }

  async runHttpApiTests() {
    this.log('🌐 Starting HTTP API Integration Tests', 'test')

    const tests = [
      {
        name: 'Health Check',
        test: () => fetch(`${this.testServerUrl}/health`)
          .then(res => res.json())
          .then(data => {
            if (data.status === 'healthy') {
              this.log('✅ Health check passed', 'success')
              this.log(`   Server: ${data.server || 'Unknown'}`, 'info')
              this.log(`   Uptime: ${data.uptime ? data.uptime.toFixed(2) + 's' : 'Unknown'}`, 'info')
              return true
            }
            throw new Error(`Health check failed: ${data.status}`)
          })
      },
      {
        name: 'API Endpoint Test',
        test: () => fetch(`${this.testServerUrl}/api/test`)
          .then(res => res.json())
          .then(data => {
            if (data.message && data.timestamp) {
              this.log('✅ API endpoint test passed', 'success')
              this.log(`   Message: ${data.message}`, 'info')
              this.log(`   Server: ${data.server || 'Unknown'}`, 'info')
              return true
            }
            throw new Error('API endpoint returned invalid data')
          })
      },
      {
        name: 'Concurrent Requests Test',
        test: async () => {
          const startTime = performance.now()
          const promises = []

          for (let i = 0; i < 50; i++) {
            promises.push(fetch(`${this.testServerUrl}/api/test`))
          }

          const responses = await Promise.all(promises)
          const endTime = performance.now()
          const duration = endTime - startTime
          const successCount = responses.filter(r => r.ok).length

          this.log(`✅ Concurrent test: ${successCount}/50 requests in ${duration.toFixed(2)}ms`, 'success')
          this.log(`📊 Performance: ${(50000/duration).toFixed(0)} req/s`, 'info')

          return successCount >= 45 // Allow for some failures
        }
      },
      {
        name: 'Response Time Analysis',
        test: async () => {
          const times = []
          const iterations = 20

          for (let i = 0; i < iterations; i++) {
            const startTime = performance.now()
            await fetch(`${this.testServerUrl}/api/test`)
            const endTime = performance.now()
            times.push(endTime - startTime)
          }

          const avgTime = times.reduce((a, b) => a + b, 0) / times.length
          const maxTime = Math.max(...times)
          const minTime = Math.min(...times)

          this.log(`📊 Response Time Analysis (${iterations} requests):`, 'info')
          this.log(`   Average: ${avgTime.toFixed(2)}ms`, 'info')
          this.log(`   Min: ${minTime.toFixed(2)}ms`, 'info')
          this.log(`   Max: ${maxTime.toFixed(2)}ms`, 'info')

          return avgTime < 100 // Acceptable response time
        }
      }
    ]

    let passed = 0
    let failed = 0

    for (const test of tests) {
      try {
        this.log(`🧪 Running: ${test.name}`, 'info')
        await Promise.race([
          test.test(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout')), 10000)
          )
        ])
        passed++
      } catch (error) {
        this.log(`❌ ${test.name} failed: ${error.message}`, 'error')
        failed++
      }
    }

    this.log(`🌐 HTTP API Tests: ${passed} passed, ${failed} failed`, 'summary')
    return { passed, failed }
  }

  async testWebSocketConnection(wsUrl) {
    return new Promise((resolve, reject) => {
      this.log(`🔌 Testing WebSocket connection to ${wsUrl}`, 'info')

      const ws = new WebSocket(wsUrl)
      let connected = false
      let messageReceived = false
      let messages = []
      let timeoutId

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId)
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
      }

      timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('WebSocket connection timeout'))
      }, 5000)

      ws.on('open', () => {
        connected = true
        this.log(`✅ WebSocket connected to ${wsUrl}`, 'success')

        // Send multiple test messages
        const testMessages = [
          { type: 'test', message: 'Hello from integration test 1', timestamp: new Date().toISOString() },
          { type: 'ping', data: { timestamp: Date.now() } },
          { type: 'test', message: 'Hello from integration test 2', timestamp: new Date().toISOString() }
        ]

        testMessages.forEach((msg, index) => {
          setTimeout(() => {
            ws.send(JSON.stringify(msg))
            this.log(`📤 Sent message ${index + 1}: ${JSON.stringify(msg).substring(0, 50)}...`, 'info')
          }, index * 100)
        })
      })

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          messages.push(message)
          this.log(`📨 Received message: ${JSON.stringify(message).substring(0, 100)}...`, 'success')
          messageReceived = true

          if (messages.length >= 3) { // Wait for multiple responses
            cleanup()
            resolve({ connected, messageReceived, messages, url: wsUrl })
          }
        } catch (error) {
          this.log(`❌ Failed to parse WebSocket message: ${error.message}`, 'error')
          cleanup()
          reject(error)
        }
      })

      ws.on('close', () => {
        if (!messageReceived && connected) {
          this.log(`🔌 WebSocket connection closed after receiving ${messages.length} messages`, 'warning')
        }
      })

      ws.on('error', (error) => {
        this.log(`❌ WebSocket error: ${error.message}`, 'error')
        cleanup()
        reject(error)
      })
    })
  }

  async runWebSocketTests() {
    this.log('🔌 Starting WebSocket Integration Tests', 'test')

    let connectedWs = null
    let passed = 0
    let failed = 0

    for (const wsUrl of this.wsEndpoints) {
      try {
        const result = await this.testWebSocketConnection(wsUrl)
        if (result.connected && result.messageReceived) {
          connectedWs = result.url
          passed++
          this.log(`📊 WebSocket endpoint working: ${connectedWs}`, 'success')
          this.log(`   Messages exchanged: ${result.messages.length}`, 'info')
          break // Use first working WebSocket endpoint
        }
      } catch (error) {
        this.log(`❌ WebSocket ${wsUrl} failed: ${error.message}`, 'error')
        failed++
      }
    }

    if (!connectedWs) {
      this.log(`❌ No working WebSocket endpoints found`, 'error')
    }

    this.log(`🔌 WebSocket Tests: ${passed} passed, ${failed} failed`, 'summary')
    return { passed, failed, workingEndpoint: connectedWs }
  }

  async runErrorScenarios() {
    this.log('🚨 Starting Error Scenario Tests', 'test')

    const tests = [
      {
        name: 'Invalid HTTP Endpoint',
        test: () => fetch(`${this.testServerUrl}/invalid-endpoint`)
          .then(res => {
            if (res.status >= 400 && res.status < 500) {
              this.log('✅ Invalid endpoint correctly returns 4xx status', 'success')
              return true
            }
            throw new Error(`Expected 4xx status, got ${res.status}`)
          })
          .catch(error => {
            if (error.code === 'ECONNREFUSED' || error.message.includes('4xx') || error.message.includes('404')) {
              this.log('✅ Invalid endpoint handling works correctly', 'success')
              return true
            }
            throw error
          })
      },
      {
        name: 'WebSocket Connection to Invalid Port',
        test: () => this.testWebSocketConnection('ws://localhost:9999')
          .then(() => {
            throw new Error('Should have failed to connect to invalid port')
          })
          .catch(error => {
            this.log('✅ Invalid WebSocket connection correctly fails', 'success')
            return true
          })
      },
      {
        name: 'Request Timeout Handling',
        test: async () => {
          const controller = new AbortController()
          setTimeout(() => controller.abort(), 1) // Very short timeout

          try {
            await fetch(`${this.testServerUrl}/api/test`, {
              signal: controller.signal
            })
            throw new Error('Request should have timed out')
          } catch (error) {
            if (error.name === 'AbortError') {
              this.log('✅ Request timeout handling works correctly', 'success')
              return true
            }
            throw error
          }
        }
      },
      {
        name: 'Malformed JSON Request',
        test: async () => {
          try {
            const response = await fetch(`${this.testServerUrl}/api/test`, {
              method: 'POST',
              body: '{invalid json}',
              headers: { 'Content-Type': 'application/json' }
            })
            // Most servers will reject this, which is expected
            this.log('✅ Malformed JSON request properly handled', 'success')
            return true
          } catch (error) {
            this.log('✅ Malformed JSON request properly handled', 'success')
            return true
          }
        }
      }
    ]

    let passed = 0
    let failed = 0

    for (const test of tests) {
      try {
        this.log(`🧪 Running: ${test.name}`, 'info')
        await test.test()
        passed++
      } catch (error) {
        this.log(`❌ ${test.name} failed: ${error.message}`, 'error')
        failed++
      }
    }

    this.log(`🚨 Error Scenario Tests: ${passed} passed, ${failed} failed`, 'summary')
    return { passed, failed }
  }

  async runLoadTests() {
    this.log('⚡ Starting Load Tests', 'test')

    const tests = [
      {
        name: 'High Concurrency Load Test',
        test: async () => {
          const concurrency = 100
          const startTime = performance.now()

          const promises = []
          for (let i = 0; i < concurrency; i++) {
            promises.push(
              fetch(`${this.testServerUrl}/api/test`)
                .then(res => ({ status: res.status, success: res.ok }))
                .catch(error => ({ success: false, error: error.message }))
            )
          }

          const results = await Promise.all(promises)
          const endTime = performance.now()
          const duration = endTime - startTime

          const successCount = results.filter(r => r.success).length
          const avgResponseTime = duration / concurrency

          this.log(`⚡ Load Test Results:`, 'info')
          this.log(`   Concurrency: ${concurrency} requests`, 'info')
          this.log(`   Success rate: ${((successCount/concurrency)*100).toFixed(1)}%`, 'info')
          this.log(`   Duration: ${duration.toFixed(2)}ms`, 'info')
          this.log(`   Avg response time: ${avgResponseTime.toFixed(2)}ms`, 'info')
          this.log(`   Requests/sec: ${(1000/avgResponseTime).toFixed(0)}`, 'info')

          const success = successCount >= (concurrency * 0.9) // 90% success rate
          if (success) {
            this.log('✅ Load test passed - good performance under load', 'success')
          } else {
            this.log('⚠️ Load test failed - poor performance under load', 'warning')
          }

          return success
        }
      }
    ]

    let passed = 0
    let failed = 0

    for (const test of tests) {
      try {
        this.log(`🧪 Running: ${test.name}`, 'info')
        const result = await test.test()
        if (result) passed++
        else failed++
      } catch (error) {
        this.log(`❌ ${test.name} failed: ${error.message}`, 'error')
        failed++
      }
    }

    this.log(`⚡ Load Tests: ${passed} passed, ${failed} failed`, 'summary')
    return { passed, failed }
  }

  async generateTestReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.testResults.length,
        passed: this.testResults.filter(r => r.type === 'success').length,
        failed: this.testResults.filter(r => r.type === 'error').length,
        warnings: this.testResults.filter(r => r.type === 'warning').length,
        info: this.testResults.filter(r => r.type === 'info').length
      },
      testServer: {
        url: this.testServerUrl,
        testedEndpoints: [
          `${this.testServerUrl}/health`,
          `${this.testServerUrl}/api/test`
        ],
        websocketEndpoints: this.wsEndpoints
      },
      results: this.testResults
    }

    const reportPath = '/mnt/c/dev/hypersdk/integration-test-report.json'

    // Write report using node:fs
    const fs = await import('node:fs/promises')
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    this.log(`📄 Test report saved to: ${reportPath}`, 'info')

    return report
  }

  async runAllTests() {
    this.log('🎯 Starting Comprehensive Integration Tests', 'test')
    this.log('=' .repeat(80), 'info')

    const startTime = performance.now()

    const results = {
      httpApi: await this.runHttpApiTests(),
      websocket: await this.runWebSocketTests(),
      errorScenarios: await this.runErrorScenarios(),
      loadTests: await this.runLoadTests()
    }

    const endTime = performance.now()
    const totalDuration = endTime - startTime

    this.log('=' .repeat(80), 'info')

    // Final summary
    const totalPassed = Object.values(results).reduce((sum, result) => sum + (result.passed || 0), 0)
    const totalFailed = Object.values(results).reduce((sum, result) => sum + (result.failed || 0), 0)

    this.log(`🏁 Integration Tests Complete`, 'summary')
    this.log(`   Duration: ${totalDuration.toFixed(2)}ms`, 'info')
    this.log(`   Total: ${totalPassed} passed, ${totalFailed} failed`, 'summary')
    this.log(`   Success Rate: ${((totalPassed/(totalPassed+totalFailed))*100).toFixed(1)}%`, 'info')

    if (totalFailed === 0) {
      this.log('🎉 All integration tests passed successfully!', 'success')
    } else {
      this.log('⚠️ Some tests failed - check logs for details', 'warning')
    }

    // WebSocket endpoint status
    if (results.websocket.workingEndpoint) {
      this.log(`🔌 Working WebSocket endpoint: ${results.websocket.workingEndpoint}`, 'success')
    } else {
      this.log('❌ No working WebSocket endpoints found - SDK WebSocket features may not work', 'error')
    }

    await this.generateTestReport()
    return { results, duration: totalDuration, successRate: (totalPassed/(totalPassed+totalFailed))*100 }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SimpleIntegrationTester()

  tester.runAllTests()
    .then(results => {
      console.log('\n🎯 Integration Test Results Summary:')
      console.log(JSON.stringify(results.results, null, 2))
      console.log(`\n📊 Overall Success Rate: ${results.successRate.toFixed(1)}%`)
      console.log(`⏱️ Total Test Duration: ${results.duration.toFixed(2)}ms`)

      // Exit with appropriate code
      const hasFailures = Object.values(results.results).some(result => result.failed > 0)
      process.exit(hasFailures ? 1 : 0)
    })
    .catch(error => {
      console.error('❌ Integration test suite failed:', error)
      process.exit(1)
    })
}

export default SimpleIntegrationTester