import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ERROR_CODES } from '@pulsar/shared';
import { logger } from '../utils/logger.js';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      details: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: ERROR_CODES.RATE_LIMITED,
      message: 'Too many requests, please slow down',
    });
  }

  // Known HTTP errors
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: error.code || 'BAD_REQUEST',
      message: error.message,
    });
  }

  // Unexpected errors
  logger.error({ err: error, url: request.url, method: request.method }, 'Unhandled error');

  return reply.status(500).send({
    error: ERROR_CODES.INTERNAL_ERROR,
    message: 'Internal server error',
  });
}
