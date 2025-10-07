export class AppTreeView {
  constructor(client) {
    this.client = client
    this.currentApp = null
    this.treeData = null
    this.selectedNode = null
    this.expandedNodes = new Set()

    // Event handlers
    this.onNodeSelect = null
    this.onNodeExpand = null
    this.onNodeCollapse = null
    this.onTreeUpdate = null
  }

  // Tree data loading
  async loadApp(appId) {
    try {
      const app = this.client.getEntity(appId)
      if (!app || !app.isApp()) {
        throw new Error('Entity is not an app or does not exist')
      }

      this.currentApp = app
      this.treeData = this.buildTreeData(app)
      this.selectedNode = null
      this.expandedNodes.clear()

      if (this.onTreeUpdate) {
        this.onTreeUpdate(this.treeData)
      }

      return this.treeData
    } catch (error) {
      throw new Error(`Failed to load app tree: ${error.message}`)
    }
  }

  unloadApp() {
    this.currentApp = null
    this.treeData = null
    this.selectedNode = null
    this.expandedNodes.clear()
  }

  // Tree data building
  buildTreeData(app) {
    const blueprint = app.getBlueprint()
    const script = app.getBlueprintScript() || ''

    const tree = {
      id: 'root',
      type: 'root',
      name: app.getBlueprintName(),
      path: '/',
      children: [],
      metadata: {
        appId: app.id,
        blueprintId: blueprint?.id,
        version: blueprint?.version || 0,
        lastModified: blueprint?.lastModified || Date.now()
      }
    }

    // Add blueprint info
    if (blueprint) {
      tree.children.push(this.createBlueprintNode(blueprint))
    }

    // Add script structure
    if (script) {
      tree.children.push(this.createScriptNode(script))
    }

    // Add state node
    tree.children.push(this.createStateNode(app))

    // Add properties node
    tree.children.push(this.createPropertiesNode(app))

    // Add events node
    tree.children.push(this.createEventsNode(app))

    return tree
  }

  createBlueprintNode(blueprint) {
    const node = {
      id: 'blueprint',
      type: 'blueprint',
      name: 'Blueprint',
      path: '/blueprint',
      children: [],
      metadata: {
        id: blueprint.id,
        version: blueprint.version,
        author: blueprint.author,
        description: blueprint.desc,
        locked: blueprint.locked,
        frozen: blueprint.frozen,
        unique: blueprint.unique,
        scene: blueprint.scene,
        disabled: blueprint.disabled
      }
    }

    // Add blueprint properties
    if (blueprint.props) {
      node.children.push(this.createPropertiesNode(null, blueprint.props, 'blueprint-props', 'Properties'))
    }

    // Add assets
    if (blueprint.model || blueprint.image) {
      node.children.push(this.createAssetsNode(blueprint))
    }

    return node
  }

  createScriptNode(script) {
    const node = {
      id: 'script',
      type: 'script',
      name: 'Script',
      path: '/script',
      children: [],
      metadata: {
        size: script.length,
        lines: script.split('\n').length
      }
    }

    // Parse script structure
    const functions = this.extractFunctions(script)
    functions.forEach(func => {
      node.children.push(this.createFunctionNode(func))
    })

    // Add imports/exports
    const imports = this.extractImports(script)
    const exports = this.extractExports(script)

    if (imports.length > 0) {
      node.children.push(this.createImportsNode(imports))
    }

    if (exports.length > 0) {
      node.children.push(this.createExportsNode(exports))
    }

    return node
  }

  createFunctionNode(func) {
    return {
      id: `function-${func.name}`,
      type: 'function',
      name: func.name,
      path: `/script/${func.name}`,
      children: [],
      metadata: {
        line: func.line,
        parameters: func.parameters,
        isAsync: func.isAsync,
        isExported: func.isExported,
        body: func.body
      }
    }
  }

  createImportsNode(imports) {
    return {
      id: 'imports',
      type: 'imports',
      name: 'Imports',
      path: '/script/imports',
      children: imports.map(imp => ({
        id: `import-${imp.module}`,
        type: 'import',
        name: imp.name,
        path: `/script/imports/${imp.name}`,
        children: [],
        metadata: {
          module: imp.module,
          isDefault: imp.isDefault,
          line: imp.line
        }
      })),
      metadata: { count: imports.length }
    }
  }

  createExportsNode(exports) {
    return {
      id: 'exports',
      type: 'exports',
      name: 'Exports',
      path: '/script/exports',
      children: exports.map(exp => ({
        id: `export-${exp.name}`,
        type: 'export',
        name: exp.name,
        path: `/script/exports/${exp.name}`,
        children: [],
        metadata: {
          isDefault: exp.isDefault,
          line: exp.line
        }
      })),
      metadata: { count: exports.length }
    }
  }

  createStateNode(app) {
    const state = app.getState()
    const stateKeys = Object.keys(state)

    return {
      id: 'state',
      type: 'state',
      name: 'State',
      path: '/state',
      children: stateKeys.map(key => ({
        id: `state-${key}`,
        type: 'state-property',
        name: key,
        path: `/state/${key}`,
        children: [],
        metadata: {
          value: state[key],
          type: typeof state[key],
          lastModified: Date.now()
        }
      })),
      metadata: {
        count: stateKeys.length,
        size: JSON.stringify(state).length
      }
    }
  }

  createPropertiesNode(app, props = null, id = 'properties', name = 'Properties') {
    const properties = props || (app ? {
      position: app.getPosition(),
      quaternion: app.getQuaternion(),
      scale: app.getScale(),
      name: app.getName(),
      blueprintId: app.blueprintId
    } : {})

    const propKeys = Object.keys(properties)

    return {
      id,
      type: 'properties',
      name,
      path: `/${id}`,
      children: propKeys.map(key => ({
        id: `${id}-${key}`,
        type: 'property',
        name: key,
        path: `/${id}/${key}`,
        children: [],
        metadata: {
          value: properties[key],
          type: typeof properties[key],
          writable: true
        }
      })),
      metadata: {
        count: propKeys.length
      }
    }
  }

  createEventsNode(app) {
    return {
      id: 'events',
      type: 'events',
      name: 'Events',
      path: '/events',
      children: [
        {
          id: 'event-onClick',
          type: 'event',
          name: 'onClick',
          path: '/events/onClick',
          children: [],
          metadata: { type: 'interaction', description: 'Fired when entity is clicked' }
        },
        {
          id: 'event-onHover',
          type: 'event',
          name: 'onHover',
          path: '/events/onHover',
          children: [],
          metadata: { type: 'interaction', description: 'Fired when mouse hovers over entity' }
        },
        {
          id: 'event-onCollision',
          type: 'event',
          name: 'onCollision',
          path: '/events/onCollision',
          children: [],
          metadata: { type: 'physics', description: 'Fired when entity collides with another' }
        },
        {
          id: 'event-onUpdate',
          type: 'event',
          name: 'onUpdate',
          path: '/events/onUpdate',
          children: [],
          metadata: { type: 'lifecycle', description: 'Fired every frame' }
        }
      ],
      metadata: { count: 4 }
    }
  }

  createAssetsNode(blueprint) {
    const assets = []

    if (blueprint.model) {
      assets.push({
        id: 'asset-model',
        type: 'asset',
        name: 'Model',
        path: '/assets/model',
        children: [],
        metadata: {
          url: blueprint.model,
          type: '3d-model',
          format: this.getAssetFormat(blueprint.model)
        }
      })
    }

    if (blueprint.image) {
      assets.push({
        id: 'asset-image',
        type: 'asset',
        name: 'Image',
        path: '/assets/image',
        children: [],
        metadata: {
          url: blueprint.image,
          type: 'image',
          format: this.getAssetFormat(blueprint.image)
        }
      })
    }

    return {
      id: 'assets',
      type: 'assets',
      name: 'Assets',
      path: '/assets',
      children: assets,
      metadata: { count: assets.length }
    }
  }

  // Tree navigation
  findNode(path) {
    if (!this.treeData) return null

    const pathParts = path.split('/').filter(Boolean)
    let current = this.treeData

    for (const part of pathParts) {
      if (current.children) {
        const found = current.children.find(child => child.name === part || child.id === part)
        if (found) {
          current = found
        } else {
          return null
        }
      } else {
        return null
      }
    }

    return current
  }

  findNodeById(id) {
    if (!this.treeData) return null

    const search = (node) => {
      if (node.id === id) return node
      if (node.children) {
        for (const child of node.children) {
          const found = search(child)
          if (found) return found
        }
      }
      return null
    }

    return search(this.treeData)
  }

  findNodesByType(type) {
    if (!this.treeData) return []

    const results = []
    const search = (node) => {
      if (node.type === type) results.push(node)
      if (node.children) {
        node.children.forEach(search)
      }
    }

    search(this.treeData)
    return results
  }

  // Node manipulation
  selectNode(nodeOrPath) {
    const node = typeof nodeOrPath === 'string' ? this.findNode(nodeOrPath) : nodeOrPath
    if (node) {
      this.selectedNode = node
      if (this.onNodeSelect) {
        this.onNodeSelect(node)
      }
    }
    return node
  }

  expandNode(nodeOrPath) {
    const node = typeof nodeOrPath === 'string' ? this.findNode(nodeOrPath) : nodeOrPath
    if (node && node.children && node.children.length > 0) {
      this.expandedNodes.add(node.id)
      if (this.onNodeExpand) {
        this.onNodeExpand(node)
      }
    }
    return node
  }

  collapseNode(nodeOrPath) {
    const node = typeof nodeOrPath === 'string' ? this.findNode(nodeOrPath) : nodeOrPath
    if (node) {
      this.expandedNodes.delete(node.id)
      if (this.onNodeCollapse) {
        this.onNodeCollapse(node)
      }
    }
    return node
  }

  expandAll() {
    const expandAllNodes = (node) => {
      if (node.children && node.children.length > 0) {
        this.expandedNodes.add(node.id)
        node.children.forEach(expandAllNodes)
      }
    }

    if (this.treeData) {
      expandAllNodes(this.treeData)
    }
  }

  collapseAll() {
    this.expandedNodes.clear()
  }

  isExpanded(node) {
    return this.expandedNodes.has(node.id)
  }

  // Tree filtering
  filterNodes(predicate) {
    if (!this.treeData) return []

    const results = []
    const search = (node) => {
      if (predicate(node)) results.push(node)
      if (node.children) {
        node.children.forEach(search)
      }
    }

    search(this.treeData)
    return results
  }

  searchNodes(query) {
    const lowerQuery = query.toLowerCase()
    return this.filterNodes(node =>
      node.name.toLowerCase().includes(lowerQuery) ||
      (node.metadata && Object.values(node.metadata).some(value =>
        typeof value === 'string' && value.toLowerCase().includes(lowerQuery)
      ))
    )
  }

  // Tree export
  exportTree(format = 'json') {
    if (!this.treeData) return null

    const data = {
      tree: this.treeData,
      selectedNode: this.selectedNode?.id || null,
      expandedNodes: Array.from(this.expandedNodes),
      timestamp: Date.now()
    }

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(data, null, 2)
      case 'text':
        return this.treeToText(this.treeData)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  treeToText(node, indent = 0) {
    const prefix = '  '.repeat(indent)
    let text = `${prefix}${node.name} (${node.type})\n`

    if (node.children && this.isExpanded(node)) {
      node.children.forEach(child => {
        text += this.treeToText(child, indent + 1)
      })
    }

    return text
  }

  // Code parsing utilities
  extractFunctions(script) {
    const functions = []
    const lines = script.split('\n')
    const functionRegex = /^(export\s+)?(async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/gm
    const arrowFunctionRegex = /^(export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*{/gm

    let match

    // Regular functions
    while ((match = functionRegex.exec(script)) !== null) {
      const lineIndex = script.substring(0, match.index).split('\n').length
      functions.push({
        name: match[3],
        line: lineIndex,
        isAsync: !!match[2],
        isExported: !!match[1],
        parameters: this.extractParameters(match[0]),
        body: this.extractFunctionBody(script, match.index)
      })
    }

    // Arrow functions
    while ((match = arrowFunctionRegex.exec(script)) !== null) {
      const lineIndex = script.substring(0, match.index).split('\n').length
      functions.push({
        name: match[2],
        line: lineIndex,
        isAsync: match[0].includes('async'),
        isExported: !!match[1],
        parameters: this.extractParameters(match[0]),
        body: this.extractFunctionBody(script, match.index)
      })
    }

    return functions
  }

  extractParameters(functionText) {
    const paramMatch = functionText.match(/\(([^)]*)\)/)
    if (paramMatch) {
      return paramMatch[1].split(',').map(p => p.trim()).filter(p => p)
    }
    return []
  }

  extractFunctionBody(script, startIndex) {
    const afterStart = script.substring(startIndex)
    const braceMatch = afterStart.match(/\{/)
    if (!braceMatch) return ''

    let braceCount = 0
    let bodyEnd = 0
    let inString = false
    let stringChar = ''

    for (let i = braceMatch.index; i < afterStart.length; i++) {
      const char = afterStart[i]

      if (!inString) {
        if (char === '"' || char === "'" || char === '`') {
          inString = true
          stringChar = char
        } else if (char === '{') {
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0) {
            bodyEnd = i + 1
            break
          }
        }
      } else {
        if (char === stringChar) {
          inString = false
        } else if (char === '\\' && i < afterStart.length - 1) {
          i++ // Skip escaped character
        }
      }
    }

    return afterStart.substring(braceMatch.index + 1, bodyEnd - 1).trim()
  }

  extractImports(script) {
    const imports = []
    const importRegex = /^import\s+(?:(?:\*\s+as\s+(\w+))|(?:\{([^}]+)\})|(?:([^{}\s,]+)))\s+from\s+['"]([^'"]+)['"];?$/gm
    let match

    while ((match = importRegex.exec(script)) !== null) {
      const lineIndex = script.substring(0, match.index).split('\n').length
      let name, isDefault = false

      if (match[1]) {
        name = match[1] // import * as name
      } else if (match[2]) {
        name = match[2].split(',').map(s => s.trim())[0] // first named import
      } else if (match[3]) {
        name = match[3]
        isDefault = true // default import
      }

      imports.push({
        name: name?.trim(),
        module: match[4],
        isDefault,
        line: lineIndex
      })
    }

    return imports
  }

  extractExports(script) {
    const exports = []
    const exportRegex = /^(export\s+(?:default\s+)?(?:function|const|let|var)\s+(\w+))/gm
    let match

    while ((match = exportRegex.exec(script)) !== null) {
      const lineIndex = script.substring(0, match.index).split('\n').length
      exports.push({
        name: match[2],
        isDefault: match[1].includes('default'),
        line: lineIndex
      })
    }

    return exports
  }

  getAssetFormat(url) {
    const extension = url.split('.').pop()?.toLowerCase()
    const formatMap = {
      'jpg': 'jpeg', 'jpeg': 'jpeg', 'png': 'png', 'gif': 'gif', 'webp': 'webp',
      'glb': 'gltf-binary', 'gltf': 'gltf+json', 'obj': 'wavefront-obj',
      'fbx': 'autodesk-fbx', 'mp3': 'mpeg', 'wav': 'wav', 'ogg': 'ogg'
    }
    return formatMap[extension] || 'unknown'
  }

  // Events
  on(event, callback) {
    switch (event) {
      case 'nodeSelect':
        this.onNodeSelect = callback
        break
      case 'nodeExpand':
        this.onNodeExpand = callback
        break
      case 'nodeCollapse':
        this.onNodeCollapse = callback
        break
      case 'treeUpdate':
        this.onTreeUpdate = callback
        break
      default:
        throw new Error(`Unknown tree view event: ${event}`)
    }
  }

  off(event) {
    switch (event) {
      case 'nodeSelect':
        this.onNodeSelect = null
        break
      case 'nodeExpand':
        this.onNodeExpand = null
        break
      case 'nodeCollapse':
        this.onNodeCollapse = null
        break
      case 'treeUpdate':
        this.onTreeUpdate = null
        break
      default:
        throw new Error(`Unknown tree view event: ${event}`)
    }
  }

  // Debug
  toString() {
    const nodeCount = this.countNodes(this.treeData)
    return `AppTreeView(${this.currentApp?.id || 'no app'}, ${nodeCount} nodes)`
  }

  countNodes(node) {
    if (!node) return 0
    let count = 1
    if (node.children) {
      node.children.forEach(child => {
        count += this.countNodes(child)
      })
    }
    return count
  }
}