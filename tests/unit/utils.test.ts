import {
  createVector3,
  addVectors,
  subtractVectors,
  multiplyVector,
  distanceBetween,
  normalizeVector,
  generateId,
  validateEntity,
  deepClone,
  debounce,
  throttle,
  sanitizeString,
  isValidUrl,
  formatFileSize,
} from '../../src/utils/helpers';
import { Entity } from '../../src/types';

describe('Vector3 utilities', () => {
  describe('createVector3', () => {
    it('should create vector with default values', () => {
      const vector = createVector3();
      expect(vector).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should create vector with custom values', () => {
      const vector = createVector3(1, 2, 3);
      expect(vector).toEqual({ x: 1, y: 2, z: 3 });
    });
  });

  describe('addVectors', () => {
    it('should add two vectors', () => {
      const a = createVector3(1, 2, 3);
      const b = createVector3(4, 5, 6);
      const result = addVectors(a, b);
      expect(result).toEqual({ x: 5, y: 7, z: 9 });
    });
  });

  describe('subtractVectors', () => {
    it('should subtract two vectors', () => {
      const a = createVector3(5, 7, 9);
      const b = createVector3(1, 2, 3);
      const result = subtractVectors(a, b);
      expect(result).toEqual({ x: 4, y: 5, z: 6 });
    });
  });

  describe('multiplyVector', () => {
    it('should multiply vector by scalar', () => {
      const vector = createVector3(2, 3, 4);
      const result = multiplyVector(vector, 2);
      expect(result).toEqual({ x: 4, y: 6, z: 8 });
    });
  });

  describe('distanceBetween', () => {
    it('should calculate distance between vectors', () => {
      const a = createVector3(0, 0, 0);
      const b = createVector3(3, 4, 0);
      const distance = distanceBetween(a, b);
      expect(distance).toBe(5); // 3-4-5 triangle
    });
  });

  describe('normalizeVector', () => {
    it('should normalize vector', () => {
      const vector = createVector3(3, 4, 0);
      const normalized = normalizeVector(vector);
      const length = Math.sqrt(normalized.x ** 2 + normalized.y ** 2 + normalized.z ** 2);
      expect(length).toBeCloseTo(1, 5);
    });

    it('should handle zero vector', () => {
      const vector = createVector3(0, 0, 0);
      const normalized = normalizeVector(vector);
      expect(normalized).toEqual({ x: 0, y: 0, z: 0 });
    });
  });
});

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });
});

describe('validateEntity', () => {
  it('should validate valid entity', () => {
    const entity: Entity = {
      id: 'test-id',
      type: 'test-type',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };
    expect(validateEntity(entity)).toBe(true);
  });

  it('should reject invalid entity', () => {
    const invalidEntity = {
      id: 'test-id',
      type: 'test-type',
      // Missing position, rotation, scale
    };
    expect(validateEntity(invalidEntity)).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(validateEntity(null)).toBe(false);
    expect(validateEntity(undefined)).toBe(false);
  });
});

describe('deepClone', () => {
  it('should clone primitive values', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
  });

  it('should clone objects', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
  });

  it('should clone arrays', () => {
    const original = [1, [2, 3]];
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[1]).not.toBe(original[1]);
  });

  it('should clone dates', () => {
    const original = new Date('2023-01-01');
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should debounce function calls', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should throttle function calls', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    throttledFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

describe('sanitizeString', () => {
  it('should remove HTML tags', () => {
    const input = '<script>alert("xss")</script>Hello<>';
    const result = sanitizeString(input);
    expect(result).toBe('scriptalert("xss")/scriptHello');
  });
});

describe('isValidUrl', () => {
  it('should validate URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('invalid-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('formatFileSize', () => {
  it('should format file sizes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });
});