import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DomainError,
  ExternalDependencyError,
  InternalError,
  NotFoundError,
  RateLimitError,
  UnprocessableError,
  ValidationError,
} from './index.js';

describe('DomainError hierarchy', () => {
  it('ValidationError → 400, code, fields in metadata', () => {
    const err = new ValidationError('bad input', { email: 'required' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.metadata).toMatchObject({ fields: { email: 'required' } });
    expect(err instanceof DomainError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('AuthenticationError → 401', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTHENTICATION_ERROR');
  });

  it('AuthorizationError → 403', () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('AUTHORIZATION_ERROR');
  });

  it('NotFoundError → 404 with id', () => {
    const err = new NotFoundError('User', '42');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("User with id '42' not found");
  });

  it('NotFoundError → 404 without id', () => {
    const err = new NotFoundError('User');
    expect(err.message).toBe('User not found');
  });

  it('ConflictError → 409', () => {
    const err = new ConflictError('duplicate key');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT_ERROR');
  });

  it('UnprocessableError → 422', () => {
    const err = new UnprocessableError('rule violated', 'MAX_QUANTITY');
    expect(err.statusCode).toBe(422);
    expect(err.metadata).toMatchObject({ rule: 'MAX_QUANTITY' });
  });

  it('RateLimitError → 429', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
  });

  it('ExternalDependencyError → 502, hides cause detail', () => {
    const cause = new Error('connection refused');
    const err = new ExternalDependencyError('DynamoDB', cause);
    expect(err.statusCode).toBe(502);
    expect(err.message).toBe("Upstream dependency 'DynamoDB' failed");
    expect(err.metadata).toMatchObject({ cause: 'connection refused' });
  });

  it('InternalError → 500', () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  it('preserves instanceof chain across subclasses', () => {
    const err = new NotFoundError('Item');
    expect(err instanceof NotFoundError).toBe(true);
    expect(err instanceof DomainError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});
