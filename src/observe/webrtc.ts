/**
 * WebRTC IP Leak Shield.
 *
 * Enforces 'relay' only ICE transport policy to prevent real local (LAN)
 * and public IP leaks during Messenger audio/video call signaling on /ws/rpsignaling.
 */

export interface WebRtcScope {
  RTCPeerConnection?: typeof RTCPeerConnection;
}

const INSTALLED = new WeakSet<object>();

export function installWebRtcShield(
  scope: WebRtcScope,
  isShieldActive: () => boolean,
): () => void {
  const OriginalPC = scope.RTCPeerConnection;
  if (typeof OriginalPC !== 'function' || INSTALLED.has(scope)) {
    return () => {};
  }
  INSTALLED.add(scope);

  const originalSetConfig = OriginalPC.prototype.setConfiguration;

  function sanitizeConfig(config?: RTCConfiguration): RTCConfiguration | undefined {
    if (!config) {
      return isShieldActive() ? { iceTransportPolicy: 'relay', iceCandidatePoolSize: 0 } : config;
    }
    if (!isShieldActive()) {
      return config;
    }
    return {
      ...config,
      iceTransportPolicy: 'relay',
      iceCandidatePoolSize: 0,
    };
  }

  function isRelayCandidate(candidate: unknown): boolean {
    if (!isShieldActive()) {
      return true;
    }
    if (!candidate) {
      return true; // null marks end-of-candidates in WebRTC standard
    }
    const candStr =
      typeof candidate === 'string'
        ? candidate
        : (candidate as RTCIceCandidateInit).candidate;
    if (typeof candStr !== 'string') {
      return true;
    }
    // Only allow TURN relay candidates
    return candStr.includes('typ relay');
  }

  const PatchedPC = function (
    this: RTCPeerConnection,
    config?: RTCConfiguration,
  ) {
    const pc = new OriginalPC(sanitizeConfig(config));

    // Hook addIceCandidate on this instance
    const origAddCandidate = pc.addIceCandidate;
    pc.addIceCandidate = function (
      this: RTCPeerConnection,
      candidate?: RTCIceCandidateInit | RTCIceCandidate,
    ) {
      if (candidate && !isRelayCandidate(candidate)) {
        // Drop non-relay candidate to prevent IP resolution
        return Promise.resolve();
      }
      return Reflect.apply(origAddCandidate, this, [candidate]) as Promise<void>;
    } as typeof origAddCandidate;

    return pc;
  } as unknown as typeof RTCPeerConnection;

  PatchedPC.prototype = OriginalPC.prototype;
  try {
    Object.setPrototypeOf(PatchedPC, OriginalPC);
  } catch {
    // Ignore if prototype cannot be set
  }

  // Also patch setConfiguration on prototype
  if (originalSetConfig) {
    OriginalPC.prototype.setConfiguration = function (this: RTCPeerConnection, config?: RTCConfiguration) {
      return originalSetConfig.call(this, sanitizeConfig(config));
    };
  }

  scope.RTCPeerConnection = PatchedPC;

  return () => {
    if (originalSetConfig) {
      OriginalPC.prototype.setConfiguration = originalSetConfig;
    }
    scope.RTCPeerConnection = OriginalPC;
    INSTALLED.delete(scope);
  };
}
