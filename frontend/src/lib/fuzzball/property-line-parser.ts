import type { FuzzBallPropertyNodeInput, FuzzBallPropertyNodeType } from './storage-cache';

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
  const path = rawPath.trim();

  if (!path) {
    return null;
  }

  if (type === 'dir') {
    return {
      path,
      type,
      value: null,
    };
  }

  return {
    path,
    type,
    value: rawValue,
  };
}
