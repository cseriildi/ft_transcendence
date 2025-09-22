// tests/routes/auth.test.ts
import { FastifyInstance } from 'fastify';
import bcrypt from "bcrypt";
import { cleanupTestApp, createTestApp} from '../setup.ts';
import { CreateUserBody, UserLoginBody } from '../../src/authService/authTypes.ts';

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  beforeEach(async () => {
    // Clean up users table before each test
    await new Promise<void>((resolve, reject) => {
      app.db.run("DELETE FROM users", [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('POST /register', () => {
    const validRegistrationData: CreateUserBody = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'securepassword123',
      confirmPassword: 'securepassword123'
    };

    it('should register a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: validRegistrationData
      });

      expect(response.statusCode).toBe(201);
      const hash = await bcrypt.hash(validRegistrationData.password, 10);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.user).toHaveProperty('id');
      expect(body.data.user.username).toBe('testuser');
      expect(body.data.user.email).toBe('test@example.com');
      expect(body.data.user).not.toHaveProperty('password');
      expect(body.data.user.password_hash).toBeDefined();
      expect(body.data.user.password_hash).not.toBe(validRegistrationData.password);
      // expect(body.data).toHaveProperty('token');
      // expect(body.data).toHaveProperty('expiresIn', '24h');
      // expect(body.message).toBe('User registered successfully');
    });

    it('should reject registration with existing email', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/register',
        payload: validRegistrationData
      });

      // Attempt duplicate registration
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          ...validRegistrationData,
          username: 'differentuser'
        }
      });

      expect(response.statusCode).toBe(409);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('already exists');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          ...validRegistrationData,
          email: 'invalid-email'
        }
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.type).toBe('VALIDATION_ERROR');
    });

    // it('should reject registration with weak password', async () => {
    //   const response = await app.inject({
    //     method: 'POST',
    //     url: '/api/v1/auth/register',
    //     payload: {
    //       ...validRegistrationData,
    //       password: '123'
    //     }
    //   });

    //   expect(response.statusCode).toBe(400);
    // });

    it('should reject registration with missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          username: 'testuser'
          // Missing email and password
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // describe('POST /auth/login', () => {
  //   const userData = {
  //     username: 'testuser',
  //     email: 'test@example.com',
  //     password: 'securepassword123'
  //   };

  //   beforeEach(async () => {
  //     // Register a user for login tests
  //     await app.inject({
  //       method: 'POST',
  //       url: '/api/v1/auth/register',
  //       payload: userData
  //     });
  //   });

  //   it('should login with valid credentials', async () => {
  //     const loginData: LoginBody = {
  //       email: userData.email,
  //       password: userData.password
  //     };

  //     const response = await app.inject({
  //       method: 'POST',
  //       url: '/login',
  //       payload: loginData
  //     });

  //     expect(response.statusCode).toBe(200);
      
  //     const body = JSON.parse(response.body);
  //     expect(body.success).toBe(true);
  //     expect(body.data.user.email).toBe(userData.email);
  //     expect(body.data).toHaveProperty('token');
  //     expect(body.message).toBe('Login successful');
  //   });

  //   it('should reject login with invalid email', async () => {
  //     const response = await app.inject({
  //       method: 'POST',
  //       url: '/api/v1/auth/login',
  //       payload: {
  //         email: 'nonexistent@example.com',
  //         password: userData.password
  //       }
  //     });

  //     expect(response.statusCode).toBe(401);
      
  //     const body = JSON.parse(response.body);
  //     expect(body.success).toBe(false);
  //     expect(body.error.message).toBe('Invalid credentials');
  //   });

  //   it('should reject login with invalid password', async () => {
  //     const response = await app.inject({
  //       method: 'POST',
  //       url: '/api/v1/auth/login',
  //       payload: {
  //         email: userData.email,
  //         password: 'wrongpassword'
  //       }
  //     });

  //     expect(response.statusCode).toBe(401);
  //   });
  // });

  // describe('Protected Routes', () => {
  //   let authToken: string;

  //   beforeEach(async () => {
  //     // Register and get auth token
  //     const registerResponse = await app.inject({
  //       method: 'POST',
  //       url: '/api/v1/auth/register',
  //       payload: {
  //         username: 'testuser',
  //         email: 'test@example.com',
  //         password: 'securepassword123'
  //       }
  //     });

  //     const registerBody = JSON.parse(registerResponse.body);
  //     authToken = registerBody.data.token;
  //   });

  //   it('should validate token successfully', async () => {
  //     const response = await app.inject({
  //       method: 'GET',
  //       url: '/api/v1/auth/validate',
  //       headers: {
  //         authorization: `Bearer ${authToken}`
  //       }
  //     });

  //     expect(response.statusCode).toBe(200);
      
  //     const body = JSON.parse(response.body);
  //     expect(body.success).toBe(true);
  //     expect(body.data.user).toHaveProperty('userId');
  //     expect(body.message).toBe('Token valid');
  //   });

  //   it('should reject request without token', async () => {
  //     const response = await app.inject({
  //       method: 'GET',
  //       url: '/api/v1/auth/validate'
  //     });

  //     expect(response.statusCode).toBe(401);
  //   });

  //   it('should reject request with invalid token', async () => {
  //     const response = await app.inject({
  //       method: 'GET',
  //       url: '/api/v1/auth/validate',
  //       headers: {
  //         authorization: 'Bearer invalid-token'
  //       }
  //     });

  //     expect(response.statusCode).toBe(401);
  //   });

  //   it('should change password successfully', async () => {
  //     const response = await app.inject({
  //       method: 'PATCH',
  //       url: '/api/v1/auth/change-password',
  //       headers: {
  //         authorization: `Bearer ${authToken}`
  //       },
  //       payload: {
  //         currentPassword: 'securepassword123',
  //         newPassword: 'newsecurepassword456'
  //       }
  //     });

  //     expect(response.statusCode).toBe(200);
      
  //     const body = JSON.parse(response.body);
  //     expect(body.success).toBe(true);
  //     expect(body.message).toBe('Password updated successfully');
  //   });
  // });
});