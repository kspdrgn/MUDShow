import type { Component } from 'svelte';

export type ChannelTabId = string;

export type ChannelTab = {
  id: ChannelTabId;
  label: string;
  open: boolean;
};

export type ChannelTabVM = ChannelTab & {
  panelComponent?: Component;
  panelProps?: Record<string, unknown>;
};
