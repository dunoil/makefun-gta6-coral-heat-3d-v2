// Sound only: four synthesized WebAudio radio stations, engine hum, sirens, gunshots.
// No audio files — every note is an oscillator, so the game loads nothing over the network.
export function createAudio() {
  let ctx = null;
  let master = null;
  let radioOn = false;
  let station = 0;
  let radioNodes = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let stepTimer = 0;
  let step = 0;

  // Station patterns: [root, chord tones, waveform, bpm, bass pattern].
  const STATIONS = [
    { name: 'CORAL FM', wave: 'triangle', bpm: 96, notes: [220, 261.6, 329.6, 392], bass: [110, 110, 130.8, 98] },
    { name: 'HEAT 98', wave: 'sawtooth', bpm: 128, notes: [196, 233.1, 293.7, 311.1], bass: [98, 98, 116.5, 87.3] },
    { name: 'VICE WAVES', wave: 'square', bpm: 112, notes: [246.9, 293.7, 369.9, 415.3], bass: [123.5, 123.5, 146.8, 110] },
    { name: 'NOCTURNE 77', wave: 'sine', bpm: 84, notes: [174.6, 220, 261.6, 349.2], bass: [87.3, 87.3, 110, 65.4] },
  ];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function startRadio() {
    if (!ctx || radioNodes) return;
    const st = STATIONS[station];
    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    gain.connect(master);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.connect(gain);
    const osc = ctx.createOscillator();
    osc.type = st.wave;
    osc.frequency.value = st.notes[0];
    osc.connect(filter);
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = st.bass[0];
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.5;
    bass.connect(bassGain);
    bassGain.connect(filter);
    osc.start();
    bass.start();
    radioNodes = { osc, bass, gain, filter };
    step = 0;
    stepTimer = 0;
  }

  function stopRadio() {
    if (!radioNodes) return;
    try {
      radioNodes.osc.stop();
      radioNodes.bass.stop();
    } catch {
      // Already stopped.
    }
    radioNodes.gain.disconnect();
    radioNodes = null;
  }

  function update(dt) {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (radioOn && radioNodes) {
      const st = STATIONS[station];
      stepTimer += dt;
      const stepLen = 60 / st.bpm / 2;
      if (stepTimer >= stepLen) {
        stepTimer -= stepLen;
        step = (step + 1) % 16;
        const n = st.notes[step % st.notes.length];
        const b = st.bass[step % st.bass.length];
        radioNodes.osc.frequency.setTargetAtTime(n * (step % 4 === 3 ? 1.5 : 1), ctx.currentTime, 0.02);
        radioNodes.bass.frequency.setTargetAtTime(b, ctx.currentTime, 0.02);
      }
    }
  }

  function engine(speed, on) {
    if (!ctx) return;
    if (on && !engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    if (engineOsc) {
      engineOsc.frequency.setTargetAtTime(60 + Math.abs(speed) * 6, ctx.currentTime, 0.05);
      engineGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.1);
    }
  }

  function siren(on) {
    if (!ctx) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let hi = false;
      const flip = () => {
        if (!sirenOsc) return;
        hi = !hi;
        sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, ctx.currentTime, 0.05);
        setTimeout(flip, 450);
      };
      flip();
    }
    if (sirenOsc) sirenGain.gain.setTargetAtTime(on ? 0.04 : 0, ctx.currentTime, 0.1);
  }

  function shot() {
    if (!ctx) return;
    const dur = 0.08;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    src.connect(g);
    g.connect(master);
    src.start();
  }

  function blip(freq = 660) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.13);
  }

  return {
    unlock() {
      return ensure();
    },
    toggleRadio() {
      if (!ensure()) return false;
      radioOn = !radioOn;
      if (radioOn) startRadio();
      else stopRadio();
      return radioOn;
    },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      if (radioOn) {
        stopRadio();
        startRadio();
      }
      return STATIONS[station].name;
    },
    stationName() {
      return STATIONS[station].name;
    },
    radioOn() {
      return radioOn;
    },
    update,
    engine,
    siren,
    shot,
    blip,
  };
}
