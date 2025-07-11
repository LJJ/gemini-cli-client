/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../../config/config.js';

/**
 * 可配置服务接口 - 支持运行时重新配置
 */
export interface ConfigurableService {
  /**
   * 设置配置对象
   * @param config 新的配置对象
   */
  setConfig(config: Config): void;

  /**
   * 获取当前配置对象
   * @returns 配置对象或null
   */
  getConfig(): Config | null;

  /**
   * 检查服务是否已配置
   * @returns 是否已配置
   */
  isConfigured(): boolean;
}

/**
 * 生命周期服务接口 - 支持初始化和清理
 */
export interface LifecycleService {
  /**
   * 初始化服务
   */
  initialize(): Promise<void>;

  /**
   * 清理服务资源
   */
  cleanup(): Promise<void>;

  /**
   * 检查服务是否已初始化
   * @returns 是否已初始化
   */
  isInitialized(): boolean;
}

/**
 * 重新配置服务接口 - 支持运行时重新配置
 */
export interface ReconfigurableService extends ConfigurableService, LifecycleService {
  /**
   * 重新配置服务
   * @param config 新的配置对象
   */
  reconfigure(config: Config): Promise<void>;
}

/**
 * 工作区感知服务接口 - 支持工作区改变
 */
export interface WorkspaceAwareService {
  /**
   * 当工作区改变时调用
   * @param newWorkspacePath 新的工作区路径
   */
  onWorkspaceChanged(newWorkspacePath: string): Promise<void>;

  /**
   * 获取当前工作区路径
   * @returns 工作区路径
   */
  getCurrentWorkspace(): string | null;
}

/**
 * 依赖注入服务接口 - 支持依赖注入
 */
export interface DependencyInjectable {
  /**
   * 注入依赖
   * @param dependencies 依赖对象
   */
  injectDependencies(dependencies: Record<string, unknown>): void;

  /**
   * 获取依赖
   * @param dependencyName 依赖名称
   * @returns 依赖对象
   */
  getDependency<T>(dependencyName: string): T | null;
}

/**
 * 服务状态枚举
 */
export enum ServiceStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  CONFIGURING = 'configuring',
  CONFIGURED = 'configured',
  ERROR = 'error',
  CLEANUP = 'cleanup'
}

/**
 * 服务状态信息
 */
export interface ServiceStatusInfo {
  status: ServiceStatus;
  message?: string;
  error?: Error;
  timestamp: Date;
}

/**
 * 状态感知服务接口
 */
export interface StatusAwareService {
  /**
   * 获取服务状态
   * @returns 服务状态信息
   */
  getStatus(): ServiceStatusInfo;

  /**
   * 添加状态变更监听器
   * @param listener 状态变更监听器
   */
  addStatusListener(listener: (status: ServiceStatusInfo) => void): void;

  /**
   * 移除状态变更监听器
   * @param listener 状态变更监听器
   */
  removeStatusListener(listener: (status: ServiceStatusInfo) => void): void;
}

/**
 * 完整的服务接口 - 组合所有服务接口
 */
export interface FullService extends 
  ReconfigurableService,
  WorkspaceAwareService,
  DependencyInjectable,
  StatusAwareService {
}

/**
 * 服务创建工厂函数类型
 */
export type ServiceFactory<T> = (config: Config) => T;

/**
 * 服务注册表项
 */
export interface ServiceRegistryEntry<T> {
  name: string;
  factory: ServiceFactory<T>;
  dependencies: string[];
  singleton: boolean;
  instance?: T;
}

/**
 * 服务注册表接口
 */
export interface ServiceRegistry {
  /**
   * 注册服务
   * @param entry 服务注册表项
   */
  register<T>(entry: ServiceRegistryEntry<T>): void;

  /**
   * 获取服务
   * @param name 服务名称
   * @returns 服务实例
   */
  get<T>(name: string): T;

  /**
   * 检查服务是否存在
   * @param name 服务名称
   * @returns 是否存在
   */
  has(name: string): boolean;

  /**
   * 清理所有服务
   */
  cleanup(): Promise<void>;
} 