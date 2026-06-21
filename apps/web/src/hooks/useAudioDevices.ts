import { useEffect, useState } from 'react';

/**
 * Enumerate audio I/O devices (mic + speaker/headset) and react to
 * device changes (Bluetooth headset plugged in mid-call, USB mic
 * connected, etc.).
 *
 * Returns empty arrays until the page has been granted mic permission
 * — without permission, browsers return blank labels (and on some
 * platforms an empty list entirely). The CallOverlay calls
 * getUserMedia before mounting this list, so by the time the device
 * panel opens, labels are populated.
 *
 * Output device enumeration (`audiooutput`) is not available in
 * Firefox or iOS Safari — those return only the default sink.
 * Component should gracefully render only what's listed.
 */

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

export function useAudioDevices() {
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const ins: AudioDevice[] = [];
        const outs: AudioDevice[] = [];
        for (const d of devices) {
          if (d.kind === 'audioinput') {
            ins.push({
              deviceId: d.deviceId,
              label: d.label || `Микрофон ${ins.length + 1}`,
              kind: 'audioinput',
            });
          } else if (d.kind === 'audiooutput') {
            outs.push({
              deviceId: d.deviceId,
              label: d.label || `Динамик ${outs.length + 1}`,
              kind: 'audiooutput',
            });
          }
        }
        setInputs(ins);
        setOutputs(outs);
      } catch (e) {
        console.warn('[audio-devices] enumerate failed:', e);
      }
    };

    refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
    };
  }, []);

  return { inputs, outputs };
}
