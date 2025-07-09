/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateContentResponse, Part, FunctionCall } from '@google/genai';

export function getResponseText(
  response: GenerateContentResponse,
): string | undefined {
  console.log('=== getResponseText 函数开始 ===');
  console.log('输入响应对象:', JSON.stringify(response, null, 2));
  
  const parts = response.candidates?.[0]?.content?.parts;
  console.log('提取的 parts:', parts);
  
  if (!parts) {
    console.log('没有找到 parts，返回 undefined');
    return undefined;
  }
  
  console.log('parts 数组长度:', parts.length);
  console.log('parts 详情:', parts.map((part, index) => ({
    index,
    type: typeof part,
    hasText: !!part.text,
    text: part.text,
    hasFunctionCall: !!part.functionCall
  })));
  
  const textSegments = parts
    .map((part) => part.text)
    .filter((text): text is string => typeof text === 'string');

  console.log('过滤后的文本段:', textSegments);

  if (textSegments.length === 0) {
    console.log('没有找到文本段，返回 undefined');
    return undefined;
  }
  
  const result = textSegments.join('');
  console.log('最终合并的文本:', result);
  console.log('=== getResponseText 函数结束 ===');
  return result;
}

export function getResponseTextFromParts(parts: Part[]): string | undefined {
  if (!parts) {
    return undefined;
  }
  const textSegments = parts
    .map((part) => part.text)
    .filter((text): text is string => typeof text === 'string');

  if (textSegments.length === 0) {
    return undefined;
  }
  return textSegments.join('');
}

export function getFunctionCalls(
  response: GenerateContentResponse,
): FunctionCall[] | undefined {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    return undefined;
  }
  const functionCallParts = parts
    .filter((part) => !!part.functionCall)
    .map((part) => part.functionCall as FunctionCall);
  return functionCallParts.length > 0 ? functionCallParts : undefined;
}

export function getFunctionCallsFromParts(
  parts: Part[],
): FunctionCall[] | undefined {
  if (!parts) {
    return undefined;
  }
  const functionCallParts = parts
    .filter((part) => !!part.functionCall)
    .map((part) => part.functionCall as FunctionCall);
  return functionCallParts.length > 0 ? functionCallParts : undefined;
}

export function getFunctionCallsAsJson(
  response: GenerateContentResponse,
): string | undefined {
  const functionCalls = getFunctionCalls(response);
  if (!functionCalls) {
    return undefined;
  }
  return JSON.stringify(functionCalls, null, 2);
}

export function getFunctionCallsFromPartsAsJson(
  parts: Part[],
): string | undefined {
  const functionCalls = getFunctionCallsFromParts(parts);
  if (!functionCalls) {
    return undefined;
  }
  return JSON.stringify(functionCalls, null, 2);
}

export function getStructuredResponse(
  response: GenerateContentResponse,
): string | undefined {
  const textContent = getResponseText(response);
  const functionCallsJson = getFunctionCallsAsJson(response);

  if (textContent && functionCallsJson) {
    return `${textContent}\n${functionCallsJson}`;
  }
  if (textContent) {
    return textContent;
  }
  if (functionCallsJson) {
    return functionCallsJson;
  }
  return undefined;
}

export function getStructuredResponseFromParts(
  parts: Part[],
): string | undefined {
  const textContent = getResponseTextFromParts(parts);
  const functionCallsJson = getFunctionCallsFromPartsAsJson(parts);

  if (textContent && functionCallsJson) {
    return `${textContent}\n${functionCallsJson}`;
  }
  if (textContent) {
    return textContent;
  }
  if (functionCallsJson) {
    return functionCallsJson;
  }
  return undefined;
}
