import type { HighlightRule } from './types';

export type HighlightRegex = {
  re: RegExp;
  color: string;
};

type AnsiStyle = {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
  inverse?: boolean;
};

const ANSI_SEQUENCE_RE = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;
const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

const ANSI_PALETTE = [
  '#000000',
  '#cd0000',
  '#00cd00',
  '#cdcd00',
  '#0000ee',
  '#cd00cd',
  '#00cdcd',
  '#e5e5e5',
  '#7f7f7f',
  '#ff0000',
  '#00ff00',
  '#ffff00',
  '#5c5cff',
  '#ff00ff',
  '#00ffff',
  '#ffffff',
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

export function stripTelnet(text: string): string {
  return text.replace(/\xff[\xfb-\xfe]./gs, '').replace(/\xff\xf0/gs, '');
}

function escapeAndPreserveLayout(text: string): string {
  const sanitized = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

  return escapeHtml(sanitized)
    .replace(/\n/g, '<br>')
    .replace(/ {2,}/g, (match) => '&nbsp;'.repeat(match.length));
}

function splitTrailingPunctuation(url: string): { url: string; trailing: string } {
  const trailingChars = new Set(['.', ',', '!', '?', ':', ';', '"', '\'', ')', ']', '}']);
  let end = url.length;

  while (end > 0) {
    const character = url[end - 1];
    if (!trailingChars.has(character)) {
      break;
    }

    if (character === ')') {
      const openCount = (url.slice(0, end - 1).match(/\(/g) ?? []).length;
      const closeCount = (url.slice(0, end - 1).match(/\)/g) ?? []).length;
      if (closeCount < openCount) {
        break;
      }
    }

    if (character === ']') {
      const openCount = (url.slice(0, end - 1).match(/\[/g) ?? []).length;
      const closeCount = (url.slice(0, end - 1).match(/\]/g) ?? []).length;
      if (closeCount < openCount) {
        break;
      }
    }

    if (character === '}') {
      const openCount = (url.slice(0, end - 1).match(/\{/g) ?? []).length;
      const closeCount = (url.slice(0, end - 1).match(/\}/g) ?? []).length;
      if (closeCount < openCount) {
        break;
      }
    }

    end -= 1;
  }

  return {
    url: url.slice(0, end),
    trailing: url.slice(end),
  };
}

function normalizeExternalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // Fall through to the raw URL below.
  }

  return url;
}

function renderLinkedText(text: string): string {
  let result = '';
  let lastIndex = 0;

  for (const match of text.matchAll(URL_RE)) {
    const index = match.index ?? lastIndex;
    const rawUrl = match[0];
    const { url, trailing } = splitTrailingPunctuation(rawUrl);

    result += escapeAndPreserveLayout(text.slice(lastIndex, index));

    if (url) {
      const href = escapeHtmlAttribute(normalizeExternalUrl(url));
      result += `<a class="output-link" href="${href}" tabindex="-1" rel="noopener noreferrer">${escapeAndPreserveLayout(url)}</a>`;
    }

    if (trailing) {
      result += escapeAndPreserveLayout(trailing);
    }

    lastIndex = index + rawUrl.length;
  }

  result += escapeAndPreserveLayout(text.slice(lastIndex));
  return result;
}

function ansi256ToCssColor(code: number): string | null {
  if (!Number.isInteger(code) || code < 0 || code > 255) {
    return null;
  }

  if (code < 16) {
    return ANSI_PALETTE[code] ?? null;
  }

  if (code < 232) {
    const value = code - 16;
    const red = Math.floor(value / 36);
    const green = Math.floor((value % 36) / 6);
    const blue = value % 6;
    const steps = [0, 95, 135, 175, 215, 255];
    return `rgb(${steps[red]} ${steps[green]} ${steps[blue]})`;
  }

  const gray = 8 + (code - 232) * 10;
  return `rgb(${gray} ${gray} ${gray})`;
}

function standardAnsiColor(code: number): string | null {
  if (code >= 30 && code <= 37) {
    return ANSI_PALETTE[code - 30] ?? null;
  }

  if (code >= 90 && code <= 97) {
    return ANSI_PALETTE[code - 90 + 8] ?? null;
  }

  if (code >= 40 && code <= 47) {
    return ANSI_PALETTE[code - 40] ?? null;
  }

  if (code >= 100 && code <= 107) {
    return ANSI_PALETTE[code - 100 + 8] ?? null;
  }

  return null;
}

function parseAnsiStyleCodes(codes: number[], initial: AnsiStyle): AnsiStyle {
  let next: AnsiStyle = { ...initial };

  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i];

    switch (code) {
      case 0:
        next = {};
        break;
      case 1:
        next.bold = true;
        next.dim = false;
        break;
      case 2:
        next.dim = true;
        next.bold = false;
        break;
      case 4:
        next.underline = true;
        break;
      case 7:
        next.inverse = true;
        break;
      case 22:
        next.bold = false;
        next.dim = false;
        break;
      case 24:
        next.underline = false;
        break;
      case 27:
        next.inverse = false;
        break;
      case 39:
        delete next.fg;
        break;
      case 49:
        delete next.bg;
        break;
      case 38: {
        const mode = codes[i + 1];
        if (mode === 5) {
          const color = ansi256ToCssColor(codes[i + 2]);
          if (color) {
            next.fg = color;
          }
          i += 2;
        } else if (mode === 2) {
          const red = codes[i + 2];
          const green = codes[i + 3];
          const blue = codes[i + 4];
          if (
            Number.isInteger(red) &&
            Number.isInteger(green) &&
            Number.isInteger(blue) &&
            red >= 0 &&
            red <= 255 &&
            green >= 0 &&
            green <= 255 &&
            blue >= 0 &&
            blue <= 255
          ) {
            next.fg = `rgb(${red} ${green} ${blue})`;
          }
          i += 4;
        }
        break;
      }
      case 48: {
        const mode = codes[i + 1];
        if (mode === 5) {
          const color = ansi256ToCssColor(codes[i + 2]);
          if (color) {
            next.bg = color;
          }
          i += 2;
        } else if (mode === 2) {
          const red = codes[i + 2];
          const green = codes[i + 3];
          const blue = codes[i + 4];
          if (
            Number.isInteger(red) &&
            Number.isInteger(green) &&
            Number.isInteger(blue) &&
            red >= 0 &&
            red <= 255 &&
            green >= 0 &&
            green <= 255 &&
            blue >= 0 &&
            blue <= 255
          ) {
            next.bg = `rgb(${red} ${green} ${blue})`;
          }
          i += 4;
        }
        break;
      }
      default: {
        const color = standardAnsiColor(code);
        if (color) {
          if ((code >= 40 && code <= 49) || (code >= 100 && code <= 107)) {
            next.bg = color;
          } else {
            next.fg = color;
          }
        }
        break;
      }
    }
  }

  return next;
}

function styleToCss(style: AnsiStyle): string | null {
  const styles: string[] = [];
  const fg = style.inverse ? style.bg : style.fg;
  const bg = style.inverse ? style.fg : style.bg;

  if (fg) {
    styles.push(`color:${fg}`);
  }

  if (bg) {
    styles.push(`background-color:${bg}`);
  }

  if (style.bold) {
    styles.push('font-weight:700');
  }

  if (style.dim) {
    styles.push('opacity:0.75');
  }

  if (style.underline) {
    styles.push('text-decoration:underline');
  }

  return styles.length > 0 ? styles.join(';') : null;
}

export function ansiToHtml(text: string): string {
  let result = '';
  let openStyle: string | null = null;
  let currentStyle: AnsiStyle = {};
  let lastIndex = 0;

  const flushText = (chunk: string) => {
    if (!chunk) {
      return;
    }

    const style = styleToCss(currentStyle);

    if (style !== openStyle) {
      if (openStyle) {
        result += '</span>';
      }

      openStyle = style;
      if (openStyle) {
        result += `<span style="${openStyle}">`;
      }
    }

    result += renderLinkedText(chunk);
  };

  for (const match of text.matchAll(ANSI_SEQUENCE_RE)) {
    const index = match.index ?? lastIndex;
    flushText(text.slice(lastIndex, index));

    const sequence = match[0];
    if (sequence.endsWith('m')) {
      const codes = sequence
        .slice(2, -1)
        .split(';')
        .map((part) => Number(part));
      currentStyle = parseAnsiStyleCodes(codes, currentStyle);
    }

    lastIndex = index + sequence.length;
  }

  flushText(text.slice(lastIndex));

  if (openStyle) {
    result += '</span>';
  }

  return result;
}

export function buildHighlightRegexes(rules: HighlightRule[]): HighlightRegex[] {
  return rules.map((rule) => ({
    re: new RegExp(rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
    color: rule.color,
  }));
}

export function applyHighlights(html: string, regexes: HighlightRegex[]): string {
  if (regexes.length === 0) {
    return html;
  }

  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        return part;
      }

      for (const { re, color } of regexes) {
        re.lastIndex = 0;
        part = part.replace(re, (match) => `<span style="color:${color}">${match}</span>`);
      }

      return part;
    })
    .join('');
}
