import type { Report } from './types';
import { observeWebSocket, type InterceptSend, type InterceptReceive } from './websocket';
import { observeWorkers } from './worker';
import { observeFetch, type InterceptFetch } from './fetch';
import { observeXhr, type InterceptXhr } from './xhr';
import { observeMawBridge } from './mawBridge';
import { installVisibilityHook } from './visibility';
import { installFeedDeclutterHook } from './feedDeclutter';
import { installWebRtcShield } from './webrtc';
import { installTelemetryScrambler } from './telemetry';
import { installReadReplayBridge } from './replayBuffer';

type ObservableScope = Parameters<typeof observeWebSocket>[0] &
  Parameters<typeof observeWorkers>[0] &
  Parameters<typeof observeFetch>[0] &
  Parameters<typeof observeXhr>[0] &
  Parameters<typeof observeMawBridge>[0] &
  Parameters<typeof installWebRtcShield>[0] &
  Parameters<typeof installTelemetryScrambler>[0];

export interface ObserverOptions {
  readonly frameUrl?: string;
  readonly interceptSocket?: InterceptSend;
  readonly interceptReceiveSocket?: InterceptReceive;
  readonly interceptFetch?: InterceptFetch;
  readonly interceptXhr?: InterceptXhr;
  readonly interceptWorker?: (data: unknown) => 'pass' | 'drop';
  readonly isTypingSuppressed?: () => boolean;
  readonly isReadSuppressed?: () => boolean;
  readonly isFeedAutoRefreshBlocked?: () => boolean;
  readonly isFeedDeclutterActive?: () => boolean;
  readonly isSponsoredActive?: () => boolean;
  readonly isSuggestedActive?: () => boolean;
  readonly isReelsActive?: () => boolean;
  readonly isWebRtcProtected?: () => boolean;
  readonly isDwellTimeScrambled?: () => boolean;
}

export function installObservers(
  scope: ObservableScope,
  report: Report,
  options: ObserverOptions = {},
): () => void {
  const { frameUrl } = options;

  const undoSocket = observeWebSocket(
    scope,
    report,
    frameUrl,
    options.interceptSocket,
    options.interceptReceiveSocket,
  );
  const undoWorkers = observeWorkers(
    scope,
    report,
    frameUrl,
    options.interceptWorker,
  );

  const undoFetch = observeFetch(scope, report, frameUrl, options.interceptFetch);
  const undoXhr = observeXhr(scope, report, frameUrl, options.interceptXhr);

  let undoMaw = () => {};
  if (options.isTypingSuppressed) {
    undoMaw = observeMawBridge(scope, options.isTypingSuppressed, options.isReadSuppressed);
  }

  let undoVisibility = () => {};
  if (options.isFeedAutoRefreshBlocked) {
    const candidateWin = scope as unknown as Window;
    if (candidateWin && typeof candidateWin.document !== 'undefined') {
      undoVisibility = installVisibilityHook(candidateWin, options.isFeedAutoRefreshBlocked);
    }
  }

  let undoDeclutter = () => {};
  if (
    options.isSponsoredActive ||
    options.isSuggestedActive ||
    options.isReelsActive ||
    options.isFeedDeclutterActive
  ) {
    const candidateWin = scope as unknown as Window;
    if (candidateWin && typeof candidateWin.document !== 'undefined') {
      undoDeclutter = installFeedDeclutterHook(candidateWin, {
        isSponsoredActive: options.isSponsoredActive,
        isSuggestedActive: options.isSuggestedActive,
        isReelsActive: options.isReelsActive,
        isFeedDeclutterActive: options.isFeedDeclutterActive,
      });
    }
  }

  let undoWebRtc = () => {};
  if (options.isWebRtcProtected) {
    undoWebRtc = installWebRtcShield(scope, options.isWebRtcProtected);
  }

  let undoTelemetry = () => {};
  if (options.isDwellTimeScrambled) {
    undoTelemetry = installTelemetryScrambler(scope, options.isDwellTimeScrambled);
  }

  let undoReplay = () => {};
  const candidateWin = scope as unknown as Window;
  if (candidateWin && typeof candidateWin.addEventListener === 'function') {
    undoReplay = installReadReplayBridge(candidateWin);
  }

  return () => {
    undoReplay();
    undoTelemetry();
    undoWebRtc();
    undoDeclutter();
    undoVisibility();
    undoMaw();
    undoXhr();
    undoFetch();
    undoWorkers();
    undoSocket();
  };
}
