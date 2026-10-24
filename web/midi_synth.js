/**
 * Lightweight Web Audio API MIDI Synthesizer & Player for Kyrandia 2 soundtracks.
 * Zero-dependency pure JavaScript player.
 */

class WebMidiPlayer {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.currentMidData = null;
    this.events = [];
    this.durationSec = 0;
    this.currentTimeSec = 0;
    this.activeVoices = [];
    this.timerId = null;
    this.onProgress = null;
    this.onEnd = null;
    this.masterGain = null;
    this.analyser = null;
    this.channels = {};
    for (let c = 0; c < 16; c++) {
      this.channels[c] = { program: 0, volume: 1.0, pan: 0.0 };
    }
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.audioCtx.currentTime);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  loadMidi(arrayBuffer) {
    this.stop();
    this.events = this.parseMidi(new Uint8Array(arrayBuffer));
    if (this.events.length > 0) {
      this.durationSec = this.events[this.events.length - 1].timeSec;
    } else {
      this.durationSec = 0;
    }
    this.currentTimeSec = 0;
  }

  parseMidi(data) {
    if (data.length < 14) return [];
    // MThd check
    if (data[0] !== 0x4D || data[1] !== 0x54 || data[2] !== 0x68 || data[3] !== 0x64) {
      return [];
    }

    const format = (data[8] << 8) | data[9];
    const ntracks = (data[10] << 8) | data[11];
    const division = (data[12] << 8) | data[13];
    const ppqn = division & 0x7FFF;

    let p = 14;
    const l = data.length;
    const allEvents = [];

    // Parse each track
    while (p + 8 <= l) {
      const isTrk = data[p] === 0x4D && data[p+1] === 0x54 && data[p+2] === 0x72 && data[p+3] === 0x6B;
      const tlen = (data[p+4] << 24) | (data[p+5] << 16) | (data[p+6] << 8) | data[p+7];
      p += 8;
      if (!isTrk) {
        p += tlen;
        continue;
      }

      let tp = p;
      const tend = Math.min(l, p + tlen);
      let tick = 0;
      let runningStatus = 0;

      while (tp < tend) {
        // Read VLQ delta
        let delta = 0;
        while (tp < tend) {
          const b = data[tp++];
          delta = (delta << 7) | (b & 0x7F);
          if (!(b & 0x80)) break;
        }
        tick += delta;

        if (tp >= tend) break;
        let st = data[tp];
        if (st >= 0x80) {
          runningStatus = st;
          tp++;
        } else {
          st = runningStatus;
        }

        const cmd = st >> 4;
        const ch = st & 0x0F;

        if (cmd === 0x9 || cmd === 0x8) { // Note on / off
          const note = data[tp++];
          let vel = data[tp++];
          if (cmd === 0x8) vel = 0;
          allEvents.push({ tick, type: vel > 0 ? 'noteOn' : 'noteOff', ch, note, vel });
        } else if (cmd === 0xB) { // Controller
          const cc = data[tp++];
          const val = data[tp++];
          allEvents.push({ tick, type: 'controller', ch, cc, val });
        } else if (cmd === 0xC) { // Program Change
          const prog = data[tp++];
          allEvents.push({ tick, type: 'program', ch, prog });
        } else if (cmd === 0xE) { // Pitch Bend
          const lsb = data[tp++];
          const msb = data[tp++];
          allEvents.push({ tick, type: 'pitch', ch, val: ((msb << 7) | lsb) - 8192 });
        } else if (cmd === 0xA) {
          tp += 2;
        } else if (cmd === 0xD) {
          tp += 1;
        } else if (st === 0xFF) { // Meta event
          const mtype = data[tp++];
          let mlen = 0;
          while (tp < tend) {
            const b = data[tp++];
            mlen = (mlen << 7) | (b & 0x7F);
            if (!(b & 0x80)) break;
          }
          if (mtype === 0x51 && mlen === 3) {
            const usPerQ = (data[tp] << 16) | (data[tp+1] << 8) | data[tp+2];
            allEvents.push({ tick, type: 'tempo', usPerQ });
          }
          tp += mlen;
        } else if (st === 0xF0 || st === 0xF7) {
          let slen = 0;
          while (tp < tend) {
            const b = data[tp++];
            slen = (slen << 7) | (b & 0x7F);
            if (!(b & 0x80)) break;
          }
          tp += slen;
        }
      }
      p += tlen;
    }

    // Sort all events by tick
    allEvents.sort((a, b) => a.tick - b.tick);

    // Compute absolute seconds with tempo changes
    let currentTick = 0;
    let currentTimeSec = 0;
    let currentUsPerQ = 500000; // default 120 bpm

    for (const ev of allEvents) {
      const dTick = ev.tick - currentTick;
      if (dTick > 0) {
        currentTimeSec += (dTick / ppqn) * (currentUsPerQ / 1000000.0);
        currentTick = ev.tick;
      }
      ev.timeSec = currentTimeSec;
      if (ev.type === 'tempo') {
        currentUsPerQ = ev.usPerQ;
      }
    }

    return allEvents;
  }

  play() {
    this.initAudio();
    if (this.events.length === 0) return;

    this.isPlaying = true;
    const startAudioTime = this.audioCtx.currentTime;
    const startSeek = this.currentTimeSec;

    // Schedule all remaining events
    const activeNoteOscs = {};

    for (const ev of this.events) {
      if (ev.timeSec < startSeek) continue;
      const scheduledTime = startAudioTime + (ev.timeSec - startSeek);

      if (ev.type === 'noteOn') {
        const freq = 440 * Math.pow(2, (ev.note - 69) / 12);
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // Distinct timbre for melodic vs drum channel (ch 9)
        if (ev.ch === 9) {
          osc.type = 'triangle';
        } else {
          // Retro game synth wave: pulse/saw/square
          osc.type = (ev.ch % 2 === 0) ? 'sawtooth' : 'square';
        }

        osc.frequency.setValueAtTime(freq, scheduledTime);

        // Volume envelope
        const vol = (ev.vel / 127) * 0.2;
        gain.gain.setValueAtTime(0.0001, scheduledTime);
        gain.gain.exponentialRampToValueAtTime(vol, scheduledTime + 0.015);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(scheduledTime);

        const key = `${ev.ch}_${ev.note}`;
        activeNoteOscs[key] = { osc, gain, vol, time: scheduledTime };

      } else if (ev.type === 'noteOff') {
        const key = `${ev.ch}_${ev.note}`;
        if (activeNoteOscs[key]) {
          const { osc, gain } = activeNoteOscs[key];
          gain.gain.setValueAtTime(gain.gain.value || 0.1, scheduledTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, scheduledTime + 0.08);
          osc.stop(scheduledTime + 0.1);
          delete activeNoteOscs[key];
        }
      }
    }

    // Timer for UI progress updates
    const updateTick = () => {
      if (!this.isPlaying) return;
      this.currentTimeSec = startSeek + (this.audioCtx.currentTime - startAudioTime);
      if (this.onProgress) {
        this.onProgress(this.currentTimeSec, this.durationSec);
      }
      if (this.currentTimeSec >= this.durationSec) {
        this.stop();
        if (this.onEnd) this.onEnd();
        return;
      }
      this.timerId = requestAnimationFrame(updateTick);
    };
    this.timerId = requestAnimationFrame(updateTick);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      cancelAnimationFrame(this.timerId);
      this.timerId = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.masterGain = null;
      this.analyser = null;
    }
    this.currentTimeSec = 0;
  }

  seek(seconds) {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.currentTimeSec = Math.max(0, Math.min(seconds, this.durationSec));
    if (wasPlaying) {
      this.play();
    }
  }

  getFrequencyData(array) {
    if (this.analyser && this.isPlaying) {
      this.analyser.getByteFrequencyData(array);
    } else {
      array.fill(0);
    }
  }
}

window.midiPlayer = new WebMidiPlayer();
