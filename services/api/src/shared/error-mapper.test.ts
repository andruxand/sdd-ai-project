import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock observability before importing error-mapper to avoid powertools init
vi.mock('./observability.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  AuthorizationError,
  InternalError,
  NotFoundError,
  ValidationError,
} from '../domain/errors/index.js';

import { mapDomainErrorToHttp } from './error-mapper.js';

describe('mapDomainErrorToHttp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps ValidationError (4xx) to correct statusCode and body', () => {
    const result = mapDomainErrorToHttp(new ValidationError('bad input'));
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('bad input');
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('maps NotFoundError (4xx) to 404', () => {
    const result = mapDomainErrorToHttp(new NotFoundError('User', '1'));
    expect(result.statusCode).toBe(404);
  });

  it('maps AuthorizationError (4xx) to 403', () => {
    const result = mapDomainErrorToHttp(new AuthorizationError());
    expect(result.statusCode).toBe(403);
  });

  it('maps InternalError (5xx) to 500 with generic message (never leaks)', () => {
    const result = mapDomainErrorToHttp(
      new InternalError('real internal detail'),
    );
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Internal server error');
    expect(body.error).not.toContain('real internal detail');
  });

  it('maps unknown error to 500 with generic message', () => {
    const result = mapDomainErrorToHttp(new Error('unexpected'));
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Internal server error');
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
