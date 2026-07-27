import type { HighlightDraft, RuleDraft, Trigger, TriggerOwner } from '../../types';
import { copyTextToClipboard, readTextFromClipboard } from '../../session-dom';
import { buildCopyPayload, normalizePastedTriggerPayload } from './trigger-paste';

export function buildTriggerCopyStatus(count: number): string {
  return count === 1 ? 'copied 1 trigger' : `copied ${count} triggers`;
}

export async function copySelectedTriggersAsJson(triggers: Trigger[]): Promise<string> {
  const payload = buildCopyPayload(triggers);
  if (payload.length === 0) {
    return 'nothing to copy';
  }

  try {
    await copyTextToClipboard(JSON.stringify(payload, null, 2));
    return buildTriggerCopyStatus(payload.length);
  } catch (error) {
    console.error('failed to copy triggers as JSON:', error);
    return 'copy failed';
  }
}

export async function pasteTriggersFromClipboard(options: {
  getOwner: () => TriggerOwner | null;
  onHighlightSave: (id: string | null, owner: TriggerOwner, draft: HighlightDraft) => void;
  onRuleSave: (id: string | null, owner: TriggerOwner, draft: RuleDraft) => void;
}): Promise<string> {
  const owner = options.getOwner();
  if (!owner) {
    return 'paste needs one target owner';
  }

  try {
    const parsed = JSON.parse(await readTextFromClipboard()) as unknown;
    const normalized = normalizePastedTriggerPayload(parsed);

    if (!normalized) {
      return 'paste failed: expected trigger JSON';
    }

    if (normalized.triggers.length === 0) {
      return normalized.skipped > 0 ? `paste skipped ${normalized.skipped} invalid` : 'paste found no triggers';
    }

    let added = 0;
    for (const trigger of normalized.triggers) {
      if (trigger.kind === 'highlight') {
        options.onHighlightSave(null, owner, trigger.draft);
      } else {
        options.onRuleSave(null, owner, trigger.draft);
      }
      added += 1;
    }

    return normalized.skipped > 0
      ? `pasted ${added}; skipped ${normalized.skipped} invalid`
      : `pasted ${added} ${added === 1 ? 'trigger' : 'triggers'}`;
  } catch (error) {
    console.error('failed to paste triggers from JSON:', error);
    return 'paste failed';
  }
}
