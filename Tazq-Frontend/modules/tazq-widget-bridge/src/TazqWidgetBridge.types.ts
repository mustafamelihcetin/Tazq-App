export type WatchActionEvent = {
  type: 'habitCompleted' | string;
  data: Record<string, unknown>;
};

export type TazqWidgetBridgeEvents = {
  onWatchAction: (event: WatchActionEvent) => void;
};
