# Test Suite Documentation

This test suite provides comprehensive testing for the Live Chat WebSocket application using Vitest.

## Test Files Overview

### 1. `config.test.ts`
Tests for configuration validation and environment variables.

**Coverage:**
- Default configuration values
- Environment variable parsing
- Port validation
- Configuration validation error handling

**Key Tests:**
- ✅ Validates default server, database, and logging config
- ✅ Tests environment variable override behavior
- ✅ Ensures invalid ports cause process exit
- ✅ Verifies startup configuration logging

### 2. `database.test.ts`
Tests for SQLite database plugin and operations.

**Coverage:**
- Database connection lifecycle
- Schema initialization
- CRUD operations on blocks table
- Plugin decoration and cleanup

**Key Tests:**
- ✅ Successful database connection
- ✅ Custom database path configuration
- ✅ Blocks table schema creation
- ✅ Insert and retrieve block records
- ✅ Handle multiple blocks per user
- ✅ Graceful connection cleanup on app close

### 3. `main.test.ts`
Tests for HTTP REST endpoints.

**Coverage:**
- Health check endpoint
- Readiness endpoint with database check
- User blocking endpoint with authorization
- CORS and security headers

**Key Tests:**
- ✅ `/health` returns 200 OK status
- ✅ `/ready` verifies database connectivity
- ✅ `/lobby/block` validates request body
- ✅ `/lobby/block` checks user authorization
- ✅ `/lobby/block` persists to database
- ✅ CORS headers present for allowed origins
- ✅ Helmet security headers applied

### 4. `websocket-lobby.test.ts`
Tests for lobby WebSocket connections and user management.

**Coverage:**
- WebSocket connection authorization
- User list management
- Real-time user presence updates
- Connection/disconnection events

**Key Tests:**
- ✅ Rejects connections without auth token
- ✅ Rejects connections without username/userId
- ✅ Accepts valid authenticated connections
- ✅ Sends empty user list to first user
- ✅ Broadcasts user list updates on join
- ✅ Notifies users when others disconnect
- ✅ Handles multiple simultaneous connections

### 5. `websocket-chat.test.ts`
Tests for individual chat room WebSocket functionality.

**Coverage:**
- Chat room connections
- Message broadcasting
- Chat history persistence
- User blocking in chats
- Room isolation and cleanup

**Key Tests:**
- ✅ Connects to chat room with username
- ✅ Notifies room when users join/leave
- ✅ Broadcasts messages to all room participants
- ✅ Excludes sender from receiving own messages
- ✅ Stores chat history (max 20 messages)
- ✅ Enforces user blocks (join prevention & message blocking)
- ✅ Cleans up empty chat rooms
- ✅ Isolates messages between different rooms

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Specific Test File
```bash
npm test config.test.ts
npm test database.test.ts
npm test main.test.ts
npm test websocket-lobby.test.ts
npm test websocket-chat.test.ts
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Tests in UI Mode
```bash
npm test -- --ui
```

## Test Structure

Each test file follows this pattern:

```typescript
describe("Module Name", () => {
  let app: FastifyInstance;
  let testDbPath: string;

  beforeEach(async () => {
    // Setup: Create test app, database, etc.
  });

  afterEach(async () => {
    // Cleanup: Close connections, delete test files
  });

  describe("Feature Group", () => {
    it("should test specific behavior", async () => {
      // Arrange: Set up test data
      // Act: Execute the code
      // Assert: Verify results
    });
  });
});
```

## Test Utilities

### WebSocket Test Helpers

**`waitForMessage(ws, timeout)`**
- Waits for and parses a WebSocket message
- Returns parsed JSON or raw string
- Throws error on timeout (default 5000ms)

**`closeWebSocket(ws)`**
- Gracefully closes a WebSocket connection
- Returns a promise that resolves when closed

**`createTestApp()`**
- Creates a Fastify instance configured for testing
- Uses separate test database
- Returns app instance and test dependencies

## Mocking Strategy

### External Services
- **Upstream Auth Service**: Mocked with local Fastify instance on port 3000
- **Database**: Uses separate SQLite file for each test suite
- **WebSocket Server**: Runs on random port (0) for parallel test execution

### In-Memory State
Tests expose internal state for verification:
- `userLobbyConnections` - Active lobby connections
- `banList` - User block list
- `chatRooms` - Active chat room connections
- `chatHistory` - Message history per room

## Database Cleanup

All tests use temporary SQLite databases:
- Created in `beforeEach` hook
- Deleted in `afterEach` hook
- Named uniquely per test suite to avoid conflicts

## Known Limitations

1. **TypeScript Errors**: Some type errors in test files are expected due to testing internal APIs
2. **WebSocket Timing**: Tests use timeouts for async WebSocket events (may need adjustment on slow systems)
3. **Auth Mocking**: The `/lobby` endpoint expects an upstream auth service - mocked in tests but not in `main.ts`

## Best Practices

✅ **DO:**
- Use unique database paths for each test suite
- Clean up resources in `afterEach`
- Wait for async operations to complete
- Test both success and error cases
- Mock external dependencies

❌ **DON'T:**
- Share state between tests
- Use hardcoded ports
- Leave WebSocket connections open
- Assume test execution order
- Test implementation details

## Continuous Integration

These tests are designed to run in CI environments:
- No external dependencies required
- Temporary file cleanup
- Random port allocation
- Parallel execution safe

## Troubleshooting

### Tests Timeout
- Increase timeout in `waitForMessage` calls
- Check if WebSocket connections are properly closed
- Verify database cleanup isn't blocking

### Database Locked
- Ensure all database connections close in `afterEach`
- Check for zombie processes holding file locks
- Use unique database names per test file

### Port Already in Use
- Tests should use port `0` for random assignment
- Check for lingering Fastify instances
- Ensure `afterEach` cleanup runs

## Contributing

When adding new tests:
1. Follow existing file structure
2. Add description to this README
3. Use descriptive test names
4. Clean up all resources
5. Mock external dependencies
6. Test error cases

## Test Coverage Goals

- **Unit Tests**: 80%+ code coverage
- **Integration Tests**: All API endpoints
- **E2E Tests**: Critical user flows
- **Edge Cases**: Error handling, rate limits, auth failures

---

**Last Updated**: October 15, 2025
**Test Framework**: Vitest v3.2.4
**Runtime**: Node.js with TypeScript
