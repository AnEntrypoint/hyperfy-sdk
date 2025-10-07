import { EventEmitter } from 'eventemitter3';
import { NodeLogger } from '../utils/logger';
import { HttpClient } from '../network/http-client';
import { ValidationError, AppError } from '../utils/errors';
import { ChatMessage, User } from '../types';

export interface ChatManagerConfig {
  httpClient: HttpClient;
  baseURL?: string;
  maxMessageLength?: number;
  enableHistory?: boolean;
  historySize?: number;
}

export interface SendMessageOptions {
  type?: 'text' | 'system' | 'command';
  whisperTo?: string;
  replyTo?: string;
}

export interface ChatHistoryOptions {
  limit?: number;
  before?: string;
  after?: string;
  userId?: string;
  type?: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  members: string[];
  maxMembers: number;
  createdAt: Date;
  owner: string;
}

export class ChatManager extends EventEmitter {
  private httpClient: HttpClient;
  private baseURL: string;
  private config: Required<ChatManagerConfig>;
  private logger: NodeLogger;
  private messageHistory: ChatMessage[] = [];
  private joinedRooms: Set<string> = new Set();

  constructor(config: ChatManagerConfig) {
    super();
    this.httpClient = config.httpClient;
    this.baseURL = config.baseURL || '/chat';
    this.config = {
      maxMessageLength: 1000,
      enableHistory: true,
      historySize: 1000,
      ...config,
    };
    this.logger = new NodeLogger('ChatManager');
  }

  async sendMessage(
    appId: string,
    content: string,
    userId: string,
    options: SendMessageOptions = {}
  ): Promise<ChatMessage> {
    this.validateMessage(content, options);

    const messageData = {
      appId,
      content: content.trim(),
      userId,
      type: options.type || 'text',
      whisperTo: options.whisperTo,
      replyTo: options.replyTo,
      timestamp: new Date(),
    };

    try {
      const response = await this.httpClient.post<ChatMessage>(`${this.baseURL}/messages`, messageData);
      const message = response.data;

      this.addToHistory(message);
      this.logger.debug(`Message sent: ${message.id} in app: ${appId}`);
      this.emit('messageSent', message);

      return message;

    } catch (error) {
      this.logger.error('Failed to send message', error);
      throw new AppError('Failed to send message', error);
    }
  }

  async getMessages(
    appId: string,
    options: ChatHistoryOptions = {}
  ): Promise<{ messages: ChatMessage[], hasMore: boolean }> {
    const queryParams = new URLSearchParams();

    if (options.limit) queryParams.append('limit', options.limit.toString());
    if (options.before) queryParams.append('before', options.before);
    if (options.after) queryParams.append('after', options.after);
    if (options.userId) queryParams.append('userId', options.userId);
    if (options.type) queryParams.append('type', options.type);

    const url = queryParams.toString()
      ? `${this.baseURL}/apps/${appId}/messages?${queryParams.toString()}`
      : `${this.baseURL}/apps/${appId}/messages`;

    try {
      const response = await this.httpClient.get<{ messages: ChatMessage[], hasMore: boolean }>(url);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to get messages for app: ${appId}`, error);
      throw new AppError(`Failed to get messages for app: ${appId}`, error);
    }
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    if (!messageId) {
      throw new ValidationError('Message ID is required');
    }

    try {
      await this.httpClient.delete(`${this.baseURL}/messages/${messageId}`, {
        headers: { 'X-User-Id': userId },
      });

      this.removeFromHistory(messageId);
      this.logger.debug(`Message deleted: ${messageId}`);
      this.emit('messageDeleted', messageId);

      return true;

    } catch (error) {
      this.logger.error(`Failed to delete message: ${messageId}`, error);
      throw new AppError(`Failed to delete message: ${messageId}`, error);
    }
  }

  async editMessage(messageId: string, content: string, userId: string): Promise<ChatMessage> {
    if (!messageId || !content?.trim()) {
      throw new ValidationError('Message ID and content are required');
    }

    if (content.length > this.config.maxMessageLength) {
      throw new ValidationError(`Message must be ${this.config.maxMessageLength} characters or less`);
    }

    try {
      const response = await this.httpClient.put<ChatMessage>(
        `${this.baseURL}/messages/${messageId}`,
        { content: content.trim() },
        { headers: { 'X-User-Id': userId } }
      );

      const message = response.data;
      this.updateInHistory(message);
      this.logger.debug(`Message edited: ${messageId}`);
      this.emit('messageEdited', message);

      return message;

    } catch (error) {
      this.logger.error(`Failed to edit message: ${messageId}`, error);
      throw new AppError(`Failed to edit message: ${messageId}`, error);
    }
  }

  async createRoom(roomData: {
    name: string;
    description?: string;
    isPrivate?: boolean;
    maxMembers?: number;
    owner: string;
  }): Promise<ChatRoom> {
    this.validateRoomData(roomData);

    try {
      const response = await this.httpClient.post<ChatRoom>(`${this.baseURL}/rooms`, roomData);
      const room = response.data;

      this.logger.info(`Chat room created: ${room.id} - ${room.name}`);
      this.emit('roomCreated', room);

      return room;

    } catch (error) {
      this.logger.error('Failed to create chat room', error);
      throw new AppError('Failed to create chat room', error);
    }
  }

  async joinRoom(roomId: string, userId: string): Promise<boolean> {
    if (!roomId || !userId) {
      throw new ValidationError('Room ID and User ID are required');
    }

    try {
      await this.httpClient.post(`${this.baseURL}/rooms/${roomId}/join`, { userId });
      this.joinedRooms.add(roomId);

      this.logger.debug(`User ${userId} joined room: ${roomId}`);
      this.emit('roomJoined', { roomId, userId });

      return true;

    } catch (error) {
      this.logger.error(`Failed to join room: ${roomId}`, error);
      throw new AppError(`Failed to join room: ${roomId}`, error);
    }
  }

  async leaveRoom(roomId: string, userId: string): Promise<boolean> {
    if (!roomId || !userId) {
      throw new ValidationError('Room ID and User ID are required');
    }

    try {
      await this.httpClient.post(`${this.baseURL}/rooms/${roomId}/leave`, { userId });
      this.joinedRooms.delete(roomId);

      this.logger.debug(`User ${userId} left room: ${roomId}`);
      this.emit('roomLeft', { roomId, userId });

      return true;

    } catch (error) {
      this.logger.error(`Failed to leave room: ${roomId}`, error);
      throw new AppError(`Failed to leave room: ${roomId}`, error);
    }
  }

  async getRoom(roomId: string): Promise<ChatRoom> {
    if (!roomId) {
      throw new ValidationError('Room ID is required');
    }

    try {
      const response = await this.httpClient.get<ChatRoom>(`${this.baseURL}/rooms/${roomId}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to get room: ${roomId}`, error);
      throw new AppError(`Failed to get room: ${roomId}`, error);
    }
  }

  async getUserRooms(userId: string): Promise<ChatRoom[]> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    try {
      const response = await this.httpClient.get<ChatRoom[]>(`${this.baseURL}/users/${userId}/rooms`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to get user rooms: ${userId}`, error);
      throw new AppError(`Failed to get user rooms: ${userId}`, error);
    }
  }

  async sendMessageToRoom(
    roomId: string,
    content: string,
    userId: string,
    options: SendMessageOptions = {}
  ): Promise<ChatMessage> {
    this.validateMessage(content, options);

    const messageData = {
      roomId,
      content: content.trim(),
      userId,
      type: options.type || 'text',
      replyTo: options.replyTo,
      timestamp: new Date(),
    };

    try {
      const response = await this.httpClient.post<ChatMessage>(`${this.baseURL}/rooms/${roomId}/messages`, messageData);
      const message = response.data;

      this.addToHistory(message);
      this.logger.debug(`Room message sent: ${message.id} in room: ${roomId}`);
      this.emit('roomMessageSent', message);

      return message;

    } catch (error) {
      this.logger.error(`Failed to send room message: ${roomId}`, error);
      throw new AppError(`Failed to send room message: ${roomId}`, error);
    }
  }

  async getRoomMessages(
    roomId: string,
    options: ChatHistoryOptions = {}
  ): Promise<{ messages: ChatMessage[], hasMore: boolean }> {
    const queryParams = new URLSearchParams();

    if (options.limit) queryParams.append('limit', options.limit.toString());
    if (options.before) queryParams.append('before', options.before);
    if (options.after) queryParams.append('after', options.after);
    if (options.type) queryParams.append('type', options.type);

    const url = queryParams.toString()
      ? `${this.baseURL}/rooms/${roomId}/messages?${queryParams.toString()}`
      : `${this.baseURL}/rooms/${roomId}/messages`;

    try {
      const response = await this.httpClient.get<{ messages: ChatMessage[], hasMore: boolean }>(url);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to get room messages: ${roomId}`, error);
      throw new AppError(`Failed to get room messages: ${roomId}`, error);
    }
  }

  async getActiveUsers(appId: string): Promise<User[]> {
    try {
      const response = await this.httpClient.get<User[]>(`${this.baseURL}/apps/${appId}/active-users`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to get active users for app: ${appId}`, error);
      throw new AppError(`Failed to get active users for app: ${appId}`, error);
    }
  }

  async blockUser(userId: string, blockedUserId: string): Promise<boolean> {
    try {
      await this.httpClient.post(`${this.baseURL}/users/${userId}/block`, { blockedUserId });
      this.logger.info(`User ${userId} blocked user ${blockedUserId}`);
      this.emit('userBlocked', { userId, blockedUserId });
      return true;

    } catch (error) {
      this.logger.error(`Failed to block user: ${blockedUserId}`, error);
      throw new AppError(`Failed to block user`, error);
    }
  }

  async unblockUser(userId: string, blockedUserId: string): Promise<boolean> {
    try {
      await this.httpClient.delete(`${this.baseURL}/users/${userId}/block/${blockedUserId}`);
      this.logger.info(`User ${userId} unblocked user ${blockedUserId}`);
      this.emit('userUnblocked', { userId, blockedUserId });
      return true;

    } catch (error) {
      this.logger.error(`Failed to unblock user: ${blockedUserId}`, error);
      throw new AppError(`Failed to unblock user`, error);
    }
  }

  getMessageHistory(): ChatMessage[] {
    return [...this.messageHistory];
  }

  getJoinedRooms(): string[] {
    return Array.from(this.joinedRooms);
  }

  clearHistory(): void {
    this.messageHistory = [];
    this.logger.debug('Chat history cleared');
  }

  private validateMessage(content: string, options: SendMessageOptions): void {
    if (!content || !content.trim()) {
      throw new ValidationError('Message content cannot be empty');
    }

    if (content.length > this.config.maxMessageLength) {
      throw new ValidationError(`Message must be ${this.config.maxMessageLength} characters or less`);
    }

    if (options.type === 'command' && !content.startsWith('/')) {
      throw new ValidationError('Commands must start with /');
    }
  }

  private validateRoomData(roomData: any): void {
    if (!roomData.name || roomData.name.trim().length < 1) {
      throw new ValidationError('Room name is required');
    }

    if (roomData.name.length > 50) {
      throw new ValidationError('Room name must be 50 characters or less');
    }

    if (roomData.description && roomData.description.length > 200) {
      throw new ValidationError('Room description must be 200 characters or less');
    }

    if (roomData.maxMembers && (roomData.maxMembers < 2 || roomData.maxMembers > 1000)) {
      throw new ValidationError('Room max members must be between 2 and 1000');
    }
  }

  private addToHistory(message: ChatMessage): void {
    if (!this.config.enableHistory) {
      return;
    }

    this.messageHistory.push(message);

    if (this.messageHistory.length > this.config.historySize) {
      this.messageHistory = this.messageHistory.slice(-this.config.historySize);
    }
  }

  private removeFromHistory(messageId: string): void {
    const index = this.messageHistory.findIndex(msg => msg.id === messageId);
    if (index > -1) {
      this.messageHistory.splice(index, 1);
    }
  }

  private updateInHistory(updatedMessage: ChatMessage): void {
    const index = this.messageHistory.findIndex(msg => msg.id === updatedMessage.id);
    if (index > -1) {
      this.messageHistory[index] = updatedMessage;
    }
  }
}