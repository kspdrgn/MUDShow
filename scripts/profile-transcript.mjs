import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDir = resolve(repoRoot, 'dist', 'regression-tests');
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'package.json'), '{"type":"commonjs"}\n', 'utf8');

const { PlayTranscript, TranscriptHeightIndex } = require(resolve(outputDir, 'playback.js'));
const { buildHighlightRegexes, buildRuleRegexes } = require(resolve(outputDir, 'formatting.js'));
const { buildTranscriptVisibleRange } = require(resolve(outputDir, 'components', 'play', 'transcript-render.js'));

const retainedChunks = 50_000;
const trafficChunks = 5_000;
const transcript = new PlayTranscript(retainedChunks);
const historyIndex = new TranscriptHeightIndex();

const appendStart = performance.now();
for (let id = 0; id < retainedChunks; id += 1) {
  transcript.append(`sustained traffic line ${id}\n`);
  historyIndex.append(id, 26);
}
const appendMs = performance.now() - appendStart;

const renderOptions = {
  width: '800px',
  renderDependencyKey: '',
  renderCache: null,
  linkImagePreviews: false,
  hiddenPreviewUrls: new Set(),
  imagePreviewCacheVersion: 0,
  ruleRegexes: buildRuleRegexes([]),
  highlightRegexes: buildHighlightRegexes([]),
  heightIndex: historyIndex,
};

let rangeReads = 0;
const rangeStart = performance.now();
for (let iteration = 0; iteration < trafficChunks; iteration += 1) {
  const id = retainedChunks + iteration;
  transcript.append(`sustained traffic line ${id}\n`);
  historyIndex.trimFront(1);
  historyIndex.append(id, 26);

  buildTranscriptVisibleRange(
    {
      getChunkCount: () => transcript.getChunkCount(),
      getChunk: (index) => {
        rangeReads += 1;
        return transcript.getChunk(index);
      },
    },
    ((iteration * 7919) % retainedChunks) * 26,
    520,
    520,
    false,
    false,
    renderOptions,
  );
}
const rangeMs = performance.now() - rangeStart;

console.log(JSON.stringify({
  retainedChunks,
  trafficChunks,
  initialAppendMs: Number(appendMs.toFixed(2)),
  sustainedRangeAndAppendMs: Number(rangeMs.toFixed(2)),
  averageIterationMs: Number((rangeMs / trafficChunks).toFixed(4)),
  averageRenderedChunkReads: Number((rangeReads / trafficChunks).toFixed(2)),
  finalChunkCount: transcript.getChunkCount(),
}, null, 2));
