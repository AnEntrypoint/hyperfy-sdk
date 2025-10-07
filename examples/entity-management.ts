import { HyperfySDK } from '../src';
import { createVector3, distanceBetween } from '../src/utils/helpers';

async function entityManagementExample() {
  console.log('🎯 Starting Entity Management Example');

  const sdk = new HyperfySDK({
    logLevel: 'debug',
  });

  try {
    const entityManager = sdk.getEntityManager();

    // Set up entity event listeners
    entityManager.on('entityAdded', (entity) => {
      console.log(`➕ Added: ${entity.type} at (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
    });

    entityManager.on('entityUpdated', (entity, previousState) => {
      console.log(`🔄 Updated: ${entity.id} - Position changed from (${previousState.position.x}, ${previousState.position.y}, ${previousState.position.z}) to (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
    });

    entityManager.on('entityRemoved', (entity) => {
      console.log(`➖ Removed: ${entity.id} (${entity.type})`);
    });

    // Create a scene with multiple entities
    console.log('🏗️ Creating scene...');

    // Ground plane
    const groundId = entityManager.addEntity({
      type: 'plane',
      position: createVector3(0, 0, 0),
      rotation: createVector3(0, 0, 0),
      scale: createVector3(20, 1, 20),
      properties: {
        color: '#90EE90',
        material: 'basic',
      },
    });

    // Create buildings
    const buildingIds: string[] = [];
    const buildingPositions = [
      { x: -5, z: -5 },
      { x: 5, z: -5 },
      { x: -5, z: 5 },
      { x: 5, z: 5 },
      { x: 0, z: 0 },
    ];

    for (let i = 0; i < buildingPositions.length; i++) {
      const pos = buildingPositions[i];
      const height = 3 + Math.random() * 5;

      const buildingId = entityManager.addEntity({
        type: 'box',
        position: createVector3(pos.x, height / 2, pos.z),
        rotation: createVector3(0, 0, 0),
        scale: createVector3(2, height, 2),
        properties: {
          color: '#8B4513',
          material: 'standard',
        },
      });

      buildingIds.push(buildingId);

      // Add a roof to each building
      const roofId = entityManager.addEntity({
        type: 'pyramid',
        position: createVector3(pos.x, height + 0.5, pos.z),
        rotation: createVector3(0, 0, 0),
        scale: createVector3(2.5, 1, 2.5),
        properties: {
          color: '#DC143C',
          material: 'standard',
        },
        parent: buildingId,
      });
    }

    // Add some trees
    const treePositions = [
      { x: -8, z: -8 },
      { x: 8, z: -8 },
      { x: -8, z: 8 },
      { x: 8, z: 8 },
      { x: -3, z: -3 },
      { x: 3, z: -3 },
      { x: -3, z: 3 },
      { x: 3, z: 3 },
    ];

    const treeIds: string[] = [];

    for (const pos of treePositions) {
      // Tree trunk
      const trunkId = entityManager.addEntity({
        type: 'cylinder',
        position: createVector3(pos.x, 1, pos.z),
        rotation: createVector3(0, 0, 0),
        scale: createVector3(0.3, 2, 0.3),
        properties: {
          color: '#8B4513',
          material: 'standard',
        },
      });

      // Tree leaves
      const leavesId = entityManager.addEntity({
        type: 'sphere',
        position: createVector3(pos.x, 2.5, pos.z),
        rotation: createVector3(0, 0, 0),
        scale: createVector3(1.2, 1.2, 1.2),
        properties: {
          color: '#228B22',
          material: 'standard',
        },
        parent: trunkId,
      });

      treeIds.push(trunkId);
    }

    // Add some decorative elements
    const decorativeIds: string[] = [];

    // Add floating orbs
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const radius = 7;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 3 + Math.sin(i) * 2;

      const orbId = entityManager.addEntity({
        type: 'sphere',
        position: createVector3(x, y, z),
        rotation: createVector3(0, 0, 0),
        scale: createVector3(0.5, 0.5, 0.5),
        properties: {
          color: `hsl(${i * 72}, 70%, 50%)`,
          material: 'emissive',
          emissiveIntensity: 0.5,
        },
      });

      decorativeIds.push(orbId);
    }

    console.log(`✅ Scene created with ${entityManager.getEntityCount()} entities`);

    // Demonstrate entity queries
    console.log('🔍 Querying entities...');

    // Get all entities by type
    const boxes = entityManager.getEntitiesByType('box');
    console.log(`📦 Found ${boxes.length} boxes`);

    const spheres = entityManager.getEntitiesByType('sphere');
    console.log(`🔵 Found ${spheres.length} spheres`);

    // Find entities near a position
    const centerPosition = createVector3(0, 0, 0);
    const nearbyEntities = entityManager.findEntitiesInRadius(centerPosition, 5);
    console.log(`🎯 Found ${nearbyEntities.length} entities within 5 units of center`);

    // Demonstrate entity operations
    console.log('🔄 Performing entity operations...');

    // Move an entity
    if (decorativeIds.length > 0) {
      const orbId = decorativeIds[0];
      const newPosition = createVector3(10, 5, 10);

      console.log(`Moving orb ${orbId} to new position...`);
      entityManager.moveEntity(orbId, newPosition);

      // Rotate the same entity
      setTimeout(() => {
        const newRotation = createVector3(0, Math.PI / 4, 0);
        console.log(`Rotating orb ${orbId}...`);
        entityManager.rotateEntity(orbId, newRotation);
      }, 1000);

      // Scale the same entity
      setTimeout(() => {
        const newScale = createVector3(1, 1, 1);
        console.log(`Scaling orb ${orbId}...`);
        entityManager.scaleEntity(orbId, newScale);
      }, 2000);
    }

    // Update entity properties
    if (treeIds.length > 0) {
      const firstTreeId = treeIds[0];
      setTimeout(() => {
        console.log(`Updating properties for tree ${firstTreeId}...`);
        entityManager.updateEntity(firstTreeId, {
          properties: {
            color: '#FF6347', // Change to tomato color
            material: 'phong',
          },
        });
      }, 3000);
    }

    // Demonstrate parent-child relationships
    console.log('👨‍👩‍👧‍👦 Exploring parent-child relationships...');

    for (const buildingId of buildingIds) {
      const children = entityManager.getChildren(buildingId);
      if (children.length > 0) {
        console.log(`Building ${buildingId} has ${children.length} children`);
        const parent = entityManager.getParent(children[0].id);
        if (parent) {
          console.log(`  Child ${children[0].id} belongs to parent ${parent.id} (${parent.type})`);
        }
      }
    }

    // Get entity statistics
    console.log('📊 Entity Statistics:');
    const entityStats = entityManager.getEntityCountByType();
    for (const [type, count] of Object.entries(entityStats)) {
      console.log(`  ${type}: ${count}`);
    }

    // Validate all entities
    setTimeout(() => {
      console.log('✅ Validating all entities...');
      const validation = entityManager.validateAllEntities();
      console.log(`  Valid entities: ${validation.valid.length}`);
      console.log(`  Invalid entities: ${validation.invalid.length}`);

      if (validation.invalid.length > 0) {
        console.log('❌ Invalid entities found:');
        for (const { entity, errors } of validation.invalid) {
          console.log(`  ${entity.id}: ${errors.join(', ')}`);
        }
      }
    }, 5000);

    // Get entity history
    setTimeout(() => {
      console.log('📜 Entity History:');
      const history = entityManager.getHistory();
      console.log(`  Total actions: ${history.length}`);

      // Show last 5 actions
      const recentHistory = history.slice(-5);
      for (const entry of recentHistory) {
        console.log(`  ${entry.timestamp.toISOString()}: ${entry.action} - ${entry.entityId}`);
      }
    }, 6000);

    // Clean up demonstration
    setTimeout(() => {
      console.log('🧹 Cleaning up scene...');

      // Remove decorative elements first
      for (const id of decorativeIds) {
        entityManager.removeEntity(id);
      }

      // Remove trees
      for (const id of treeIds) {
        entityManager.removeEntity(id);
      }

      // Remove buildings
      for (const id of buildingIds) {
        entityManager.removeEntity(id);
      }

      // Remove ground
      entityManager.removeEntity(groundId);

      console.log(`✅ Scene cleaned up. ${entityManager.getEntityCount()} entities remaining`);
    }, 8000);

  } catch (error) {
    console.error('❌ Error in entity management example:', error);
  }
}

// Run the example
if (require.main === module) {
  entityManagementExample().catch(console.error);
}

export { entityManagementExample };