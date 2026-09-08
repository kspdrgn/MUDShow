import {
  applyHighlights,
  applyRulesWithResult,
  buildHighlightRegexes,
  buildRuleRegexes,
  renderTranscriptHtml,
} from '../../formatting';
import type { RenderCache, TranscriptChunkEntry, TranscriptHeightIndex } from '../../playback';
import type { HighlightRule, Rule, Trigger } from '../../types';

export interface RenderedTranscriptChunk {
  id: number;
  html: string;
  title: string;
}

export function buildTranscriptRenderDependencyKey(
  triggers: Trigger[],
  linkImagePreviews: boolean,
  imagePreviewCacheVersion: number,
  hiddenPreviewUrls: ReadonlySet<string>,
): string {
  const triggerKey = triggers
    .map((trigger) => {
      if (trigger.type === 'highlight') {
        return [
          'h',
          trigger.id,
          trigger.owner.kind,
          trigger.owner.kind === 'world'
            ? trigger.owner.worldId
            : trigger.owner.kind === 'character'
              ? trigger.owner.characterId
              : '',
          trigger.pattern,
          trigger.caseSensitive ? '1' : '0',
          trigger.wordBoundary ? '1' : '0',
          trigger.foregroundColor ?? '',
          trigger.backgroundColor ?? '',
        ].join(':');
      }

      return [
        'r',
        trigger.id,
        trigger.owner.kind,
        trigger.owner.kind === 'world'
          ? trigger.owner.worldId
          : trigger.owner.kind === 'character'
            ? trigger.owner.characterId
            : '',
        trigger.label,
        trigger.pattern,
        trigger.caseSensitive ? '1' : '0',
        trigger.wholeLine ? '1' : '0',
        trigger.stopOtherRules ? '1' : '0',
        trigger.stopHighlights ? '1' : '0',
        trigger.foregroundColor ?? '',
        trigger.backgroundColor ?? '',
        trigger.opacity ?? '',
        trigger.sampleText,
      ].join(':');
    })
    .join('|');

  const hiddenPreviewKey = [...hiddenPreviewUrls].sort().join('|');
  return [
    linkImagePreviews ? '1' : '0',
    String(imagePreviewCacheVersion),
    triggerKey,
    hiddenPreviewKey,
  ].join('|');
}

export function renderTranscriptChunkHtml(
  chunk: TranscriptChunkEntry,
  includePreviews: boolean,
  linkImagePreviews: boolean,
  hiddenPreviewUrls: ReadonlySet<string>,
  imagePreviewCacheVersion: number,
  ruleRegexes: ReturnType<typeof buildRuleRegexes>,
  highlightRegexes: ReturnType<typeof buildHighlightRegexes>,
): string {
  const ruleResult = applyRulesWithResult(
    renderTranscriptHtml(
      chunk.text,
      includePreviews ? linkImagePreviews : false,
      hiddenPreviewUrls,
      includePreviews ? imagePreviewCacheVersion : 0,
    ),
    ruleRegexes,
  );

  return ruleResult.stopHighlights ? ruleResult.html : applyHighlights(ruleResult.html, highlightRegexes);
}

export function buildTranscriptChunkTitle(chunk: TranscriptChunkEntry): string {
  const timestamp = new Date(chunk.timestamp).toLocaleString();
  const lineLabel = chunk.lineCount === 1 ? 'line' : 'lines';
  const charLabel = chunk.charCount === 1 ? 'char' : 'chars';
  const newlineLabel = chunk.text.endsWith('\n') ? 'ends with newline' : 'no trailing newline';

  return `Timestamp: ${timestamp}\nChunk #${chunk.id}\n${chunk.lineCount} ${lineLabel}\n${chunk.charCount} ${charLabel}\n${newlineLabel}`;
}

export function estimateTranscriptChunkHeight(
  chunk: TranscriptChunkEntry,
  width: string,
  includePreviews: boolean,
): number {
  const estimatedLineHeightPx = 20;
  const estimatedChunkPaddingPx = 6;
  const estimatedCharsPerLine = 84;
  const estimatedImagePreviewHeightPx = 180;
  const measuredWidth = width.endsWith('px') ? Number.parseFloat(width) : Number.NaN;
  const charsPerLine = Number.isFinite(measuredWidth) && measuredWidth > 0
    ? Math.max(24, Math.floor(measuredWidth / 8.25))
    : estimatedCharsPerLine;
  const wrappedLines = Math.max(chunk.lineCount, Math.ceil(chunk.charCount / charsPerLine));
  const previewMatches = includePreviews
    ? chunk.text.match(/https?:\/\/[^\s<>"']+/giu)?.filter((candidate) => /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:[?#].*)?$/iu.test(candidate)).length ?? 0
    : 0;

  return Math.max(
    estimatedLineHeightPx + estimatedChunkPaddingPx,
    wrappedLines * estimatedLineHeightPx + estimatedChunkPaddingPx + previewMatches * estimatedImagePreviewHeightPx,
  );
}

export function renderTranscriptChunk(
  chunk: TranscriptChunkEntry,
  includePreviews: boolean,
  renderDependencyKey: string,
  renderCache: RenderCache | null,
  linkImagePreviews: boolean,
  hiddenPreviewUrls: ReadonlySet<string>,
  imagePreviewCacheVersion: number,
  ruleRegexes: ReturnType<typeof buildRuleRegexes>,
  highlightRegexes: ReturnType<typeof buildHighlightRegexes>,
): string {
  const cacheKey = `${includePreviews ? 'live' : 'history'}:${renderDependencyKey}:${chunk.id}`;
  if (renderCache) {
    return renderCache.getOrSet(cacheKey, () =>
      renderTranscriptChunkHtml(
        chunk,
        includePreviews,
        linkImagePreviews,
        hiddenPreviewUrls,
        imagePreviewCacheVersion,
        ruleRegexes,
        highlightRegexes,
      ),
    );
  }

  return renderTranscriptChunkHtml(
    chunk,
    includePreviews,
    linkImagePreviews,
    hiddenPreviewUrls,
    imagePreviewCacheVersion,
    ruleRegexes,
    highlightRegexes,
  );
}

export function buildTranscriptVisibleRange(
  transcript: {
    getChunkCount(): number;
    getChunk(index: number): TranscriptChunkEntry | undefined;
  },
  startOffset: number,
  viewportHeight: number,
  overscanPx: number,
  includePreviews: boolean,
  anchorBottom: boolean,
  options: {
    width: string;
    renderDependencyKey: string;
    renderCache: RenderCache | null;
    linkImagePreviews: boolean;
    hiddenPreviewUrls: ReadonlySet<string>;
    imagePreviewCacheVersion: number;
    ruleRegexes: ReturnType<typeof buildRuleRegexes>;
    highlightRegexes: ReturnType<typeof buildHighlightRegexes>;
    heightIndex: TranscriptHeightIndex;
  },
): {
  startIndex: number;
  endIndex: number;
  topSpacer: number;
  bottomSpacer: number;
  rendered: RenderedTranscriptChunk[];
} {
  const count = transcript.getChunkCount();
  if (count === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      topSpacer: 0,
      bottomSpacer: 0,
      rendered: [],
    };
  }

  const heightIndex = options.heightIndex;
  const totalHeight = heightIndex.totalHeight;
  const range = heightIndex.getRange(
    startOffset,
    viewportHeight,
    overscanPx,
    anchorBottom,
  );

  let startIndex = range.startIndex;
  let endIndex = range.endIndex;
  const rendered: RenderedTranscriptChunk[] = [];

  for (let index = startIndex; index < endIndex; index += 1) {
    const chunk = transcript.getChunk(index);
    if (!chunk) continue;
    rendered.push({
      id: chunk.id,
      html: renderTranscriptChunk(
        chunk,
        includePreviews,
        options.renderDependencyKey,
        options.renderCache,
        options.linkImagePreviews,
        options.hiddenPreviewUrls,
        options.imagePreviewCacheVersion,
        options.ruleRegexes,
        options.highlightRegexes,
      ),
      title: buildTranscriptChunkTitle(chunk),
    });
  }

  return {
    startIndex,
    endIndex,
    topSpacer: range.topSpacer,
    bottomSpacer: range.bottomSpacer,
    rendered,
  };
}
