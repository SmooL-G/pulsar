// Public STUN servers — free, anonymous, used only for NAT discovery.
// We do NOT ship a TURN server in Phase 1; if symmetric NAT prevents
// direct connection, the transport falls back to the existing socket.io
// path (see MessageTransport).
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
