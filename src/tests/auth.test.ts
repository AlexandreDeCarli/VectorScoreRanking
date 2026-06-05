import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { authPlugin } from '../auth';

describe('Auth Middleware Tests', () => {
  it('should successfully sign and verify tokens globally', async () => {
    const app = new Elysia()
      .use(authPlugin)
      .get('/test-auth', ({ user }) => {
        return { user };
      });

    // 1. Sign a token using the jwt plugin instance
    const jwtInstance = (app as any).decorator.jwt || (app as any).jwt;
    expect(jwtInstance).toBeDefined();

    const token = await jwtInstance.sign({ username: 'admin_test' });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    // 2. Perform request with valid token header
    const req = new Request('http://localhost/test-auth', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.username).toBe('admin_test');
  });

  it('should return null user if Authorization header is missing', async () => {
    const app = new Elysia()
      .use(authPlugin)
      .get('/test-auth', ({ user }) => {
        return { user };
      });

    const req = new Request('http://localhost/test-auth');
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.user).toBeNull();
  });

  it('should return null user if token is invalid', async () => {
    const app = new Elysia()
      .use(authPlugin)
      .get('/test-auth', ({ user }) => {
        return { user };
      });

    const req = new Request('http://localhost/test-auth', {
      headers: {
        'Authorization': 'Bearer invalid_token_here_xyz'
      }
    });
    const res = await app.handle(req);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.user).toBeNull();
  });
});
