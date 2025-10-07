import { ErrorInfo } from '../types';

export class HyperfyError extends Error {
  public readonly code: string;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'HyperfyError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    Error.captureStackTrace(this, HyperfyError);
  }

  toJSON(): ErrorInfo {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

export class NetworkError extends HyperfyError {
  constructor(message: string, details?: any) {
    super('NETWORK_ERROR', message, details);
    this.name = 'NetworkError';
  }
}

export class WebSocketError extends HyperfyError {
  constructor(message: string, details?: any) {
    super('WEBSOCKET_ERROR', message, details);
    this.name = 'WebSocketError';
  }
}

export class EntityError extends HyperfyError {
  constructor(message: string, details?: any) {
    super('ENTITY_ERROR', message, details);
    this.name = 'EntityError';
  }
}

export class AppError extends HyperfyError {
  constructor(message: string, details?: any) {
    super('APP_ERROR', message, details);
    this.name = 'AppError';
  }
}

export class ValidationError extends HyperfyError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends HyperfyError {
  constructor(message: string, details?: any) {
    super('AUTHENTICATION_ERROR', message, details);
    this.name = 'AuthenticationError';
  }
}

export class FileNotFoundError extends HyperfyError {
  constructor(message: string, details?: any) {
    super('FILE_NOT_FOUND_ERROR', message, details);
    this.name = 'FileNotFoundError';
  }
}

export class TimeoutError extends HyperfyError {
  constructor(message: string, details?: any) {
    super('TIMEOUT_ERROR', message, details);
    this.name = 'TimeoutError';
  }
}

export class ScriptError extends HyperfyError {
  constructor(message: string, details?: any) {
    super('SCRIPT_ERROR', message, details);
    this.name = 'ScriptError';
  }
}

export function createErrorInfo(error: Error): ErrorInfo {
  if (error instanceof HyperfyError) {
    return error.toJSON();
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error.message,
    timestamp: new Date(),
    stack: error.stack,
  };
}