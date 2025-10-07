import { AppEntity } from '../src/entities/app.js'
import { BuilderManager } from '../src/managers/builder-manager.js'
import { BlueprintManager } from '../src/managers/blueprint-manager.js'
import { AppDevelopmentManager } from '../src/managers/app-development-manager.js'
import { AssetManager } from '../src/managers/asset-manager.js'
import {
  AppEntityType,
  BuildTool,
  BuildMode,
  AssetType,
  Vector3,
  Quaternion
} from '../src/types/index.js'

/**
 * Comprehensive example demonstrating the complete Hyperfy app development workflow
 *
 * This example shows:
 * 1. Asset management and optimization
 * 2. Blueprint creation and versioning
 * 3. App entity creation and lifecycle management
 * 4. Builder system with programmatic entity manipulation
 * 5. Real-time collaborative development
 * 6. Script editing and hot reloading
 * 7. Performance monitoring and debugging
 */

async function main() {
  console.log('=€ Starting Hyperfy App Development Workflow Example\n')

  // Initialize managers
  const assetManager = new AssetManager({
    storagePath: './assets',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedFormats: ['gltf', 'glb', 'jpg', 'png', 'mp3', 'wav', 'js', 'json'],
    optimizationSettings: {
      images: { enabled: true, quality: 80, format: 'webp' },
      models: { enabled: true, compression: 'draco', generateLODs: true },
      audio: { enabled: true, bitrate: 128, format: 'mp3' },
      video: { enabled: true, resolution: '1080p', codec: 'h264' }
    },
    securitySettings: {
      enableVirusScan: true,
      enableContentValidation: true,
      allowedDomains: [],
      blockedDomains: []
    },
    cacheSettings: {
      enabled: true,
      maxSize: 1000 * 1024 * 1024, // 1GB
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      storagePath: './cache'
    },
    cdnSettings: {
      enabled: false,
      baseUrl: 'https://cdn.hyperfy.io'
    },
    analyticsSettings: {
      enabled: true,
      trackDownloads: true,
      trackUsage: true,
      trackPerformance: true
    }
  })

  const blueprintManager = new BlueprintManager({
    storagePath: './blueprints',
    maxVersions: 50,
    collaborationSettings: {
      enabled: true,
      maxCollaborators: 10,
      realTimeSync: true
    },
    validationSettings: {
      strict: true,
      validateModels: true,
      validateScripts: true,
      performanceThreshold: 60 // FPS
    },
    marketplaceSettings: {
      enabled: true,
      autoPublish: false,
      revenueShare: 0.3
    }
  })

  const appDevelopmentManager = new AppDevelopmentManager({
    workspacePath: './workspace',
    templatePath: './templates',
    collaborationSettings: {
      enabled: true,
      maxParticipants: 5,
      syncInterval: 1000
    },
    debuggingSettings: {
      enabled: true,
      logLevel: 'debug',
      performanceMonitoring: true,
      errorTracking: true
    },
    testingSettings: {
      enabled: true,
      testFramework: 'jest',
      coverageThreshold: 80,
      autoRun: true
    },
    deploymentSettings: {
      enabled: true,
      environments: ['development', 'staging', 'production'],
      autoDeploy: false,
      rolloutStrategy: 'canary'
    }
  })

  const builderManager = new BuilderManager({
    enabled: true,
    permissions: {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canPublish: true,
      canManageCollaborators: true
    },
    snapSettings: {
      enabled: true,
      distance: 0.5,
      angle: 15,
      scale: 0.1
    },
    gridSettings: {
      visible: true,
      size: 20,
      divisions: 20,
      color: [0.3, 0.3, 0.3, 0.3],
      orientation: 'y'
    },
    hotkeys: [],
    materialPresets: [],
    maxHistorySize: 100,
    autoSave: true,
    autoSaveInterval: 30000,
    collaboration: true
  })

  console.log(' Managers initialized successfully\n')

  // Step 1: Upload and manage assets
  console.log('=Á Step 1: Asset Management')
  console.log('-'.repeat(50))

  // Upload a 3D model asset
  const modelBuffer = Buffer.from('{"gltf": "model data"}') // Simplified
  const modelAsset = await assetManager.uploadAsset(modelBuffer, 'house.gltf', {
    optimize: true,
    validate: true,
    scanForSecurity: true,
    generateThumbnails: true,
    tags: ['architecture', 'building', 'residential'],
    metadata: {
      description: 'Residential house model',
      version: '1.0.0',
      uploadedBy: 'developer@example.com'
    }
  })
  console.log(`<à Uploaded model asset: ${modelAsset.name} (${modelAsset.id})`)

  // Upload texture assets
  const textureBuffer = Buffer.from('{"image": "texture data"}')
  const textureAsset = await assetManager.uploadAsset(textureBuffer, 'wall_texture.jpg', {
    optimize: true,
    tags: ['texture', 'material', 'wall'],
    collection: 'house_materials'
  })
  console.log(`=¼ Uploaded texture asset: ${textureAsset.name} (${textureAsset.id})`)

  // Upload audio asset
  const audioBuffer = Buffer.from('{"audio": "sound data"}')
  const audioAsset = await assetManager.uploadAsset(audioBuffer, 'ambient_sound.mp3', {
    optimize: true,
    tags: ['audio', 'ambient', 'environment'],
    collection: 'house_sounds'
  })
  console.log(`=
 Uploaded audio asset: ${audioAsset.name} (${audioAsset.id})`)

  // Search assets
  const buildingAssets = await assetManager.searchAssets({
    tags: ['building'],
    sortBy: 'date',
    sortOrder: 'desc'
  })
  console.log(`= Found ${buildingAssets.length} building assets`)

  console.log('\n')

  // Step 2: Create and version blueprint
  console.log('=Ð Step 2: Blueprint Creation & Versioning')
  console.log('-'.repeat(50))

  const blueprint = await blueprintManager.createBlueprint('Interactive House', {
    description: 'A fully interactive residential house with animated doors and ambient sound',
    category: 'architecture',
    tags: ['house', 'interactive', 'residential', 'furnished'],
    author: 'developer@example.com',
    license: 'MIT',
    thumbnail: modelAsset.url,
    assets: [modelAsset.id, textureAsset.id, audioAsset.id],
    metadata: {
      complexity: 'intermediate',
      estimatedBuildTime: '2 hours',
      polyCount: '5000',
      textureMemory: '50MB'
    }
  })

  console.log(`=Ë Created blueprint: ${blueprint.name} (${blueprint.id})`)

  // Add blueprint data
  const blueprintData = {
    entities: [
      {
        type: 'prim',
        prim: 'box',
        size: [10, 5, 8],
        position: [0, 2.5, 0],
        material: {
          texture: textureAsset.id,
          repeat: [4, 4]
        },
        physics: 'static'
      },
      {
        type: 'prim',
        prim: 'box',
        size: [2, 4, 0.2],
        position: [3, 2, 4],
        rotation: [0, 1, 0, 0],
        material: {
          color: '#8B4513'
        },
        physics: 'kinematic',
        tags: ['door']
      }
    ],
    scripts: [
      {
        id: 'door_controller',
        content: `
app.on('interact', e => {
  if (e.entity.tags.includes('door')) {
    e.entity.rotation.y = e.entity.rotation.y === 0 ? Math.PI/2 : 0
  }
})
        `,
        type: 'javascript',
        autorun: true
      }
    ],
    audio: [
      {
        id: 'ambient_audio',
        asset: audioAsset.id,
        loop: true,
        volume: 0.3,
        spatial: true,
        position: [0, 3, 0]
      }
    ]
  }

  await blueprintManager.updateBlueprintData(blueprint.id, blueprintData)

  // Create first version
  const version1 = await blueprintManager.createVersion(blueprint, 'Initial house structure with basic interaction')
  console.log(`=æ Created version ${version1.version}: ${version1.description}`)

  // Add collaborators
  const collaborator1 = await blueprintManager.addCollaborator(blueprint.id, 'designer@example.com', 'editor')
  const collaborator2 = await blueprintManager.addCollaborator(blueprint.id, 'artist@example.com', 'viewer')
  console.log(`=e Added collaborators: ${collaborator1.userId} (${collaborator1.role}), ${collaborator2.userId} (${collaborator2.role})`)

  console.log('\n')

  // Step 3: Create and configure app entity
  console.log('™ Step 3: App Entity Creation & Configuration')
  console.log('-'.repeat(50))

  const appEntity = new AppEntity({
    id: 'demo-house-app',
    name: 'Interactive House Demo',
    description: 'Demo app showcasing interactive house with physics and audio',
    url: blueprint.url,
    blueprintId: blueprint.id,
    position: [0, 0, 0] as Vector3,
    quaternion: [0, 0, 0, 1] as Quaternion,
    scale: [1, 1, 1] as Vector3,
    type: AppEntityType.WORLD,
    config: {
      physics: {
        enabled: true,
        gravity: -9.81,
        maxVelocity: 50
      },
      network: {
        enabled: true,
        syncInterval: 1000,
        maxPlayers: 20
      },
      performance: {
        lodEnabled: true,
        maxDrawDistance: 100,
        cullingEnabled: true
      },
      audio: {
        spatialAudio: true,
        maxDistance: 50,
        rollOff: 'logarithmic'
      }
    },
    metadata: {
      version: '1.0.0',
      author: 'developer@example.com',
      createdAt: new Date(),
      lastModified: new Date()
    }
  })

  // Set up callbacks for builder integration
  appEntity.setCallbacks({
    entityCreate: async (data) => {
      console.log(`<× Creating entity: ${data.type}`)
      return { id: 'entity_' + Math.random().toString(36).substr(2, 9) }
    },
    entityUpdate: async (id, data) => {
      console.log(`=Ý Updating entity: ${id}`)
    },
    entityDelete: async (id) => {
      console.log(`=Ñ Deleting entity: ${id}`)
    },
    scriptExecute: async (scriptId, script) => {
      console.log(`=Ü Executing script: ${scriptId}`)
      return { success: true, result: 'Script executed successfully' }
    },
    assetLoad: async (assetId) => {
      console.log(`=æ Loading asset: ${assetId}`)
      const asset = await assetManager.getAsset(assetId)
      return asset || null
    }
  })

  // Initialize app
  await appEntity.initialize()
  console.log(`<¯ Initialized app entity: ${appEntity.name}`)

  // Build app
  await appEntity.build()
  console.log(`<× Built app entity with ${appEntity.entities.length} entities`)

  console.log('\n')

  // Step 4: Builder system demonstration
  console.log('=à Step 4: Builder System Operations')
  console.log('-'.repeat(50))

  // Enable builder mode
  builderManager.enable()
  console.log(' Builder mode enabled')

  // Set up builder callbacks
  builderManager.setCallbacks({
    raycast: (origin, direction) => [
      {
        entityId: 'entity_demo',
        distance: 10,
        point: [5, 1, 5],
        normal: [0, 1, 0]
      }
    ],
    entityCreate: async (data) => {
      console.log(`<× Builder creating entity: ${data.type}`)
      return { id: 'entity_' + Math.random().toString(36).substr(2, 9) }
    },
    entityModify: async (id, data) => {
      console.log(`=' Builder modifying entity: ${id}`)
    },
    entityDelete: async (id) => {
      console.log(`=¥ Builder deleting entity: ${id}`)
    },
    assetUpload: async (file, type) => {
      const filename = `uploaded_${Date.now()}.${type === 'model' ? 'gltf' : 'jpg'}`
      return await assetManager.uploadAsset(Buffer.from(file), filename)
    }
  })

  // Switch to move tool
  builderManager.setTool(BuildTool.MOVE, BuildMode.SELECT)
  console.log(`=' Active tool: ${builderManager.getTool()} in ${builderManager.getMode()} mode`)

  // Create some entities programmatically (equivalent to drag-and-drop)
  const boxEntity = await builderManager.createEntity('prim', {
    type: 'box',
    size: [2, 2, 2],
    color: '#ff6b6b',
    physics: 'static'
  }, [5, 1, 5] as Vector3)

  console.log(`=æ Created box entity: ${boxEntity.id}`)

  const sphereEntity = await builderManager.createEntity('prim', {
    type: 'sphere',
    size: [1],
    color: '#4ecdc4',
    physics: 'kinematic'
  }, [-3, 1, 2] as Vector3)

  console.log(`=5 Created sphere entity: ${sphereEntity.id}`)

  // Select entities
  builderManager.selectEntities([boxEntity.id, sphereEntity.id], 'replace')
  console.log(`<¯ Selected ${builderManager.getSelectedEntities().length} entities`)

  // Transform selected entities
  await builderManager.transformEntities([boxEntity.id], {
    position: [6, 2, 5] as Vector3,
    rotation: [0, 0.707, 0, 0.707] as Quaternion
  })

  console.log('= Transformed selected entities')

  // Duplicate entities
  const duplicatedEntities = await builderManager.duplicateEntities([sphereEntity.id], [0, 0, 3] as Vector3)
  console.log(`=Ë Duplicated ${duplicatedEntities.length} entities`)

  // Create selection group
  const selectionGroup = builderManager.createSelectionGroup('Furniture', [boxEntity.id, ...duplicatedEntities.map(e => e.id)])
  console.log(`=æ Created selection group: ${selectionGroup.name} with ${selectionGroup.entities.length} entities`)

  // Perform custom action
  await builderManager.performAction({
    type: 'create',
    entityId: 'custom_light',
    data: {
      type: 'light',
      lightType: 'point',
      color: '#ffeb3b',
      intensity: 2,
      position: [0, 5, 0]
    },
    userId: 'developer'
  })

  console.log('=¡ Created custom point light')

  // Undo last action
  const undoSuccess = await builderManager.undo()
  console.log(`© Undo successful: ${undoSuccess}`)

  // Redo action
  const redoSuccess = await builderManager.redo()
  console.log(`ª Redo successful: ${redoSuccess}`)

  console.log('\n')

  // Step 5: Real-time collaborative development
  console.log('=e Step 5: Collaborative Development Session')
  console.log('-'.repeat(50))

  // Start development session
  const developmentSession = await appDevelopmentManager.startDevelopmentSession(
    appEntity.id,
    'developer@example.com'
  )

  console.log(`=€ Started development session: ${developmentSession.id}`)

  // Create script editor
  const scriptEditor = await appDevelopmentManager.createScriptEditor(
    developmentSession.id,
    'interaction_controller'
  )

  console.log(`=Ý Created script editor: ${scriptEditor.id}`)

  // Add initial script content
  await appDevelopmentManager.updateScript(scriptEditor.id, `
// Interactive House Controller
class HouseController {
  constructor() {
    this.doors = []
    this.lights = []
    this.sounds = []
    this.initialize()
  }

  initialize() {
    // Find all doors
    app.filter(e => e.tags.includes('door')).forEach(door => {
      this.doors.push(door)
      this.setupDoorInteraction(door)
    })

    // Find all lights
    app.filter(e => e.type === 'light').forEach(light => {
      this.lights.push(light)
    })

    // Setup ambient audio
    this.setupAmbientAudio()

    console.log('House controller initialized with',
      this.doors.length, 'doors and',
      this.lights.length, 'lights')
  }

  setupDoorInteraction(door) {
    app.on('interact', e => {
      if (e.entity === door) {
        this.toggleDoor(door)
      }
    })
  }

  toggleDoor(door) {
    const isOpen = door.rotation.y > 0.1
    const targetRotation = isOpen ? 0 : Math.PI / 2

    // Animate door
    app.animate((delta) => {
      door.rotation.y += (targetRotation - door.rotation.y) * delta * 3
      return Math.abs(door.rotation.y - targetRotation) < 0.01
    })

    // Play door sound
    this.playSound('door_open', door.position)
  }

  setupAmbientAudio() {
    const ambientSound = app.create('sound', {
      asset: '${audioAsset.id}',
      loop: true,
      volume: 0.3,
      spatial: true,
      position: [0, 3, 0]
    })

    this.sounds.push(ambientSound)
  }

  playSound(soundName, position) {
    // Sound playing implementation
    console.log('Playing sound:', soundName, 'at position:', position)
  }

  // Performance monitoring
  updatePerformance() {
    const fps = app.getFPS()
    const entityCount = app.getAllEntities().length

    if (fps < 30) {
      console.warn('Low FPS detected:', fps, 'with', entityCount, 'entities')
      this.optimizePerformance()
    }
  }

  optimizePerformance() {
    // Disable some effects or reduce detail level
    console.log('Optimizing performance...')
  }
}

// Initialize controller
const houseController = new HouseController()

// Update loop
app.on('animate', delta => {
  houseController.updatePerformance()
})

// Cleanup on unload
app.on('unload', () => {
  console.log('House controller cleanup complete')
})
  `, { line: 1, column: 1 })

  console.log('=Ü Added interactive house controller script')

  // Validate script
  const validationResult = await appDevelopmentManager.validateScript(scriptEditor.id)
  console.log(` Script validation: ${validationResult.valid ? 'PASSED' : 'FAILED'}`)
  if (!validationResult.valid) {
    console.log('Errors:', validationResult.errors)
  }

  // Add collaborator to session
  const collaboratorSession = await appDevelopmentManager.addCollaborator(
    developmentSession.id,
    'designer@example.com',
    'editor'
  )

  console.log(`=d Added collaborator: ${collaboratorSession.userId}`)

  // Start real-time collaboration
  appDevelopmentManager.startCollaboration(developmentSession.id, {
    enabled: true,
    features: ['script-editing', 'entity-manipulation', 'chat'],
    syncInterval: 500
  })

  console.log('= Started real-time collaboration')

  // Enable hot reloading
  appDevelopmentManager.enableHotReload(developmentSession.id, {
    enabled: true,
    debounceTime: 1000,
    autoSave: true,
    onReload: (changes) => {
      console.log('=% Hot reloading changes:', changes.length, 'files')
    }
  })

  console.log('=% Enabled hot reloading')

  console.log('\n')

  // Step 6: Performance monitoring and debugging
  console.log('=Ê Step 6: Performance Monitoring & Debugging')
  console.log('-'.repeat(50))

  // Get performance metrics
  const performanceMetrics = appDevelopmentManager.getPerformanceMetrics(developmentSession.id)
  console.log('=È Performance Metrics:')
  console.log(`   FPS: ${performanceMetrics.fps}`)
  console.log(`   Memory: ${performanceMetrics.memory.used}MB / ${performanceMetrics.memory.total}MB`)
  console.log(`   Entities: ${performanceMetrics.entities.count}`)
  console.log(`   Draw calls: ${performanceMetrics.rendering.drawCalls}`)
  console.log(`   Network latency: ${performanceMetrics.network.latency}ms`)

  // Get development errors
  const errors = appDevelopmentManager.getDevelopmentErrors(developmentSession.id)
  if (errors.length > 0) {
    console.log('  Development Errors:')
    errors.forEach(error => {
      console.log(`   [${error.severity}] ${error.message} (${error.file}:${error.line})`)
    })
  } else {
    console.log(' No development errors detected')
  }

  // Run tests
  const testResults = await appDevelopmentManager.runTests(developmentSession.id)
  console.log('>ê Test Results:')
  console.log(`   Total: ${testResults.total}`)
  console.log(`   Passed: ${testResults.passed}`)
  console.log(`   Failed: ${testResults.failed}`)
  console.log(`   Coverage: ${testResults.coverage}%`)

  // Generate development report
  const report = await appDevelopmentManager.generateDevelopmentReport(developmentSession.id)
  console.log('=Ë Development Report Generated:')
  console.log(`   Session Duration: ${report.duration}ms`)
  console.log(`   Scripts Edited: ${report.scriptsEdited}`)
  console.log(`   Entities Modified: ${report.entitiesModified}`)
  console.log(`   Collaborators: ${report.collaborators}`)
  console.log(`   Performance Score: ${report.performanceScore}`)

  console.log('\n')

  // Step 7: Asset analytics and optimization
  console.log('=È Step 7: Asset Analytics & Optimization')
  console.log('-'.repeat(50))

  // Get asset analytics
  const modelAnalytics = await assetManager.getAssetAnalytics(modelAsset.id)
  if (modelAnalytics) {
    console.log('<à Model Asset Analytics:')
    console.log(`   Downloads: ${modelAnalytics.downloads}`)
    console.log(`   Views: ${modelAnalytics.views}`)
    console.log(`   Last Accessed: ${modelAnalytics.lastAccessed}`)
    console.log(`   Load Time: ${modelAnalytics.performance.loadTime}ms`)
  }

  // Optimize assets
  await assetManager.optimizeAsset(modelAsset, {
    format: 'glb',
    quality: 90,
    compression: 'high',
    generateLODs: true,
    optimizeForWeb: true
  })

  console.log('=' Optimized model asset for web delivery')

  // Regenerate thumbnails
  await assetManager.regenerateThumbnails(modelAsset.id)
  console.log('=¼ Regenerated model thumbnails')

  // Export blueprint
  const blueprintExport = await blueprintManager.exportBlueprint(blueprint.id, 'json')
  console.log(`=ä Exported blueprint: ${blueprintExport.name} (${blueprintExport.size} bytes)`)

  console.log('\n')

  // Step 8: Cleanup
  console.log('>ù Step 8: Cleanup & Finalization')
  console.log('-'.repeat(50))

  // Stop development session
  await appDevelopmentManager.stopDevelopmentSession(developmentSession.id)
  console.log('ù Stopped development session')

  // Unbuild app entity
  await appEntity.unbuild()
  console.log('<× Unbuilt app entity')

  // Disable builder
  builderManager.disable()
  console.log('L Disabled builder mode')

  // Generate final report
  console.log('\n=Ë FINAL REPORT')
  console.log('='.repeat(50))
  console.log(` Assets Managed: ${buildingAssets.length}`)
  console.log(` Blueprint Created: ${blueprint.name} (v${blueprint.versions.length})`)
  console.log(` App Entity Configured: ${appEntity.name}`)
  console.log(` Builder Operations: ${builderManager.getBuildHistory().length}`)
  console.log(` Development Session: ${developmentSession.id}`)
  console.log(` Scripts Edited: ${validationResult.valid ? 'Validated successfully' : 'Validation failed'}`)
  console.log(` Test Coverage: ${testResults.coverage}%`)
  console.log(` Performance Score: ${report.performanceScore}`)

  console.log('\n<‰ Hyperfy App Development Workflow Example Completed Successfully!')
  console.log('\nKey Features Demonstrated:')
  console.log('  " Asset management with optimization and validation')
  console.log('  " Blueprint creation with versioning and collaboration')
  console.log('  " App entity lifecycle management')
  console.log('  " Builder system with programmatic operations')
  console.log('  " Real-time collaborative development')
  console.log('  " Script editing with hot reloading')
  console.log('  " Performance monitoring and debugging')
  console.log('  " Testing framework integration')
  console.log('  " Asset analytics and optimization')
}

// Error handling
main().catch(error => {
  console.error('L Error in app development workflow:', error)
  process.exit(1)
})