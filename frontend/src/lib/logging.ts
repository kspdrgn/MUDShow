import { stripTelnet } from './formatting';

const ANSI_SEQUENCE_RE = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;

function sanitizeSegment(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .trim()
    .replace(/^[.\s-]+|[.\s-]+$/g, '');
}

export function sanitizeLogFilename(value: string): string {
  const sanitized = sanitizeSegment(value);
  return sanitized.length > 0 ? sanitized : 'session-log.txt';
}

export function generateLogFilename(worldName: string, characterName: string, date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  const parts = [
    `${yyyy}-${mm}-${dd}`,
    sanitizeSegment(worldName),
    sanitizeSegment(characterName),
  ].filter((part) => part.length > 0);

  const name = parts.length > 0 ? parts.join('-') : 'session-log';
  return sanitizeLogFilename(`${name}.txt`);
}

export function getLogFileName(path: string | null): string {
  if (!path) {
    return '';
  }

  return path.split(/[\\/]/).pop() ?? '';
}

export function stripTranscriptForLog(text: string): string {
  return stripTelnet(text)
    .replace(ANSI_SEQUENCE_RE, '')
    .replace(/\r+\n/g, '\n')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

