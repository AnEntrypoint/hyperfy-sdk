import { Vector3, Entity } from '../types';

export function createVector3(x = 0, y = 0, z = 0): Vector3 {
  return [x, y, z];
}

export function addVectors(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function multiplyVector(v: Vector3, scalar: number): Vector3 {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

export function distanceBetween(a: Vector3, b: Vector3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function normalizeVector(v: Vector3): Vector3 {
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (length === 0) return createVector3();
  return [v[0] / length, v[1] / length, v[2] / length];
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function validateEntity(entity: any): entity is Entity {
  return (
    entity &&
    typeof entity.id === 'string' &&
    typeof entity.type === 'string' &&
    entity.position &&
    Array.isArray(entity.position) &&
    entity.position.length === 3 &&
    typeof entity.position[0] === 'number' &&
    typeof entity.position[1] === 'number' &&
    typeof entity.position[2] === 'number' &&
    entity.rotation &&
    Array.isArray(entity.rotation) &&
    entity.rotation.length === 3 &&
    typeof entity.rotation[0] === 'number' &&
    typeof entity.rotation[1] === 'number' &&
    typeof entity.rotation[2] === 'number' &&
    entity.scale &&
    Array.isArray(entity.scale) &&
    entity.scale.length === 3 &&
    typeof entity.scale[0] === 'number' &&
    typeof entity.scale[1] === 'number' &&
    typeof entity.scale[2] === 'number'
  );
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function sanitizeString(str: string): string {
  return str.replace(/[<>]/g, '');
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}