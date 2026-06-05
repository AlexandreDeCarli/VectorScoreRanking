import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';

export const authPlugin = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'local_jwt_secret',
    })
  )
  .derive({ as: 'global' }, async ({ jwt, headers }) => {
    const authHeader = headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null };
    }
    const token = authHeader.substring(7);
    const payload = await jwt.verify(token);
    if (!payload) {
      return { user: null };
    }
    return { user: payload };
  });
