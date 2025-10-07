import { HyperfyClient } from './client/HyperfyClient.js'
import { Entity } from './client/Entity.js'
import { Player } from './client/Player.js'
import { App } from './client/App.js'
import { Chat } from './client/Chat.js'
import { FileUploader } from './client/FileUploader.js'
import { ErrorHandler } from './utils/ErrorHandler.js'
import { FileDragDrop } from './utils/FileDragDrop.js'
import { AppCodeEditor } from './utils/AppCodeEditor.js'
import { AppTreeView } from './utils/AppTreeView.js'
import { SDKUtils } from './utils/SDKUtils.js'
import { WorldManager } from './utils/WorldManager.js'
import { Packets } from './protocol/Packets.js'
import { WebSocketManager } from './client/WebSocketManager.js'
import { EntityBuilder, AppBuilder } from './builders/index.js'

export {
  // Main client
  HyperfyClient,

  // Core entities
  Entity,
  Player,
  App,
  Chat,

  // Network & protocols
  WebSocketManager,
  Packets,

  // Builders
  EntityBuilder,
  AppBuilder,

  // Utilities
  FileUploader,
  FileDragDrop,
  AppCodeEditor,
  AppTreeView,
  SDKUtils,
  WorldManager,
  ErrorHandler
}

// Default export for main client
export { HyperfyClient as default }