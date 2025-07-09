/**
 * 标准化的流式事件类型定义
 * 供前后端共同使用，确保数据格式一致性
 */

// 基础事件接口
export interface StreamingEvent {
  type: EventType;
  data: EventData;
  timestamp: string;
}

// 事件类型枚举
export type EventType = 
  | 'content' 
  | 'thought' 
  | 'tool_call' 
  | 'tool_execution' 
  | 'tool_result' 
  | 'tool_confirmation' 
  | 'complete' 
  | 'error';

// 事件数据联合类型
export type EventData = 
  | ContentEventData
  | ThoughtEventData
  | ToolCallEventData
  | ToolExecutionEventData
  | ToolResultEventData
  | ToolConfirmationEventData
  | CompleteEventData
  | ErrorEventData;

// 1. 内容事件数据
export interface ContentEventData {
  text: string;
  isPartial: boolean;
}

// 2. 思考事件数据
export interface ThoughtEventData {
  subject: string;
  description: string;
}

// 3. 工具调用事件数据
export interface ToolCallEventData {
  callId: string;
  name: string;
  displayName: string;
  description: string;
  args: Record<string, any>;
  requiresConfirmation: boolean;
}

// 4. 工具执行事件数据
export interface ToolExecutionEventData {
  callId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  message: string;
}

// 5. 工具结果事件数据
export interface ToolResultEventData {
  callId: string;
  name: string;
  result: string;
  displayResult: string;
  success: boolean;
  error?: string;
}

// 6. 工具确认事件数据
export interface ToolConfirmationEventData {
  callId: string;
  name: string;
  displayName: string;
  description: string;
  prompt: string;
  command?: string;
}

// 7. 完成事件数据
export interface CompleteEventData {
  success: boolean;
  message?: string;
}

// 8. 错误事件数据
export interface ErrorEventData {
  message: string;
  code?: string;
  details?: string;
}

// 事件工厂函数
export class StreamingEventFactory {
  static createContentEvent(text: string, isPartial: boolean = true): StreamingEvent {
    return {
      type: 'content',
      data: { text, isPartial },
      timestamp: new Date().toISOString()
    };
  }

  static createThoughtEvent(subject: string, description: string): StreamingEvent {
    return {
      type: 'thought',
      data: { subject, description },
      timestamp: new Date().toISOString()
    };
  }

  static createToolCallEvent(
    callId: string,
    name: string,
    displayName: string,
    description: string,
    args: Record<string, any>,
    requiresConfirmation: boolean = true
  ): StreamingEvent {
    return {
      type: 'tool_call',
      data: { callId, name, displayName, description, args, requiresConfirmation },
      timestamp: new Date().toISOString()
    };
  }

  static createToolExecutionEvent(
    callId: string,
    status: ToolExecutionEventData['status'],
    message: string
  ): StreamingEvent {
    return {
      type: 'tool_execution',
      data: { callId, status, message },
      timestamp: new Date().toISOString()
    };
  }

  static createToolResultEvent(
    callId: string,
    name: string,
    result: string,
    displayResult: string,
    success: boolean,
    error?: string
  ): StreamingEvent {
    return {
      type: 'tool_result',
      data: { callId, name, result, displayResult, success, error },
      timestamp: new Date().toISOString()
    };
  }

  static createToolConfirmationEvent(
    callId: string,
    name: string,
    displayName: string,
    description: string,
    prompt: string,
    command?: string
  ): StreamingEvent {
    return {
      type: 'tool_confirmation',
      data: { callId, name, displayName, description, prompt, command },
      timestamp: new Date().toISOString()
    };
  }

  static createCompleteEvent(success: boolean, message?: string): StreamingEvent {
    return {
      type: 'complete',
      data: { success, message },
      timestamp: new Date().toISOString()
    };
  }

  static createErrorEvent(message: string, code?: string, details?: string): StreamingEvent {
    return {
      type: 'error',
      data: { message, code, details },
      timestamp: new Date().toISOString()
    };
  }
}

// 事件验证函数
export function isValidStreamingEvent(event: any): event is StreamingEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    typeof event.type === 'string' &&
    typeof event.data === 'object' &&
    typeof event.timestamp === 'string'
  );
}

// 事件类型守卫函数
export function isContentEvent(event: StreamingEvent): event is StreamingEvent & { data: ContentEventData } {
  return event.type === 'content';
}

export function isThoughtEvent(event: StreamingEvent): event is StreamingEvent & { data: ThoughtEventData } {
  return event.type === 'thought';
}

export function isToolCallEvent(event: StreamingEvent): event is StreamingEvent & { data: ToolCallEventData } {
  return event.type === 'tool_call';
}

export function isToolExecutionEvent(event: StreamingEvent): event is StreamingEvent & { data: ToolExecutionEventData } {
  return event.type === 'tool_execution';
}

export function isToolResultEvent(event: StreamingEvent): event is StreamingEvent & { data: ToolResultEventData } {
  return event.type === 'tool_result';
}

export function isToolConfirmationEvent(event: StreamingEvent): event is StreamingEvent & { data: ToolConfirmationEventData } {
  return event.type === 'tool_confirmation';
}

export function isCompleteEvent(event: StreamingEvent): event is StreamingEvent & { data: CompleteEventData } {
  return event.type === 'complete';
}

export function isErrorEvent(event: StreamingEvent): event is StreamingEvent & { data: ErrorEventData } {
  return event.type === 'error';
} 