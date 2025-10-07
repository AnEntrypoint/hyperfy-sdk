import fetch from 'node-fetch';
import { NodeLogger } from '../utils/logger';
import { NetworkError, TimeoutError, AuthenticationError } from '../utils/errors';

export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  apiKey?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export class HttpClient {
  private config: Required<HttpClientConfig>;
  private logger: NodeLogger;

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      baseURL: '',
      timeout: 10000,
      retries: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HyperfySDK-Node/1.0.0',
      },
      apiKey: '',
      ...config,
    };
    this.logger = new NodeLogger('HttpClient');
  }

  private buildURL(path: string): string {
    const baseURL = this.config.baseURL.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseURL}${cleanPath}`;
  }

  private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers = { ...this.config.headers };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }

    return headers;
  }

  private async makeRequest<T = any>(
    url: string,
    options: RequestOptions & { retries: number }
  ): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      headers,
      body,
      timeout = this.config.timeout,
      retries,
    } = options;

    const requestHeaders = this.buildHeaders(headers);
    const bodyData = body ? JSON.stringify(body) : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      this.logger.debug(`Making ${method} request to ${url}`, { body: bodyData });

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: bodyData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let data: T;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      const httpResponse: HttpResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      };

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthenticationError('Authentication failed', httpResponse);
        }
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          httpResponse
        );
      }

      this.logger.debug(`${method} request successful`, { status: response.status });
      return httpResponse;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof NetworkError || error instanceof AuthenticationError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new TimeoutError(`Request timeout after ${timeout}ms`);
      }

      if (retries > 0) {
        this.logger.warn(`Request failed, retrying... (${retries} attempts left)`, error);
        await this.delay(this.config.retryDelay);
        return this.makeRequest<T>(url, { ...options, retries: retries - 1 });
      }

      throw new NetworkError('Request failed', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get<T = any>(path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const url = this.buildURL(path);
    return this.makeRequest<T>(url, { ...options, method: 'GET', retries: options.retries ?? this.config.retries });
  }

  async post<T = any>(path: string, data?: any, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const url = this.buildURL(path);
    return this.makeRequest<T>(url, { ...options, method: 'POST', body: data, retries: options.retries ?? this.config.retries });
  }

  async put<T = any>(path: string, data?: any, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const url = this.buildURL(path);
    return this.makeRequest<T>(url, { ...options, method: 'PUT', body: data, retries: options.retries ?? this.config.retries });
  }

  async patch<T = any>(path: string, data?: any, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const url = this.buildURL(path);
    return this.makeRequest<T>(url, { ...options, method: 'PATCH', body: data, retries: options.retries ?? this.config.retries });
  }

  async delete<T = any>(path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const url = this.buildURL(path);
    return this.makeRequest<T>(url, { ...options, method: 'DELETE', retries: options.retries ?? this.config.retries });
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  getApiKey(): string {
    return this.config.apiKey;
  }

  setBaseURL(baseURL: string): void {
    this.config.baseURL = baseURL;
  }

  getBaseURL(): string {
    return this.config.baseURL;
  }

  setDefaultHeader(key: string, value: string): void {
    this.config.headers[key] = value;
  }

  removeDefaultHeader(key: string): void {
    delete this.config.headers[key];
  }
}