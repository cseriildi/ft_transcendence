# Quick Test Reference

## Running Tests

### Basic Commands
```bash
npm test                    # Run all tests in watch mode
npm test -- --run          # Run all tests once
npm test -- --coverage     # Run with coverage report
npm test -- --ui           # Run with visual UI
```

### Run Specific Tests
```bash
npm test config            # Run config tests
npm test database          # Run database tests
npm test main              # Run main HTTP endpoint tests
npm test websocket-lobby   # Run lobby WebSocket tests
npm test websocket-chat    # Run chat room tests
```

### Filtering Tests
```bash
npm test -- -t "should connect"     # Run tests matching pattern
npm test -- --grep "blocking"       # Run tests with "blocking" in name
```

## Test Structure

Each test file follows this pattern:
```typescript
describe("Feature", () => {
  beforeEach(async () => {
    // Setup: Create test instances
  });

  afterEach(async () => {
    // Cleanup: Close connections, delete files
  });

  it("should do something", async () => {
    // Arrange: Set up test data
    const result = await someFunction();
    // Assert: Verify results
    expect(result).toBe(expected);
  });
});
```

## Common Assertions

```typescript
// Equality
expect(value).toBe(expected)              // Strict equality (===)
expect(value).toEqual(expected)           // Deep equality
expect(value).toBeTruthy()                // Truthy value
expect(value).toBeFalsy()                 // Falsy value

// Numbers
expect(number).toBeGreaterThan(10)
expect(number).toBeLessThan(100)
expect(duration).toBeLessThan(100)        // Performance check

// Arrays & Objects
expect(array).toHaveLength(5)
expect(array).toContain(item)
expect(obj).toHaveProperty('key')
expect(obj.key).toBeDefined()

// Functions
expect(() => fn()).toThrow()              // Function throws
expect(fn).toHaveBeenCalled()             // Mock was called
expect(fn).toHaveBeenCalledWith(arg)      // Mock called with arg

// Async
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow()
```

## Test Patterns

### HTTP Endpoint Testing
```typescript
const response = await app.inject({
  method: "POST",
  url: "/endpoint",
  payload: { data: "value" },
  headers: { authorization: "Bearer token" }
});

expect(response.statusCode).toBe(200);
expect(JSON.parse(response.body)).toEqual({ result: "ok" });
```

### WebSocket Testing
```typescript
const ws = new WebSocket(`${serverAddress}/path?param=value`, {
  headers: { authorization: "Bearer token" }
});

const message = await waitForMessage(ws);
expect(message.type).toBe("connected");

ws.send("Hello!");
await closeWebSocket(ws);
```

### Database Testing
```typescript
await app.register(dbConnector, { path: testDbPath });
await app.ready();

const rows = await new Promise((resolve, reject) => {
  app.db.all("SELECT * FROM table", (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

expect(rows).toHaveLength(1);
```

## Debugging Tests

### Enable Logging
```typescript
const app = Fastify({ logger: true }); // Enable Fastify logs
```

### Add Console Logs
```typescript
it("debugging test", () => {
  console.log("Value:", someValue);
  expect(someValue).toBe(expected);
});
```

### Run Single Test
```typescript
it.only("focus on this test", () => {
  // Only this test will run
});
```

### Skip Test
```typescript
it.skip("skip this test", () => {
  // This test will be skipped
});
```

### Increase Timeout
```typescript
it("slow test", async () => {
  // Test code
}, 10000); // 10 second timeout
```

## Troubleshooting

### Tests Hang
- Check for unclosed WebSocket connections
- Verify database cleanup in `afterEach`
- Look for unresolved promises

### Tests Fail Intermittently
- Increase timeouts for WebSocket operations
- Check for race conditions
- Ensure proper cleanup between tests

### Port Already in Use
- Use port `0` for random port assignment
- Check for lingering processes: `lsof -i :3000`

### Database Locked
- Ensure all DB connections close
- Use unique DB files per test suite
- Check for zombie processes

### Module Not Found
- Run `npm install`
- Check import paths
- Clear node_modules and reinstall

## Best Practices

✅ **DO:**
- Clean up resources in `afterEach`
- Use unique database paths per test suite
- Wait for async operations to complete
- Test both success and error cases
- Use descriptive test names

❌ **DON'T:**
- Share state between tests
- Use hardcoded ports
- Assume test execution order
- Leave connections open
- Test implementation details

## Coverage Report

Generate coverage report:
```bash
npm test -- --coverage
```

View in browser:
```bash
open coverage/index.html
```

## CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Run tests
  run: npm test -- --run

- name: Generate coverage
  run: npm test -- --coverage --run
```

## Resources

- **Vitest Docs**: https://vitest.dev
- **Fastify Testing**: https://www.fastify.io/docs/latest/Guides/Testing/
- **WebSocket Testing**: https://github.com/websockets/ws

---

**Quick Tip**: Keep tests focused, fast, and independent!
