import * as THREE from 'three';
import {
  PhysicsProperties,
  CollisionInfo,
  RaycastHit,
  Vector3,
  EventEmitter
} from '../types';

// Utility vectors
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);
const RIGHT = new THREE.Vector3(1, 0, 0);

const tempVector1 = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempVector3 = new THREE.Vector3();
const tempVector4 = new THREE.Vector3();
const tempQuaternion1 = new THREE.Quaternion();
const tempMatrix4 = new THREE.Matrix4();
const tempSphere = new THREE.Sphere();
const tempBox = new THREE.Box3();
const tempRay = new THREE.Ray();

// Constants
const DEFAULT_GRAVITY = 20;
const GROUND_CHECK_DISTANCE = 0.2;
const STEP_HEIGHT = 0.3;
const MAX_SLOPE_ANGLE = 60;
const MIN_BOUNCE_VELOCITY = 0.5;
const COLLISION_LAYERS = {
  DEFAULT: 1,
  STATIC: 2,
  DYNAMIC: 4,
  PLAYER: 8,
  TRIGGER: 16,
  ENVIRONMENT: 32,
  PROP: 64
};

interface PhysicsBody {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  angularAcceleration: THREE.Vector3;
  mass: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  layer: number;
  shape: 'box' | 'sphere' | 'capsule' | 'mesh';
  size: THREE.Vector3;
  quaternion: THREE.Quaternion;
  isKinematic: boolean;
  isTrigger: boolean;
  enabled: boolean;
}

interface CollisionPair {
  bodyA: PhysicsBody;
  bodyB: PhysicsBody;
  contacts: ContactPoint[];
}

interface ContactPoint {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  penetration: number;
  impulse: THREE.Vector3;
}

export class PhysicsSystem implements EventEmitter {
  public enabled: boolean;
  public gravity: THREE.Vector3;
  public bodies: Map<string, PhysicsBody>;
  public layers: typeof COLLISION_LAYERS;

  // Collision detection
  private collisionMatrix: Map<string, Set<string>>;
  private collisionPairs: CollisionPair[];
  private broadPhasePairs: Set<string>;

  // Raycast and sweep results
  private raycastHits: RaycastHit[] = [];
  private sweepHits: RaycastHit[] = [];

  // Performance tracking
  private performance: {
    bodyCount: number;
    collisionChecks: number;
    raycastCount: number;
    updateTime: number;
  };

  // Event handling
  private events: Map<string, Function[]> = new Map();

  // Physics world
  private worldBounds: THREE.Box3;
  private maxVelocity: number = 100;
  private maxAngularVelocity: number = 10;

  constructor() {
    this.enabled = true;
    this.gravity = new THREE.Vector3(0, -DEFAULT_GRAVITY, 0);
    this.bodies = new Map();
    this.layers = { ...COLLISION_LAYERS };
    this.collisionMatrix = new Map();
    this.collisionPairs = [];
    this.broadPhasePairs = new Set();

    // Initialize performance tracking
    this.performance = {
      bodyCount: 0,
      collisionChecks: 0,
      raycastCount: 0,
      updateTime: 0
    };

    // Set world bounds (infinite by default)
    this.worldBounds = new THREE.Box3(
      new THREE.Vector3(-Infinity, -Infinity, -Infinity),
      new THREE.Vector3(Infinity, Infinity, Infinity)
    );
  }

  // Event emitter implementation
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in physics system event listener for ${event}:`, error);
        }
      });
    }
  }

  once(event: string, listener: (...args: any[]) => void): void {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    this.on(event, onceWrapper);
  }

  // Body management
  addBody(config: Partial<PhysicsBody> & { id: string }): PhysicsBody {
    const body: PhysicsBody = {
      id: config.id,
      position: config.position || new THREE.Vector3(),
      velocity: config.velocity || new THREE.Vector3(),
      acceleration: config.acceleration || new THREE.Vector3(),
      angularVelocity: config.angularVelocity || new THREE.Vector3(),
      angularAcceleration: config.angularAcceleration || new THREE.Vector3(),
      mass: config.mass || 1,
      friction: config.friction || 0.5,
      restitution: config.restitution || 0.1,
      linearDamping: config.linearDamping || 0.05,
      angularDamping: config.angularDamping || 0.05,
      layer: config.layer || this.layers.DEFAULT,
      shape: config.shape || 'box',
      size: config.size || new THREE.Vector3(1, 1, 1),
      quaternion: config.quaternion || new THREE.Quaternion(),
      isKinematic: config.isKinematic || false,
      isTrigger: config.isTrigger || false,
      enabled: config.enabled !== false
    };

    this.bodies.set(body.id, body);
    this.updatePerformance();
    this.emit('bodyAdded', { body });
    return body;
  }

  removeBody(id: string): boolean {
    const body = this.bodies.get(id);
    if (!body) return false;

    this.bodies.delete(id);
    this.collisionMatrix.delete(id);
    this.updatePerformance();
    this.emit('bodyRemoved', { body });
    return true;
  }

  getBody(id: string): PhysicsBody | undefined {
    return this.bodies.get(id);
  }

  // Main physics update
  update(delta: number): void {
    if (!this.enabled) return;

    const startTime = performance.now();

    // Clear previous collision pairs
    this.collisionPairs = [];
    this.broadPhasePairs.clear();

    // Update physics for all bodies
    for (const body of this.bodies.values()) {
      if (!body.enabled || body.isKinematic) continue;

      this.updateBody(body, delta);
    }

    // Collision detection
    this.detectCollisions();
    this.resolveCollisions(delta);

    // Update performance metrics
    this.performance.updateTime = performance.now() - startTime;
  }

  private updateBody(body: PhysicsBody, delta: number): void {
    // Apply gravity
    if (body.mass > 0 && !body.isKinematic) {
      tempVector1.copy(this.gravity).multiplyScalar(body.mass * delta);
      body.acceleration.add(tempVector1);
    }

    // Update velocity with acceleration
    tempVector1.copy(body.acceleration).multiplyScalar(delta);
    body.velocity.add(tempVector1);

    // Apply damping
    const dampingFactor = Math.pow(1 - body.linearDamping, delta);
    body.velocity.multiplyScalar(dampingFactor);
    body.angularVelocity.multiplyScalar(dampingFactor);

    // Clamp velocities
    this.clampVelocity(body);

    // Update position with velocity
    tempVector1.copy(body.velocity).multiplyScalar(delta);
    body.position.add(tempVector1);

    // Update rotation with angular velocity
    if (body.angularVelocity.length() > 0) {
      tempQuaternion1.setFromEuler(
        tempVector1.copy(body.angularVelocity).multiplyScalar(delta)
      );
      body.quaternion.multiply(tempQuaternion1);
    }

    // Reset acceleration for next frame
    body.acceleration.set(0, 0, 0);
    body.angularAcceleration.set(0, 0, 0);

    // Keep body within world bounds
    this.enforceWorldBounds(body);
  }

  private clampVelocity(body: PhysicsBody): void {
    // Clamp linear velocity
    if (body.velocity.length() > this.maxVelocity) {
      body.velocity.normalize().multiplyScalar(this.maxVelocity);
    }

    // Clamp angular velocity
    if (body.angularVelocity.length() > this.maxAngularVelocity) {
      body.angularVelocity.normalize().multiplyScalar(this.maxAngularVelocity);
    }
  }

  private enforceWorldBounds(body: PhysicsBody): void {
    const bounds = this.getBodyBounds(body);

    // Check each axis
    ['x', 'y', 'z'].forEach(axis => {
      const axisIndex = axis as 'x' | 'y' | 'z';
      if (bounds.min[axisIndex] < this.worldBounds.min[axisIndex]) {
        body.position[axisIndex] += this.worldBounds.min[axisIndex] - bounds.min[axisIndex];
        body.velocity[axisIndex] *= -body.restitution;
      }
      if (bounds.max[axisIndex] > this.worldBounds.max[axisIndex]) {
        body.position[axisIndex] -= bounds.max[axisIndex] - this.worldBounds.max[axisIndex];
        body.velocity[axisIndex] *= -body.restitution;
      }
    });
  }

  // Collision detection
  private detectCollisions(): void {
    // Broad phase collision detection
    this.broadPhaseCollision();

    // Narrow phase collision detection
    this.narrowPhaseCollision();
  }

  private broadPhaseCollision(): void {
    const bodies = Array.from(this.bodies.values());

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];

        // Skip if either body is disabled
        if (!bodyA.enabled || !bodyB.enabled) continue;

        // Skip if both bodies are triggers
        if (bodyA.isTrigger && bodyB.isTrigger) continue;

        // Check if layers collide
        if (!this.layersCollide(bodyA.layer, bodyB.layer)) continue;

        // Check AABB intersection
        if (this.aabbIntersect(bodyA, bodyB)) {
          const pairKey = this.getPairKey(bodyA.id, bodyB.id);
          this.broadPhasePairs.add(pairKey);
        }
      }
    }

    this.performance.collisionChecks = this.broadPhasePairs.size;
  }

  private narrowPhaseCollision(): void {
    for (const pairKey of this.broadPhasePairs) {
      const [idA, idB] = pairKey.split(':');
      const bodyA = this.bodies.get(idA);
      const bodyB = this.bodies.get(idB);

      if (!bodyA || !bodyB) continue;

      const contacts = this.computeContacts(bodyA, bodyB);
      if (contacts.length > 0) {
        this.collisionPairs.push({
          bodyA,
          bodyB,
          contacts
        });
      }
    }
  }

  private layersCollide(layerA: number, layerB: number): boolean {
    return (layerA & layerB) !== 0;
  }

  private aabbIntersect(bodyA: PhysicsBody, bodyB: PhysicsBody): boolean {
    const boundsA = this.getBodyBounds(bodyA);
    const boundsB = this.getBodyBounds(bodyB);
    return boundsA.intersectsBox(boundsB);
  }

  private computeContacts(bodyA: PhysicsBody, bodyB: PhysicsBody): ContactPoint[] {
    const contacts: ContactPoint[] = [];

    // Simple sphere-sphere collision for now
    // In a real implementation, this would handle different shape combinations
    if (bodyA.shape === 'sphere' && bodyB.shape === 'sphere') {
      const contact = this.sphereSphereContact(bodyA, bodyB);
      if (contact) contacts.push(contact);
    } else {
      // Default to box-box collision
      const contact = this.boxBoxContact(bodyA, bodyB);
      if (contact) contacts.push(contact);
    }

    return contacts;
  }

  private sphereSphereContact(bodyA: PhysicsBody, bodyB: PhysicsBody): ContactPoint | null {
    const radiusA = bodyA.size.x / 2;
    const radiusB = bodyB.size.x / 2;

    tempVector1.copy(bodyB.position).sub(bodyA.position);
    const distance = tempVector1.length();
    const minDistance = radiusA + radiusB;

    if (distance < minDistance) {
      tempVector1.normalize();
      const penetration = minDistance - distance;
      const contactPosition = tempVector2.copy(bodyA.position).add(
        tempVector1.multiplyScalar(radiusA - penetration / 2)
      );

      return {
        position: contactPosition,
        normal: tempVector1,
        penetration,
        impulse: new THREE.Vector3()
      };
    }

    return null;
  }

  private boxBoxContact(bodyA: PhysicsBody, bodyB: PhysicsBody): ContactPoint | null {
    const boundsA = this.getBodyBounds(bodyA);
    const boundsB = this.getBodyBounds(bodyB);

    // Simple AABB collision
    if (boundsA.intersectsBox(boundsB)) {
      // Calculate penetration depth and contact normal
      const overlap = this.calculateAABBOverlap(boundsA, boundsB);
      if (overlap) {
        const contactPosition = tempVector1.addVectors(boundsA.getCenter(tempVector2), boundsB.getCenter(tempVector3)).multiplyScalar(0.5);

        return {
          position: contactPosition,
          normal: overlap.normal,
          penetration: overlap.depth,
          impulse: new THREE.Vector3()
        };
      }
    }

    return null;
  }

  private calculateAABBOverlap(boxA: THREE.Box3, boxB: THREE.Box3): { normal: THREE.Vector3; depth: number } | null {
    const centerA = boxA.getCenter(tempVector1);
    const centerB = boxB.getCenter(tempVector2);
    const sizeA = boxA.getSize(tempVector3);
    const sizeB = boxB.getSize(tempVector4);

    // Calculate overlap on each axis
    const overlapX = (sizeA.x + sizeB.x) / 2 - Math.abs(centerA.x - centerB.x);
    const overlapY = (sizeA.y + sizeB.y) / 2 - Math.abs(centerA.y - centerB.y);
    const overlapZ = (sizeA.z + sizeB.z) / 2 - Math.abs(centerA.z - centerB.z);

    if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) return null;

    // Find the axis with minimum penetration (SAT)
    let minDepth = overlapX;
    let normal = new THREE.Vector3(1, 0, 0);

    if (overlapY < minDepth) {
      minDepth = overlapY;
      normal = new THREE.Vector3(0, 1, 0);
    }
    if (overlapZ < minDepth) {
      minDepth = overlapZ;
      normal = new THREE.Vector3(0, 0, 1);
    }

    // Determine normal direction
    if (centerA.x < centerB.x && normal.x !== 0) normal.x *= -1;
    if (centerA.y < centerB.y && normal.y !== 0) normal.y *= -1;
    if (centerA.z < centerB.z && normal.z !== 0) normal.z *= -1;

    return { normal, depth: minDepth };
  }

  private resolveCollisions(delta: number): void {
    for (const pair of this.collisionPairs) {
      this.resolveCollision(pair, delta);
    }
  }

  private resolveCollision(pair: CollisionPair, delta: number): void {
    const { bodyA, bodyB, contacts } = pair;

    // Skip if both bodies are kinematic
    if (bodyA.isKinematic && bodyB.isKinematic) return;

    for (const contact of contacts) {
      // Calculate relative velocity
      tempVector1.copy(bodyB.velocity).sub(bodyA.velocity);
      const relativeVelocity = tempVector1;
      const velocityAlongNormal = relativeVelocity.dot(contact.normal);

      // Don't resolve if velocities are separating
      if (velocityAlongNormal > 0) continue;

      // Calculate restitution
      const restitution = Math.min(bodyA.restitution, bodyB.restitution);

      // Calculate impulse scalar
      let impulseScalar = -(1 + restitution) * velocityAlongNormal;
      const totalMass = bodyA.isKinematic ? 0 : (bodyB.isKinematic ? 0 : (1 / bodyA.mass + 1 / bodyB.mass));
      impulseScalar /= totalMass || 1;

      // Apply impulse
      tempVector1.copy(contact.normal).multiplyScalar(impulseScalar);
      contact.impulse.copy(tempVector1);

      if (!bodyA.isKinematic) {
        tempVector2.copy(tempVector1).multiplyScalar(1 / bodyA.mass);
        bodyA.velocity.sub(tempVector2);
      }

      if (!bodyB.isKinematic) {
        tempVector2.copy(tempVector1).multiplyScalar(1 / bodyB.mass);
        bodyB.velocity.add(tempVector2);
      }

      // Position correction (prevent sinking)
      const percent = 0.2; // Usually 20% to 80%
      const slop = 0.01; // Usually 0.01 to 0.1
      const correctionMagnitude = Math.max(contact.penetration - slop, 0) / (totalMass || 1) * percent;
      tempVector1.copy(contact.normal).multiplyScalar(correctionMagnitude);

      if (!bodyA.isKinematic) {
        tempVector2.copy(tempVector1).multiplyScalar(1 / bodyA.mass);
        bodyA.position.sub(tempVector2);
      }

      if (!bodyB.isKinematic) {
        tempVector2.copy(tempVector1).multiplyScalar(1 / bodyB.mass);
        bodyB.position.add(tempVector2);
      }

      // Apply friction
      this.applyFriction(bodyA, bodyB, contact, relativeVelocity, impulseScalar);
    }

    // Emit collision events
    this.emit('collision', {
      bodyA,
      bodyB,
      contacts: contacts.map(c => ({
        position: c.position.clone(),
        normal: c.normal.clone(),
        penetration: c.penetration,
        impulse: c.impulse.clone()
      }))
    });
  }

  private applyFriction(
    bodyA: PhysicsBody,
    bodyB: PhysicsBody,
    contact: ContactPoint,
    relativeVelocity: THREE.Vector3,
    normalImpulse: number
  ): void {
    // Calculate tangent
    tempVector1.copy(relativeVelocity);
    tempVector2.copy(contact.normal).multiplyScalar(relativeVelocity.dot(contact.normal));
    tempVector1.sub(tempVector2); // Tangent velocity

    if (tempVector1.length() < 0.001) return; // No tangential velocity

    tempVector1.normalize();
    const tangent = tempVector1;

    // Calculate friction impulse
    const frictionCoefficient = Math.sqrt(bodyA.friction * bodyB.friction);
    let frictionImpulse = -relativeVelocity.dot(tangent);
    frictionImpulse /= (1 / bodyA.mass + 1 / bodyB.mass);
    frictionImpulse = Math.max(-normalImpulse * frictionCoefficient, Math.min(frictionImpulse, normalImpulse * frictionCoefficient));

    // Apply friction impulse
    tempVector1.copy(tangent).multiplyScalar(frictionImpulse);

    if (!bodyA.isKinematic) {
      tempVector2.copy(tempVector1).multiplyScalar(1 / bodyA.mass);
      bodyA.velocity.sub(tempVector2);
    }

    if (!bodyB.isKinematic) {
      tempVector2.copy(tempVector1).multiplyScalar(1 / bodyB.mass);
      bodyB.velocity.add(tempVector2);
    }
  }

  // Raycasting
  raycast(origin: Vector3, direction: Vector3, maxDistance: number = Infinity, layers?: number[]): RaycastHit | null {
    this.raycastHits = [];

    tempRay.origin.copy(origin);
    tempRay.direction.copy(direction).normalize();

    let closestHit: RaycastHit | null = null;
    let closestDistance = maxDistance;

    for (const body of this.bodies.values()) {
      if (!body.enabled) continue;

      // Check layer filter
      if (layers && !layers.includes(body.layer)) continue;

      const hit = this.raycastBody(body, tempRay, maxDistance);
      if (hit && hit.distance < closestDistance) {
        closestHit = hit;
        closestDistance = hit.distance;
      }
    }

    this.performance.raycastCount++;
    return closestHit;
  }

  raycastAll(origin: Vector3, direction: Vector3, maxDistance: number = Infinity, layers?: number[]): RaycastHit[] {
    this.raycastHits = [];

    tempRay.origin.copy(origin);
    tempRay.direction.copy(direction).normalize();

    for (const body of this.bodies.values()) {
      if (!body.enabled) continue;

      // Check layer filter
      if (layers && !layers.includes(body.layer)) continue;

      const hit = this.raycastBody(body, tempRay, maxDistance);
      if (hit) {
        this.raycastHits.push(hit);
      }
    }

    this.performance.raycastCount++;
    // Sort by distance
    this.raycastHits.sort((a, b) => a.distance - b.distance);
    return this.raycastHits;
  }

  private raycastBody(body: PhysicsBody, ray: THREE.Ray, maxDistance: number): RaycastHit | null {
    // Simple sphere raycast for now
    if (body.shape === 'sphere') {
      return this.raycastSphere(body, ray, maxDistance);
    } else {
      // Default to box raycast
      return this.raycastBox(body, ray, maxDistance);
    }
  }

  private raycastSphere(body: PhysicsBody, ray: THREE.Ray, maxDistance: number): RaycastHit | null {
    const radius = body.size.x / 2;
    tempSphere.center.copy(body.position);
    tempSphere.radius = radius;

    const intersectionPoint = new THREE.Vector3();
    const intersection = ray.intersectSphere(tempSphere, intersectionPoint);

    if (intersection && ray.origin.distanceTo(intersectionPoint) <= maxDistance) {
      const normal = tempVector1.copy(intersectionPoint).sub(body.position).normalize();

      return {
        position: intersectionPoint.clone(),
        normal,
        distance: ray.origin.distanceTo(intersectionPoint),
        entity: body.id,
        point: intersectionPoint.clone()
      };
    }

    return null;
  }

  private raycastBox(body: PhysicsBody, ray: THREE.Ray, maxDistance: number): RaycastHit | null {
    const bounds = this.getBodyBounds(body);

    const intersectionPoint = new THREE.Vector3();
    const intersection = ray.intersectBox(bounds, intersectionPoint);

    if (intersection && ray.origin.distanceTo(intersectionPoint) <= maxDistance) {
      // Calculate normal by checking which face was hit
      const normal = this.calculateBoxNormal(bounds, intersectionPoint);

      return {
        position: intersectionPoint.clone(),
        normal,
        distance: ray.origin.distanceTo(intersectionPoint),
        entity: body.id,
        point: intersectionPoint.clone()
      };
    }

    return null;
  }

  private calculateBoxNormal(bounds: THREE.Box3, point: THREE.Vector3): THREE.Vector3 {
    const center = bounds.getCenter(tempVector1);
    const size = bounds.getSize(tempVector2);
    const toPoint = tempVector3.copy(point).sub(center);

    // Find the closest face
    const absX = Math.abs(toPoint.x);
    const absY = Math.abs(toPoint.y);
    const absZ = Math.abs(toPoint.z);

    if (absX > absY && absX > absZ) {
      return new THREE.Vector3(Math.sign(toPoint.x), 0, 0);
    } else if (absY > absZ) {
      return new THREE.Vector3(0, Math.sign(toPoint.y), 0);
    } else {
      return new THREE.Vector3(0, 0, Math.sign(toPoint.z));
    }
  }

  // Shape casting (sweeping)
  sweepcast(
    shape: 'sphere' | 'box',
    origin: Vector3,
    direction: Vector3,
    radius: number,
    maxDistance: number,
    layers?: number[]
  ): RaycastHit | null {
    this.sweepHits = [];

    tempVector1.copy(direction).normalize();

    for (const body of this.bodies.values()) {
      if (!body.enabled) continue;

      // Check layer filter
      if (layers && !layers.includes(body.layer)) continue;

      const hit = this.sweepcastBody(body, shape, origin, tempVector1, radius, maxDistance);
      if (hit) {
        this.sweepHits.push(hit);
      }
    }

    // Sort by distance and return closest
    this.sweepHits.sort((a, b) => a.distance - b.distance);
    return this.sweepHits.length > 0 ? this.sweepHits[0] : null;
  }

  private sweepcastBody(
    body: PhysicsBody,
    shape: 'sphere' | 'box',
    origin: Vector3,
    direction: Vector3,
    radius: number,
    maxDistance: number
  ): RaycastHit | null {
    // Simple sphere sweep for now
    if (shape === 'sphere') {
      return this.sweepSphere(body, origin, direction, radius, maxDistance);
    } else {
      // Default to box sweep
      return this.sweepBox(body, origin, direction, radius, maxDistance);
    }
  }

  private sweepSphere(
    body: PhysicsBody,
    origin: Vector3,
    direction: Vector3,
    radius: number,
    maxDistance: number
  ): RaycastHit | null {
    if (body.shape !== 'sphere') return null;

    const bodyRadius = body.size.x / 2;
    const combinedRadius = radius + bodyRadius;

    // Raycast from origin to body position
    tempRay.origin.copy(origin);
    tempRay.direction.copy(body.position).sub(origin);

    const distance = tempRay.direction.length();
    if (distance > maxDistance + combinedRadius) return null;

    tempRay.direction.normalize();

    // Check if we intersect the expanded sphere
    tempSphere.center.copy(body.position);
    tempSphere.radius = combinedRadius;

    const intersectionPoint = new THREE.Vector3();
    const intersection = tempRay.intersectSphere(tempSphere, intersectionPoint);

    if (intersection) {
      const distanceToIntersection = origin.distanceTo(intersectionPoint);
      if (distanceToIntersection <= maxDistance) {
        const normal = tempVector1.copy(intersectionPoint).sub(body.position).normalize();

        return {
          position: intersectionPoint.clone(),
          normal,
          distance: distanceToIntersection - radius,
          entity: body.id,
          point: intersectionPoint.clone()
        };
      }
    }

    return null;
  }

  private sweepBox(
    body: PhysicsBody,
    origin: Vector3,
    direction: Vector3,
    radius: number,
    maxDistance: number
  ): RaycastHit | null {
    // Expand the body bounds by the sphere radius
    const bounds = this.getBodyBounds(body);
    const expandedBounds = bounds.clone();
    expandedBounds.min.x -= radius;
    expandedBounds.min.y -= radius;
    expandedBounds.min.z -= radius;
    expandedBounds.max.x += radius;
    expandedBounds.max.y += radius;
    expandedBounds.max.z += radius;

    // Raycast against expanded bounds
    tempRay.origin.copy(origin);
    tempRay.direction.copy(direction);

    const intersectionPoint = new THREE.Vector3();
    const intersection = tempRay.intersectBox(expandedBounds, intersectionPoint);

    if (intersection && origin.distanceTo(intersectionPoint) <= maxDistance) {
      const normal = this.calculateBoxNormal(expandedBounds, intersectionPoint);

      return {
        position: intersectionPoint.clone(),
        normal,
        distance: origin.distanceTo(intersectionPoint) - radius,
        entity: body.id,
        point: intersectionPoint.clone()
      };
    }

    return null;
  }

  // Utility methods
  private getBodyBounds(body: PhysicsBody): THREE.Box3 {
    const bounds = new THREE.Box3();
    bounds.setFromCenterAndSize(body.position, body.size);
    return bounds;
  }

  private getPairKey(idA: string, idB: string): string {
    return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
  }

  private updatePerformance(): void {
    this.performance.bodyCount = this.bodies.size;
  }

  // Public API methods
  setGravity(gravity: Vector3): void {
    this.gravity.copy(gravity);
  }

  setWorldBounds(min: Vector3, max: Vector3): void {
    this.worldBounds.setFromPoints([min, max]);
  }

  getPerformance(): typeof this.performance {
    return { ...this.performance };
  }

  clear(): void {
    this.bodies.clear();
    this.collisionMatrix.clear();
    this.collisionPairs = [];
    this.broadPhasePairs.clear();
    this.raycastHits = [];
    this.sweepHits = [];
    this.updatePerformance();
    this.emit('cleared', {});
  }

  destroy(): void {
    this.clear();
    this.events.clear();
  }
}