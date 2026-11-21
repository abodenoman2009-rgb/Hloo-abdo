import type { CallType, IceServerEntry } from '../types/app';
import { buildIceConfiguration } from './callLogic';

export interface MediaDevicesSnapshot {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
}

export class RingtoneSynthesizer {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;

  start(mode: 'incoming' | 'outgoing'): void {
    this.stop();
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      const playBurst = () => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const freqs = mode === 'incoming' ? [523.25, 659.25] : [440, 480];
        freqs.forEach((f, idx) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);
          const start = mode === 'incoming' ? now + idx * 0.14 : now;
          const dur = mode === 'incoming' ? 0.22 : 0.45;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.055, start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(start);
          osc.stop(start + dur + 0.02);
        });
      };
      playBurst();
      this.timer = window.setInterval(playBurst, mode === 'incoming' ? 2200 : 3000);
    } catch {
      // Browser autoplay policy may block audio before user gesture
    }
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export async function listAvailableMediaDevices(): Promise<MediaDevicesSnapshot> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { cameras: [], microphones: [] };
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  return {
    cameras: all.filter((d) => d.kind === 'videoinput'),
    microphones: all.filter((d) => d.kind === 'audioinput'),
  };
}

export async function acquireUserMedia(options: {
  callType: CallType;
  facingMode?: 'user' | 'environment';
  cameraDeviceId?: string;
  micDeviceId?: string;
}): Promise<{ stream: MediaStream | null; error: string | null }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { stream: null, error: 'WebRTC media devices are not supported in this browser.' };
  }

  const audioConstraint: MediaTrackConstraints | boolean = options.micDeviceId
    ? { deviceId: { exact: options.micDeviceId }, echoCancellation: true, noiseSuppression: true }
    : { echoCancellation: true, noiseSuppression: true };

  const videoConstraint: MediaTrackConstraints | boolean =
    options.callType === 'video'
      ? options.cameraDeviceId
        ? { deviceId: { exact: options.cameraDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: options.facingMode || 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      : false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraint,
      video: videoConstraint,
    });
    return { stream, error: null };
  } catch (err) {
    if (options.callType === 'video') {
      // Fallback to audio-only if camera hardware is missing or denied
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint, video: false });
        return {
          stream: audioOnly,
          error: err instanceof Error ? err.message : 'Camera unavailable; using audio only.',
        };
      } catch (audioErr) {
        return {
          stream: null,
          error: audioErr instanceof Error ? audioErr.message : 'Microphone permission denied.',
        };
      }
    }
    return {
      stream: null,
      error: err instanceof Error ? err.message : 'Microphone permission denied.',
    };
  }
}

export interface PeerConnectionCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
  onQualitySample: (quality: 'excellent' | 'good' | 'fair' | 'poor') => void;
}

export class PeerCallController {
  private pc: RTCPeerConnection | null = null;
  private statsTimer: number | null = null;
  private callbacks: PeerConnectionCallbacks;
  private iceServers: IceServerEntry[];

  constructor(iceServers: IceServerEntry[], callbacks: PeerConnectionCallbacks) {
    this.iceServers = iceServers;
    this.callbacks = callbacks;
  }

  init(localStream: MediaStream | null): RTCPeerConnection {
    this.close();
    const config = buildIceConfiguration(this.iceServers);
    const pc = new RTCPeerConnection(config);
    this.pc = pc;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      if (event.streams.length === 0 && event.track) {
        remoteStream.addTrack(event.track);
      }
      this.callbacks.onRemoteStream(remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      this.callbacks.onStateChange(pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {
          // Ignore if connection is already closed
        }
      }
    };

    this.statsTimer = window.setInterval(async () => {
      if (!this.pc || this.pc.connectionState !== 'connected') return;
      try {
        const stats = await this.pc.getStats();
        let rttMs = 0;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && typeof report.currentRoundTripTime === 'number') {
            rttMs = report.currentRoundTripTime * 1000;
          }
        });
        if (rttMs === 0 || rttMs < 80) this.callbacks.onQualitySample('excellent');
        else if (rttMs < 180) this.callbacks.onQualitySample('good');
        else if (rttMs < 350) this.callbacks.onQualitySample('fair');
        else this.callbacks.onQualitySample('poor');
      } catch {
        // Ignore transient stats error
      }
    }, 3000);

    return pc;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async acceptOfferAndCreateAnswer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.pc) return null;
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async applyAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    if (this.pc.signalingState !== 'stable') {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore candidates arriving before remote description
    }
  }

  replaceVideoTrack(newTrack: MediaStreamTrack): void {
    if (!this.pc) return;
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) {
      sender.replaceTrack(newTrack).catch(() => {});
    }
  }

  close(): void {
    if (this.statsTimer !== null) {
      window.clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
  }
}

export function createMicVolumeMonitor(
  stream: MediaStream,
  onLevel: (level: number) => void
): () => void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx || stream.getAudioTracks().length === 0) return () => {};
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const interval = window.setInterval(() => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i];
      const avg = sum / (data.length * 255);
      onLevel(Math.min(1, avg * 2.4));
    }, 120);
    return () => {
      window.clearInterval(interval);
      ctx.close().catch(() => {});
    };
  } catch {
    return () => {};
  }
}
