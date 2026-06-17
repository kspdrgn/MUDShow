import type { HighlightRule } from './types';

type HighlightRegex = {
  re: RegExp;
  color: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function stripTelnet(text: string): string {
  return text.replace(/\xff[\xfb-\xfe]./gs, '').replace(/\xff\xf0/gs, '');
}

export function ansiToHtml(text: string): string {
  text = escapeHtml(text);

  let result = '';
  let openSpan = false;
  const parts = text.split(/(\x1b\[[0-9;]*m)/);

  for (const part of parts) {
    if (part.startsWith('\x1b[')) {
      const codes = part
        .slice(2, -1)
        .split(';')
        .map(Number);
      const hasReset = codes.includes(0);

      if (hasReset && openSpan) {
        result += '</span>';
        openSpan = false;
      }

      const classes = codes.filter((code) => code !== 0).map((code) => `ansi-${code}`);

      if (classes.length > 0) {
        if (openSpan) {
          result += '</span>';
        }

        result += `<span class="${classes.join(' ')}">`;
        openSpan = true;
      }
    } else {
      result += part.replace(/\n/g, '<br>').replace(/ {2,}/g, (match) => '&nbsp;'.repeat(match.length));
    }
  }

  if (openSpan) {
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
