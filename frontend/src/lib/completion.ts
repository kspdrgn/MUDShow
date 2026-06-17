export class CompletionManager {
  private wordList = new Map<string, string>();
  private tabMatches: string[] = [];
  private tabIndex = -1;
  private tabPrefix = '';

  harvest(text: string): void {
    const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
    const words = clean.match(/[a-zA-Z']{3,}/g);

    if (!words) {
      return;
    }

    for (const word of words) {
      const key = word.toLowerCase();

      if (this.wordList.has(key)) {
        this.wordList.delete(key);
      }

      this.wordList.set(key, word);

      if (this.wordList.size > 2000) {
        const oldest = this.wordList.keys().next().value as string | undefined;
        if (oldest) {
          this.wordList.delete(oldest);
        }
      }
    }
  }

  resetCycle(): void {
    this.tabMatches = [];
    this.tabIndex = -1;
    this.tabPrefix = '';
  }

  complete(value: string, selectionStart: number): { value: string; cursor: number } | null {
    const before = value.slice(0, selectionStart);
    const match = before.match(/(\S+)$/);

    if (!match) {
      return null;
    }

    const prefix = match[1].toLowerCase();

    if (prefix !== this.tabPrefix || this.tabMatches.length === 0) {
      this.tabPrefix = prefix;
      this.tabMatches = [...this.wordList.entries()]
        .filter(([key]) => key.startsWith(prefix) && key !== prefix)
        .map(([, candidate]) => candidate)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      this.tabIndex = -1;
    }

    if (this.tabMatches.length === 0) {
      return null;
    }

    this.tabIndex = (this.tabIndex + 1) % this.tabMatches.length;
    const completion = this.tabMatches[this.tabIndex];
    const newValue =
      before.slice(0, before.length - prefix.length) + completion + value.slice(selectionStart);

    return {
      value: newValue,
      cursor: selectionStart - prefix.length + completion.length,
    };
  }
}
