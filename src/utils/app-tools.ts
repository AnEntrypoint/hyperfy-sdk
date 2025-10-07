import { NodeLogger } from './logger';
import { ValidationError, AppError } from './errors';
import {
  Vector3,
  Quaternion,
  Entity,
  Blueprint,
  App,
  Transform3D,
  BoundingBox,
  RaycastResult,
  Material,
  Animation,
  PhysicsProperties,
  AssetFile
} from '../types';
import { generateId } from './helpers';

/**
 * Utility functions for app development and building
 */
export class AppTools {
  private static logger = new NodeLogger('AppTools');

  // Vector3 Operations
  static addVectors(a: Vector3, b: Vector3): Vector3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  static subtractVectors(a: Vector3, b: Vector3): Vector3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  static multiplyVectors(a: Vector3, b: Vector3): Vector3 {
    return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
  }

  static multiplyVectorByScalar(vector: Vector3, scalar: number): Vector3 {
    return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
  }

  static divideVectorByScalar(vector: Vector3, scalar: number): Vector3 {
    if (scalar === 0) throw new ValidationError('Cannot divide by zero');
    return [vector[0] / scalar, vector[1] / scalar, vector[2] / scalar];
  }

  static normalizeVector(vector: Vector3): Vector3 {
    const length = this.vectorLength(vector);
    if (length === 0) return [0, 0, 0];
    return this.divideVectorByScalar(vector, length);
  }

  static vectorLength(vector: Vector3): number {
    return Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2);
  }

  static distanceBetween(a: Vector3, b: Vector3): number {
    return this.vectorLength(this.subtractVectors(b, a));
  }

  static lerpVector(a: Vector3, b: Vector3, t: number): Vector3 {
    return this.addVectors(a, this.multiplyVectorByScalar(this.subtractVectors(b, a), t));
  }

  static dotProduct(a: Vector3, b: Vector3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  static crossProduct(a: Vector3, b: Vector3): Vector3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  // Quaternion Operations
  static createQuaternion(axis: Vector3, angle: number): Quaternion {
    const halfAngle = angle / 2;
    const sinHalf = Math.sin(halfAngle);
    const normalizedAxis = this.normalizeVector(axis);

    return [
      normalizedAxis[0] * sinHalf,
      normalizedAxis[1] * sinHalf,
      normalizedAxis[2] * sinHalf,
      Math.cos(halfAngle)
    ];
  }

  static multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
    ];
  }

  static normalizeQuaternion(quaternion: Quaternion): Quaternion {
    const length = Math.sqrt(
      quaternion[0] ** 2 + quaternion[1] ** 2 + quaternion[2] ** 2 + quaternion[3] ** 2
    );
    if (length === 0) return [0, 0, 0, 1];
    return [
      quaternion[0] / length,
      quaternion[1] / length,
      quaternion[2] / length,
      quaternion[3] / length
    ];
  }

  static quaternionToEuler(quaternion: Quaternion): Vector3 {
    const [x, y, z, w] = quaternion;

    const test = x * y + z * w;
    if (test > 0.499) {
      return [Math.PI / 2, 2 * Math.atan2(x, w), 0];
    }
    if (test < -0.499) {
      return [-Math.PI / 2, -2 * Math.atan2(x, w), 0];
    }

    const sqx = x * x;
    const sqy = y * y;
    const sqz = z * z;

    return [
      Math.asin(2 * test),
      Math.atan2(2 * y * w - 2 * x * z, 1 - 2 * sqy - 2 * sqz),
      Math.atan2(2 * x * w - 2 * y * z, 1 - 2 * sqx - 2 * sqz)
    ];
  }

  static eulerToQuaternion(euler: Vector3): Quaternion {
    const [x, y, z] = euler;
    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(z / 2);

    return [
      s1 * c2 * c3 + c1 * s2 * s3,
      c1 * s2 * c3 - s1 * c2 * s3,
      c1 * c2 * s3 + s1 * s2 * c3,
      c1 * c2 * c3 - s1 * s2 * s3
    ];
  }

  // Transform Operations
  static createTransform(
    position: Vector3 = [0, 0, 0],
    rotation: Quaternion = [0, 0, 0, 1],
    scale: Vector3 = [1, 1, 1]
  ): Transform3D {
    return { position, rotation, scale };
  }

  static transformPoint(point: Vector3, transform: Transform3D): Vector3 {
    // Apply scale
    let result = this.multiplyVectors(point, transform.scale);

    // Apply rotation (quaternion multiplication would be more complex)
    // For simplicity, this is a basic implementation
    const euler = this.quaternionToEuler(transform.rotation);
    const rotated = this.rotatePoint(result, euler);

    // Apply translation
    return this.addVectors(rotated, transform.position);
  }

  static rotatePoint(point: Vector3, euler: Vector3): Vector3 {
    const [x, y, z] = point;
    const [rx, ry, rz] = euler;

    // Rotate around X axis
    let y1 = y * Math.cos(rx) - z * Math.sin(rx);
    let z1 = y * Math.sin(rx) + z * Math.cos(rx);

    // Rotate around Y axis
    let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
    let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);

    // Rotate around Z axis
    let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
    let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);

    return [x3, y3, z2];
  }

  static lookAt(from: Vector3, to: Vector3, up: Vector3 = [0, 1, 0]): Quaternion {
    const forward = this.normalizeVector(this.subtractVectors(to, from));
    const right = this.normalizeVector(this.crossProduct(forward, up));
    const newUp = this.crossProduct(right, forward);

    // Create rotation matrix from basis vectors
    const matrix = [
      right[0], newUp[0], -forward[0], 0,
      right[1], newUp[1], -forward[1], 0,
      right[2], newUp[2], -forward[2], 0,
      0, 0, 0, 1
    ];

    // Convert rotation matrix to quaternion
    return this.rotationMatrixToQuaternion(matrix);
  }

  private static rotationMatrixToQuaternion(matrix: number[]): Quaternion {
    const m = matrix;
    const trace = m[0] + m[5] + m[10];

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      return [
        (m[6] - m[9]) * s,
        (m[8] - m[2]) * s,
        (m[1] - m[4]) * s,
        0.25 / s
      ];
    } else if (m[0] > m[5] && m[0] > m[10]) {
      const s = 2.0 * Math.sqrt(1.0 + m[0] - m[5] - m[10]);
      return [
        0.25 * s,
        (m[1] + m[4]) / s,
        (m[8] + m[2]) / s,
        (m[6] - m[9]) / s
      ];
    } else if (m[5] > m[10]) {
      const s = 2.0 * Math.sqrt(1.0 + m[5] - m[0] - m[10]);
      return [
        (m[1] + m[4]) / s,
        0.25 * s,
        (m[6] + m[9]) / s,
        (m[8] - m[2]) / s
      ];
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m[10] - m[0] - m[5]);
      return [
        (m[8] + m[2]) / s,
        (m[6] + m[9]) / s,
        0.25 * s,
        (m[1] - m[4]) / s
      ];
    }
  }

  // Bounding Box Operations
  static createBoundingBox(min: Vector3, max: Vector3): BoundingBox {
    return { min, max, center: this.lerpVector(min, max, 0.5), size: this.subtractVectors(max, min) };
  }

  static expandBoundingBox(bbox: BoundingBox, amount: Vector3): BoundingBox {
    return this.createBoundingBox(
      this.subtractVectors(bbox.min, amount),
      this.addVectors(bbox.max, amount)
    );
  }

  static containsPoint(bbox: BoundingBox, point: Vector3): boolean {
    return point[0] >= bbox.min[0] && point[0] <= bbox.max[0] &&
           point[1] >= bbox.min[1] && point[1] <= bbox.max[1] &&
           point[2] >= bbox.min[2] && point[2] <= bbox.max[2];
  }

  static intersectsBoundingBox(a: BoundingBox, b: BoundingBox): boolean {
    return a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
           a.min[1] <= b.max[1] && a.max[1] >= b.min[1] &&
           a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
  }

  static mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox | null {
    if (boxes.length === 0) return null;

    let min = [...boxes[0].min];
    let max = [...boxes[0].max];

    for (let i = 1; i < boxes.length; i++) {
      const box = boxes[i];
      min = [
        Math.min(min[0], box.min[0]),
        Math.min(min[1], box.min[1]),
        Math.min(min[2], box.min[2])
      ];
      max = [
        Math.max(max[0], box.max[0]),
        Math.max(max[1], box.max[1]),
        Math.max(max[2], box.max[2])
      ];
    }

    return this.createBoundingBox(min, max);
  }

  // Raycasting
  static rayIntersectsBox(
    origin: Vector3,
    direction: Vector3,
    bbox: BoundingBox
  ): { hit: boolean; distance?: number; point?: Vector3; normal?: Vector3 } {
    const invDir = [1 / direction[0], 1 / direction[1], 1 / direction[2]];
    const t1 = (bbox.min[0] - origin[0]) * invDir[0];
    const t2 = (bbox.max[0] - origin[0]) * invDir[0];
    const t3 = (bbox.min[1] - origin[1]) * invDir[1];
    const t4 = (bbox.max[1] - origin[1]) * invDir[1];
    const t5 = (bbox.min[2] - origin[2]) * invDir[2];
    const t6 = (bbox.max[2] - origin[2]) * invDir[2];

    const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

    if (tmax < 0 || tmin > tmax) {
      return { hit: false };
    }

    const distance = tmin > 0 ? tmin : tmax;
    const point = this.addVectors(origin, this.multiplyVectorByScalar(direction, distance));

    // Calculate normal (simplified)
    const normal = this.calculateBoxNormal(point, bbox);

    return { hit: true, distance, point, normal };
  }

  private static calculateBoxNormal(point: Vector3, bbox: BoundingBox): Vector3 {
    const epsilon = 0.001;
    const normal = [0, 0, 0] as Vector3;

    if (Math.abs(point[0] - bbox.min[0]) < epsilon) normal[0] = -1;
    else if (Math.abs(point[0] - bbox.max[0]) < epsilon) normal[0] = 1;
    else if (Math.abs(point[1] - bbox.min[1]) < epsilon) normal[1] = -1;
    else if (Math.abs(point[1] - bbox.max[1]) < epsilon) normal[1] = 1;
    else if (Math.abs(point[2] - bbox.min[2]) < epsilon) normal[2] = -1;
    else if (Math.abs(point[2] - bbox.max[2]) < epsilon) normal[2] = 1;

    return normal;
  }

  // Entity Utilities
  static createEntity(type: string, properties: any = {}): Entity {
    return {
      id: generateId(),
      type,
      position: properties.position || [0, 0, 0],
      rotation: properties.rotation || [0, 0, 0, 1],
      scale: properties.scale || [1, 1, 1],
      visible: properties.visible !== false,
      locked: properties.locked || false,
      parent: properties.parent || null,
      children: properties.children || [],
      components: properties.components || [],
      material: properties.material || null,
      physics: properties.physics || null,
      animation: properties.animation || null,
      properties: properties.properties || {},
      tags: properties.tags || [],
      ...properties
    };
  }

  static cloneEntity(entity: Entity, offset: Vector3 = [0, 0, 0]): Entity {
    const clone = JSON.parse(JSON.stringify(entity));
    clone.id = generateId();
    clone.position = this.addVectors(entity.position, offset);
    return clone;
  }

  static findEntitiesByType(entities: Entity[], type: string): Entity[] {
    return entities.filter(entity => entity.type === type);
  }

  static findEntitiesByTag(entities: Entity[], tag: string): Entity[] {
    return entities.filter(entity => entity.tags.includes(tag));
  }

  static findEntitiesInRadius(entities: Entity[], center: Vector3, radius: number): Entity[] {
    return entities.filter(entity =>
      this.distanceBetween(entity.position, center) <= radius
    );
  }

  static sortEntitiesByDistance(entities: Entity[], from: Vector3): Entity[] {
    return [...entities].sort((a, b) =>
      this.distanceBetween(a.position, from) - this.distanceBetween(b.position, from)
    );
  }

  // Material Utilities
  static createMaterial(properties: Partial<Material> = {}): Material {
    return {
      id: generateId(),
      type: properties.type || 'standard',
      color: properties.color || [1, 1, 1],
      metalness: properties.metalness || 0,
      roughness: properties.roughness || 1,
      opacity: properties.opacity || 1,
      transparent: properties.transparent || false,
      emissive: properties.emissive || [0, 0, 0],
      emissiveIntensity: properties.emissiveIntensity || 0,
      texture: properties.texture || null,
      normalMap: properties.normalMap || null,
      roughnessMap: properties.roughnessMap || null,
      metalnessMap: properties.metalnessMap || null,
      aoMap: properties.aoMap || null,
      properties: properties.properties || {},
      ...properties
    };
  }

  static createGlassMaterial(color: Vector3 = [1, 1, 1]): Material {
    return this.createMaterial({
      type: 'glass',
      color,
      metalness: 0,
      roughness: 0,
      opacity: 0.3,
      transparent: true
    });
  }

  static createMetalMaterial(color: Vector3 = [0.7, 0.7, 0.7]): Material {
    return this.createMaterial({
      type: 'metal',
      color,
      metalness: 1,
      roughness: 0.2
    });
  }

  static createEmissiveMaterial(color: Vector3, intensity: number = 1): Material {
    return this.createMaterial({
      type: 'emissive',
      emissive: color,
      emissiveIntensity: intensity
    });
  }

  // Animation Utilities
  static createAnimation(properties: Partial<Animation> = {}): Animation {
    return {
      id: generateId(),
      name: properties.name || 'Animation',
      duration: properties.duration || 1,
      loop: properties.loop || false,
      autoplay: properties.autoplay || false,
      keyframes: properties.keyframes || [],
      properties: properties.properties || {},
      ...properties
    };
  }

  static createKeyframe(time: number, values: Record<string, any>, easing: string = 'linear'): any {
    return {
      time,
      values,
      easing
    };
  }

  // Physics Utilities
  static createPhysicsProperties(properties: Partial<PhysicsProperties> = {}): PhysicsProperties {
    return {
      type: properties.type || 'static',
      mass: properties.mass || 1,
      friction: properties.friction || 0.5,
      restitution: properties.restitution || 0.1,
      linearDamping: properties.linearDamping || 0.01,
      angularDamping: properties.angularDamping || 0.01,
      velocity: properties.velocity || [0, 0, 0],
      angularVelocity: properties.angularVelocity || [0, 0, 0],
      constraints: properties.constraints || [],
      properties: properties.properties || {},
      ...properties
    };
  }

  static calculateVelocity(from: Vector3, to: Vector3, deltaTime: number): Vector3 {
    if (deltaTime === 0) return [0, 0, 0];
    return this.divideVectorByScalar(this.subtractVectors(to, from), deltaTime);
  }

  static applyForce(velocity: Vector3, force: Vector3, mass: number, deltaTime: number): Vector3 {
    const acceleration = this.divideVectorByScalar(force, mass);
    const deltaVelocity = this.multiplyVectorByScalar(acceleration, deltaTime);
    return this.addVectors(velocity, deltaVelocity);
  }

  // Asset Utilities
  static validateAssetFile(file: AssetFile): boolean {
    if (!file.name || !file.type || !file.size) {
      return false;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return false;
    }

    const allowedTypes = [
      'model/gltf+json',
      'model/gltf-binary',
      'image/jpeg',
      'image/png',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'application/javascript'
    ];

    return allowedTypes.includes(file.type);
  }

  static getAssetExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  static isModelAsset(filename: string): boolean {
    const extension = this.getAssetExtension(filename);
    return ['glb', 'gltf', 'fbx', 'obj'].includes(extension);
  }

  static isImageAsset(filename: string): boolean {
    const extension = this.getAssetExtension(filename);
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension);
  }

  static isAudioAsset(filename: string): boolean {
    const extension = this.getAssetExtension(filename);
    return ['mp3', 'wav', 'ogg', 'm4a'].includes(extension);
  }

  static isScriptAsset(filename: string): boolean {
    const extension = this.getAssetExtension(filename);
    return ['js', 'ts', 'jsx', 'tsx'].includes(extension);
  }

  // Scene Utilities
  static calculateSceneBounds(entities: Entity[]): BoundingBox | null {
    if (entities.length === 0) return null;

    const bounds: BoundingBox[] = [];

    for (const entity of entities) {
      // Create a simple bounding box around entity position
      const size = entity.scale || [1, 1, 1];
      const halfSize = this.multiplyVectorByScalar(size, 0.5);
      const min = this.subtractVectors(entity.position, halfSize);
      const max = this.addVectors(entity.position, halfSize);
      bounds.push(this.createBoundingBox(min, max));
    }

    return this.mergeBoundingBoxes(bounds);
  }

  static optimizeScene(entities: Entity[]): {
    optimized: Entity[];
    removed: Entity[];
    merged: Entity[];
  } {
    const optimized: Entity[] = [];
    const removed: Entity[] = [];
    const merged: Entity[] = [];

    // Remove duplicate or invalid entities
    const seen = new Set();
    for (const entity of entities) {
      if (!entity.id || seen.has(entity.id)) {
        removed.push(entity);
        continue;
      }
      seen.add(entity.id);

      // Skip entities that are too small or invalid
      if (this.vectorLength(entity.scale || [1, 1, 1]) < 0.01) {
        removed.push(entity);
        continue;
      }

      optimized.push(entity);
    }

    // Merge similar entities (simplified)
    const groups = new Map<string, Entity[]>();
    for (const entity of optimized) {
      const key = `${entity.type}_${JSON.stringify(entity.material)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entity);
    }

    const finalOptimized: Entity[] = [];
    for (const [key, group] of groups) {
      if (group.length > 5) {
        // Merge similar entities into one
        const mergedEntity = this.mergeSimilarEntities(group);
        finalOptimized.push(mergedEntity);
        merged.push(...group.slice(1));
      } else {
        finalOptimized.push(...group);
      }
    }

    return {
      optimized: finalOptimized,
      removed,
      merged
    };
  }

  private static mergeSimilarEntities(entities: Entity[]): Entity {
    if (entities.length === 0) {
      throw new ValidationError('Cannot merge empty entity list');
    }

    const base = { ...entities[0] };
    base.id = generateId();

    // Calculate average position
    const sumPosition = entities.reduce((sum, entity) =>
      this.addVectors(sum, entity.position), [0, 0, 0] as Vector3
    );
    base.position = this.divideVectorByScalar(sumPosition, entities.length);

    return base;
  }

  // Color Utilities
  static hexToRgb(hex: string): Vector3 {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [1, 1, 1];
  }

  static rgbToHex(rgb: Vector3): string {
    const toHex = (value: number) => {
      const hex = Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(rgb[0]) + toHex(rgb[1]) + toHex(rgb[2]);
  }

  static hslToRgb(hsl: Vector3): Vector3 {
    const [h, s, l] = hsl;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 1/6) { r = c; g = x; b = 0; }
    else if (h < 2/6) { r = x; g = c; b = 0; }
    else if (h < 3/6) { r = 0; g = c; b = x; }
    else if (h < 4/6) { r = 0; g = x; b = c; }
    else if (h < 5/6) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [r + m, g + m, b + m];
  }

  static rgbToHsl(rgb: Vector3): Vector3 {
    const [r, g, b] = rgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
      return [0, 0, l];
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;

    return [h, s, l];
  }

  // Random Utilities
  static randomVector(min: Vector3 = [0, 0, 0], max: Vector3 = [1, 1, 1]): Vector3 {
    return [
      Math.random() * (max[0] - min[0]) + min[0],
      Math.random() * (max[1] - min[1]) + min[1],
      Math.random() * (max[2] - min[2]) + min[2]
    ];
  }

  static randomColor(): Vector3 {
    return [Math.random(), Math.random(), Math.random()];
  }

  static randomQuaternion(): Quaternion {
    return this.normalizeQuaternion([
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ]);
  }

  static randomPointInSphere(radius: number = 1): Vector3 {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(1 - 2 * Math.random());
    const r = radius * Math.cbrt(Math.random());

    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    ];
  }

  // Validation Utilities
  static validateEntity(entity: Entity): boolean {
    if (!entity.id || !entity.type) {
      return false;
    }

    if (!Array.isArray(entity.position) || entity.position.length !== 3) {
      return false;
    }

    if (!Array.isArray(entity.rotation) || entity.rotation.length !== 4) {
      return false;
    }

    if (!Array.isArray(entity.scale) || entity.scale.length !== 3) {
      return false;
    }

    return true;
  }

  static validateBlueprint(blueprint: Blueprint): boolean {
    if (!blueprint.id || !blueprint.name || !blueprint.author) {
      return false;
    }

    if (blueprint.version < 0) {
      return false;
    }

    if (blueprint.props && typeof blueprint.props !== 'object') {
      return false;
    }

    return true;
  }

  static validateApp(app: App): boolean {
    if (!app.id || !app.name || !app.url) {
      return false;
    }

    if (app.settings && typeof app.settings !== 'object') {
      return false;
    }

    return true;
  }

  // Performance Utilities
  static async measurePerformance<T>(
    operation: () => T | Promise<T>,
    iterations: number = 1
  ): Promise<{ result: T; averageTime: number; totalTime: number; iterations: number }> {
    const startTime = performance.now();
    let result: T;

    for (let i = 0; i < iterations; i++) {
      result = await operation();
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;

    return { result: result!, averageTime, totalTime, iterations };
  }

  static createPerformanceMonitor(): {
    start: (name: string) => void;
    end: (name: string) => number;
    getMeasurements: () => Record<string, number>;
    clear: () => void;
  } {
    const measurements: Record<string, number> = {};
    const startTimes: Record<string, number> = {};

    return {
      start: (name: string) => {
        startTimes[name] = performance.now();
      },
      end: (name: string) => {
        const startTime = startTimes[name];
        if (startTime === undefined) {
          throw new Error(`Performance measurement '${name}' was not started`);
        }
        const endTime = performance.now();
        measurements[name] = endTime - startTime;
        delete startTimes[name];
        return measurements[name];
      },
      getMeasurements: () => ({ ...measurements }),
      clear: () => {
        Object.keys(measurements).forEach(key => delete measurements[key]);
        Object.keys(startTimes).forEach(key => delete startTimes[key]);
      }
    };
  }
}