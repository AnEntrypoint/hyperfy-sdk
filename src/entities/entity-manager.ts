import { EventEmitter } from 'eventemitter3';
import { NodeLogger } from '../utils/logger';
import { EntityError, ValidationError } from '../utils/errors';
import { Entity, Vector3 } from '../types';
import { generateId, validateEntity, deepClone } from '../utils/helpers';

export interface EntityManagerConfig {
  maxEntities?: number;
  validateOnAdd?: boolean;
  trackHistory?: boolean;
  historySize?: number;
}

export interface EntityHistory {
  action: 'create' | 'update' | 'delete' | 'move' | 'rotate' | 'scale';
  entityId: string;
  previousState?: Entity;
  newState?: Entity;
  timestamp: Date;
  userId?: string;
}

export class EntityManager extends EventEmitter {
  private entities: Map<string, Entity> = new Map();
  private childrenMap: Map<string, string[]> = new Map();
  private config: Required<EntityManagerConfig>;
  private logger: NodeLogger;
  private history: EntityHistory[] = [];

  constructor(config: EntityManagerConfig = {}) {
    super();
    this.config = {
      maxEntities: 10000,
      validateOnAdd: true,
      trackHistory: true,
      historySize: 1000,
      ...config,
    };
    this.logger = new NodeLogger('EntityManager');
  }

  addEntity(entity: Omit<Entity, 'id'>, id?: string, userId?: string): string {
    const entityId = id || generateId();

    const newEntity: Entity = {
      id: entityId,
      ...entity,
      children: [],
    };

    if (this.config.validateOnAdd && !validateEntity(newEntity)) {
      throw new ValidationError('Invalid entity data', newEntity);
    }

    if (this.entities.has(entityId)) {
      throw new EntityError(`Entity with id '${entityId}' already exists`);
    }

    if (this.entities.size >= this.config.maxEntities) {
      throw new EntityError('Maximum entity limit reached');
    }

    this.addToHistory({
      action: 'create',
      entityId,
      newState: deepClone(newEntity),
      timestamp: new Date(),
      userId,
    });

    this.entities.set(entityId, newEntity);

    if (newEntity.parent) {
      this.addChildToParent(newEntity.parent, entityId);
    }

    this.childrenMap.set(entityId, []);

    this.logger.debug(`Entity added: ${entityId}`);
    this.emit('entityAdded', newEntity);
    this.emit('entityChanged', { type: 'add', entity: newEntity });

    return entityId;
  }

  removeEntity(entityId: string, userId?: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return false;
    }

    const children = [...this.childrenMap.get(entityId) || []];
    for (const childId of children) {
      this.removeEntity(childId, userId);
    }

    if (entity.parent) {
      this.removeChildFromParent(entity.parent, entityId);
    }

    this.addToHistory({
      action: 'delete',
      entityId,
      previousState: deepClone(entity),
      timestamp: new Date(),
      userId,
    });

    this.entities.delete(entityId);
    this.childrenMap.delete(entityId);

    this.logger.debug(`Entity removed: ${entityId}`);
    this.emit('entityRemoved', entity);
    this.emit('entityChanged', { type: 'remove', entityId, entity });

    return true;
  }

  updateEntity(entityId: string, updates: Partial<Entity>, userId?: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return false;
    }

    const previousState = deepClone(entity);
    const updatedEntity = { ...entity, ...updates };

    if (this.config.validateOnAdd && !validateEntity(updatedEntity)) {
      throw new ValidationError('Invalid entity update data', updates);
    }

    if (updates.parent !== undefined && updates.parent !== entity.parent) {
      if (entity.parent) {
        this.removeChildFromParent(entity.parent, entityId);
      }
      if (updates.parent) {
        this.addChildToParent(updates.parent, entityId);
      }
    }

    this.entities.set(entityId, updatedEntity);

    this.addToHistory({
      action: 'update',
      entityId,
      previousState,
      newState: deepClone(updatedEntity),
      timestamp: new Date(),
      userId,
    });

    this.logger.debug(`Entity updated: ${entityId}`);
    this.emit('entityUpdated', updatedEntity, previousState);
    this.emit('entityChanged', { type: 'update', entity: updatedEntity, previousState });

    return true;
  }

  moveEntity(entityId: string, position: Vector3, userId?: string): boolean {
    return this.updateEntity(entityId, { position }, userId);
  }

  rotateEntity(entityId: string, rotation: Vector3, userId?: string): boolean {
    return this.updateEntity(entityId, { rotation }, userId);
  }

  scaleEntity(entityId: string, scale: Vector3, userId?: string): boolean {
    return this.updateEntity(entityId, { scale }, userId);
  }

  getEntity(entityId: string): Entity | undefined {
    return this.entities.get(entityId);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  getEntitiesByType(type: string): Entity[] {
    return this.getAllEntities().filter(entity => entity.type === type);
  }

  getChildren(entityId: string): Entity[] {
    const childIds = this.childrenMap.get(entityId) || [];
    return childIds.map(id => this.entities.get(id)).filter(Boolean) as Entity[];
  }

  getParent(entityId: string): Entity | undefined {
    const entity = this.entities.get(entityId);
    return entity?.parent ? this.entities.get(entity.parent) : undefined;
  }

  findEntitiesInRadius(position: Vector3, radius: number): Entity[] {
    return this.getAllEntities().filter(entity => {
      const distance = Math.sqrt(
        Math.pow(entity.position.x - position.x, 2) +
        Math.pow(entity.position.y - position.y, 2) +
        Math.pow(entity.position.z - position.z, 2)
      );
      return distance <= radius;
    });
  }

  entityExists(entityId: string): boolean {
    return this.entities.has(entityId);
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  getEntityCountByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entity of this.entities.values()) {
      counts[entity.type] = (counts[entity.type] || 0) + 1;
    }
    return counts;
  }

  getHistory(): EntityHistory[] {
    return [...this.history];
  }

  getEntityHistory(entityId: string): EntityHistory[] {
    return this.history.filter(entry => entry.entityId === entityId);
  }

  clearHistory(): void {
    this.history = [];
    this.logger.debug('Entity history cleared');
  }

  private addToHistory(entry: EntityHistory): void {
    if (!this.config.trackHistory) {
      return;
    }

    this.history.push(entry);

    if (this.history.length > this.config.historySize) {
      this.history = this.history.slice(-this.config.historySize);
    }
  }

  private addChildToParent(parentId: string, childId: string): void {
    const children = this.childrenMap.get(parentId) || [];
    if (!children.includes(childId)) {
      children.push(childId);
      this.childrenMap.set(parentId, children);
    }
  }

  private removeChildFromParent(parentId: string, childId: string): void {
    const children = this.childrenMap.get(parentId) || [];
    const index = children.indexOf(childId);
    if (index > -1) {
      children.splice(index, 1);
      this.childrenMap.set(parentId, children);
    }
  }

  clear(): void {
    const entities = this.getAllEntities();
    for (const entity of entities) {
      this.removeEntity(entity.id);
    }
    this.logger.debug('All entities cleared');
  }

  validateAllEntities(): { valid: Entity[], invalid: { entity: Entity, errors: string[] }[] } {
    const valid: Entity[] = [];
    const invalid: { entity: Entity, errors: string[] }[] = [];

    for (const entity of this.entities.values()) {
      if (validateEntity(entity)) {
        valid.push(entity);
      } else {
        const errors: string[] = [];
        if (!entity.id || typeof entity.id !== 'string') errors.push('Invalid id');
        if (!entity.type || typeof entity.type !== 'string') errors.push('Invalid type');
        if (!entity.position || typeof entity.position.x !== 'number') errors.push('Invalid position');
        if (!entity.rotation || typeof entity.rotation.x !== 'number') errors.push('Invalid rotation');
        if (!entity.scale || typeof entity.scale.x !== 'number') errors.push('Invalid scale');
        invalid.push({ entity, errors });
      }
    }

    return { valid, invalid };
  }
}