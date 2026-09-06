import { describe, expect, it, vi } from 'vitest';
import { installWebRtcShield } from '@/observe/webrtc';

describe('WebRTC IP leak shield', () => {
  it('enforces iceTransportPolicy relay when shield is active', () => {
    let capturedConfig: RTCConfiguration | undefined;

    class FakePC {
      config?: RTCConfiguration;
      addIceCandidate = vi.fn().mockResolvedValue(undefined);
      constructor(config?: RTCConfiguration) {
        this.config = config;
        capturedConfig = config;
      }
    }

    const scope = {
      RTCPeerConnection: FakePC as unknown as typeof RTCPeerConnection,
    };

    const active = true;
    const undo = installWebRtcShield(scope, () => active);

    // Instantiate patched RTCPeerConnection
    new scope.RTCPeerConnection({ iceCandidatePoolSize: 5 });

    expect(capturedConfig?.iceTransportPolicy).toBe('relay');
    expect(capturedConfig?.iceCandidatePoolSize).toBe(0);

    undo();
    expect(scope.RTCPeerConnection).toBe(FakePC);
  });

  it('drops non-relay ice candidates to prevent host/srflx IP leak', async () => {
    const origAddCandidate = vi.fn().mockResolvedValue(undefined);

    class FakePC {
      addIceCandidate = origAddCandidate;
    }

    const scope = {
      RTCPeerConnection: FakePC as unknown as typeof RTCPeerConnection,
    };

    const undo = installWebRtcShield(scope, () => true);

    const pc = new scope.RTCPeerConnection();

    // Candidate with host IP
    await pc.addIceCandidate({ candidate: 'candidate:1 1 UDP 2130706431 192.168.1.50 54321 typ host' } as RTCIceCandidateInit);
    expect(origAddCandidate).not.toHaveBeenCalled();

    // Candidate with srflx IP
    await pc.addIceCandidate({ candidate: 'candidate:2 1 UDP 1694498815 203.0.113.195 54321 typ srflx' } as RTCIceCandidateInit);
    expect(origAddCandidate).not.toHaveBeenCalled();

    // TURN relay candidate
    await pc.addIceCandidate({ candidate: 'candidate:3 1 UDP 33562367 157.240.1.1 54321 typ relay' } as RTCIceCandidateInit);
    expect(origAddCandidate).toHaveBeenCalledTimes(1);

    undo();
  });
});
