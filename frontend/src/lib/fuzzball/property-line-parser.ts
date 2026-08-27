import type { FuzzBallPropertyNodeInput, FuzzBallPropertyNodeType } from './storage-cache.js';

const SUMMARY_LINE_PATTERN = /^\d+\s+properties?\s+listed\.$/i;
const PROPERTY_LINE_PATTERN = /^(dir|str|int)\s+([^:]+?)(?::(.*))?$/i;

export function parseFuzzballPropertyLine(text: string): FuzzBallPropertyNodeInput | null {
  const line = text.replace(/\r?\n$/u, '');

  if (!line || SUMMARY_LINE_PATTERN.test(line)) {
    return null;
  }

  const match = line.match(PROPERTY_LINE_PATTERN);
  if (!match) {
    return null;
  }

  const [, rawType, rawPath, rawValue = ''] = match;
  const type = rawType.toLowerCase() as FuzzBallPropertyNodeType;
  const trimmedPath = rawPath.trim();
  const hasChildren = trimmedPath.endsWith('/');
  const path = hasChildren
    ? trimmedPath.replace(/\/+$/u, '')
    : trimmedPath;

  if (!path) {
    return null;
  }

  if (type === 'dir') {
    return {
      path,
      type,
      value: null,
      hasChildren,
    };
  }

  return {
    path,
    type,
    value: rawValue,
    hasChildren,
  };
}
