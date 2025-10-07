import * as fs from 'fs';
import * as path from 'path';
import { HyperfySDK } from '../src';

async function fileOperationsExample() {
  console.log('📁 Starting File Operations Example');

  const sdk = new HyperfySDK({
    logLevel: 'debug',
  });

  try {
    const fileManager = sdk.getFileManager();

    // Set up file event listeners
    fileManager.on('uploadStarted', (data) => {
      console.log(`⬆️ Upload started: ${data.fileName} (${data.size} bytes)`);
    });

    fileManager.on('uploadCompleted', (result) => {
      console.log(`✅ Upload completed: ${result.file.name} -> ${result.url}`);
    });

    fileManager.on('uploadFailed', (data) => {
      console.log(`❌ Upload failed: ${data.fileName} - ${data.error.message}`);
    });

    fileManager.on('fileDownloaded', (data) => {
      console.log(`⬇️ Download completed: ${data.fileId} (${data.size} bytes)`);
    });

    fileManager.on('fileDeleted', (fileId) => {
      console.log(`🗑️ File deleted: ${fileId}`);
    });

    // Create some test files
    const testDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a text file
    const textFile = path.join(testDir, 'test.txt');
    const textContent = 'Hello from Hyperfy SDK! This is a test file.\n';
    fs.writeFileSync(textFile, textContent);
    console.log(`📝 Created test file: ${textFile}`);

    // Create a JSON file
    const jsonFile = path.join(testDir, 'data.json');
    const jsonData = {
      name: 'Test Asset',
      version: '1.0.0',
      type: 'scene',
      entities: [
        {
          type: 'box',
          position: { x: 0, y: 1, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
      ],
    };
    fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2));
    console.log(`📋 Created JSON file: ${jsonFile}`);

    // Create a simple GLTF file (mock data)
    const gltfFile = path.join(testDir, 'model.gltf');
    const gltfData = {
      asset: {
        version: '2.0',
        generator: 'Hyperfy SDK Example',
      },
      scene: 0,
      scenes: [
        {
          nodes: [0],
        },
      ],
      nodes: [
        {
          mesh: 0,
          translation: [0, 1, 0],
        },
      ],
      meshes: [
        {
          primitives: [
            {
              attributes: {
                POSITION: 1,
                NORMAL: 2,
              },
              indices: 0,
              material: 0,
            },
          ],
        },
      ],
      materials: [
        {
          name: 'Default',
          pbrMetallicRoughness: {
            baseColorFactor: [1, 1, 1, 1],
            metallicFactor: 0,
            roughnessFactor: 0.5,
          },
        },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5123,
          count: 36,
          type: 'SCALAR',
        },
        {
          bufferView: 1,
          componentType: 5126,
          count: 24,
          type: 'VEC3',
          max: [0.5, 0.5, 0.5],
          min: [-0.5, -0.5, -0.5],
        },
        {
          bufferView: 2,
          componentType: 5126,
          count: 24,
          type: 'VEC3',
        },
      ],
      buffers: [
        {
          byteLength: 1000, // Mock size
        },
      ],
      bufferViews: [
        {
          buffer: 0,
          byteOffset: 0,
          byteLength: 72,
        },
        {
          buffer: 0,
          byteOffset: 72,
          byteLength: 288,
        },
        {
          buffer: 0,
          byteOffset: 360,
          byteLength: 288,
        },
      ],
    };
    fs.writeFileSync(gltfFile, JSON.stringify(gltfData, null, 2));
    console.log(`🎨 Created GLTF file: ${gltfFile}`);

    console.log('\n📤 Starting file uploads...');

    // Upload text file
    console.log('\n1. Uploading text file...');
    const textResult = await fileManager.uploadFile(textFile, {
      appId: 'example-app-id', // Replace with actual app ID
      public: true,
      metadata: {
        type: 'document',
        category: 'text',
      },
    });

    // Upload JSON file
    console.log('\n2. Uploading JSON file...');
    const jsonResult = await fileManager.uploadFile(jsonFile, {
      appId: 'example-app-id',
      public: true,
      metadata: {
        type: 'config',
        category: 'data',
        version: jsonData.version,
      },
    });

    // Upload GLTF file
    console.log('\n3. Uploading GLTF file...');
    const gltfResult = await fileManager.uploadFile(gltfFile, {
      appId: 'example-app-id',
      public: true,
      metadata: {
        type: 'model',
        category: '3d',
        format: 'gltf',
      },
    });

    // Upload from buffer
    console.log('\n4. Uploading from buffer...');
    const bufferContent = Buffer.from('Direct buffer upload test!', 'utf8');
    const bufferResult = await fileManager.uploadBuffer(
      bufferContent,
      'buffer-test.txt',
      {
        appId: 'example-app-id',
        public: false,
        metadata: {
          type: 'test',
          source: 'buffer',
        },
      }
    );

    console.log('\n📋 File upload summary:');
    const uploadedFiles = [textResult, jsonResult, gltfResult, bufferResult];
    for (const result of uploadedFiles) {
      console.log(`  ${result.file.name}: ${result.file.url}`);
    }

    // Get file information
    console.log('\n🔍 Getting file information...');
    const fileInfo = await fileManager.getFile(textResult.file.id);
    console.log(`File info for ${fileInfo.name}:`);
    console.log(`  Size: ${fileInfo.size} bytes`);
    console.log(`  Type: ${fileInfo.type}`);
    console.log(`  Public: ${fileInfo.isPublic}`);
    console.log(`  Uploaded: ${fileInfo.uploadedAt.toISOString()}`);

    // List files
    console.log('\n📋 Listing files...');
    const fileList = await fileManager.listFiles({
      limit: 10,
      sortBy: 'uploadedAt',
      sortOrder: 'desc',
    });

    console.log(`Found ${fileList.total} files (${fileList.hasMore ? 'more available' : 'all shown'}):`);
    for (const file of fileList.files.slice(0, 5)) {
      console.log(`  ${file.name} (${file.type}) - ${file.size} bytes`);
    }

    // Update file metadata
    console.log('\n📝 Updating file metadata...');
    await fileManager.updateFileMetadata(jsonResult.file.id, {
      description: 'Updated description',
      tags: ['test', 'example', 'hyperfy'],
      lastModified: new Date().toISOString(),
    });

    console.log('✅ Metadata updated');

    // Download files
    console.log('\n⬇️ Downloading files...');

    const downloadDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    // Download text file
    const downloadedTextPath = path.join(downloadDir, 'downloaded-text.txt');
    await fileManager.downloadFile(textResult.file.id, downloadedTextPath);
    console.log(`Downloaded text file to: ${downloadedTextPath}`);

    // Download JSON file to buffer
    const downloadedJsonBuffer = await fileManager.downloadFileToBuffer(jsonResult.file.id);
    const downloadedJson = JSON.parse(downloadedJsonBuffer.toString());
    console.log(`Downloaded JSON buffer with ${downloadedJson.entities.length} entities`);

    // Get file URL (for public files)
    console.log('\n🔗 Getting file URLs...');
    try {
      const publicUrl = await fileManager.getFileUrl(textResult.file.id);
      console.log(`Public URL: ${publicUrl}`);
    } catch (error) {
      console.log(`Could not get public URL: ${error.message}`);
    }

    // Get usage statistics
    console.log('\n📊 Usage statistics...');
    try {
      const stats = await fileManager.getUsageStats('example-app-id');
      console.log(`Total files: ${stats.totalFiles}`);
      console.log(`Total size: ${stats.storageUsed} bytes`);
      console.log(`Files by type:`, stats.filesByType);
    } catch (error) {
      console.log(`Could not get usage stats: ${error.message}`);
    }

    // Clean up
    console.log('\n🧹 Cleaning up...');

    // Delete uploaded files
    for (const result of uploadedFiles) {
      try {
        await fileManager.deleteFile(result.file.id);
        console.log(`Deleted file: ${result.file.id}`);
      } catch (error) {
        console.log(`Failed to delete file ${result.file.id}: ${error.message}`);
      }
    }

    // Clean up local files
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
      fs.rmSync(downloadDir, { recursive: true, force: true });
      console.log('Cleaned up local files');
    } catch (error) {
      console.log(`Failed to clean up local files: ${error.message}`);
    }

    console.log('\n✅ File operations example completed!');

  } catch (error) {
    console.error('❌ Error in file operations example:', error);
  }
}

// Run the example
if (require.main === module) {
  fileOperationsExample().catch(console.error);
}

export { fileOperationsExample };