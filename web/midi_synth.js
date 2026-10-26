/**
 * Lightweight Web Audio API MIDI Synthesizer & Player for Kyrandia 2 soundtracks.
 * Features:
 * - Real-time lookahead scheduling: avoids overwhelming the Web Audio thread with thousands of nodes
 * - Clean note envelope with smooth linear ramps (no exponential ramp errors)
 * - Dynamics compressor to prevent polyphonic clipping and digital overs
 * - Automatic voice cleanup on note completion (zero node leaks)
 * - Accurate time-position tracking and scrubbing support
 * - AnalyserNode for live audio visualizer
 */

class WebMidiPlayer {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.notes = [];
    this.durationSec = 0;
    this.currentTimeSec = 0;
    this.audioStartTime = 0;
    this.playbackStartSec = 0;
    this.nextNoteIdx = 0;
    this.activeVoices = new Set();
    this.schedulerTimer = null;
    this.onProgress = null;
    this.onEnd = null;
    this.onBpmChange = null;
    this.masterGain = null;
    this.compressor = null;
    this.analyser = null;

    this.baseBpm = 120;
    this.currentBpm = 120;
    this.playbackRate = 1.0;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.65, this.audioCtx.currentTime);

      // Dynamics compressor prevents distortion and clipping when many voices play simultaneously
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, this.audioCtx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.audioCtx.currentTime);
      this.compressor.ratio.setValueAtTime(8, this.audioCtx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.audioCtx.currentTime);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  loadMidi(arrayBuffer) {
    this.stop();
    const parsed = this.parseMidi(new Uint8Array(arrayBuffer));
    this.notes = parsed.notes || [];
    this.baseBpm = parsed.baseBpm || 120;
    this.currentBpm = this.baseBpm;
    this.playbackRate = 1.0;
    if (this.notes.length > 0) {
      this.durationSec = Math.max(...this.notes.map(n => n.startSec + n.durSec));
    } else {
      this.durationSec = 0;
    }
    this.currentTimeSec = 0;
    this.playbackStartSec = 0;
    this.nextNoteIdx = 0;
    if (this.onBpmChange) {
      this.onBpmChange(this.currentBpm, this.baseBpm, this.playbackRate);
    }
  }

  setBpm(newBpm) {
    const val = Math.max(20, Math.min(360, Math.round(Number(newBpm) || this.baseBpm)));
    if (!isFinite(val) || val === this.currentBpm) return;

    if (this.isPlaying && this.audioCtx) {
      const elapsed = this.audioCtx.currentTime - this.audioStartTime;
      const currentPos = Math.min(this.durationSec, this.playbackStartSec + (elapsed * this.playbackRate));

      for (const voice of this.activeVoices) {
        try {
          voice.osc.stop();
          voice.osc.disconnect();
          voice.gain.disconnect();
        } catch (e) {}
      }
      this.activeVoices.clear();

      this.currentTimeSec = currentPos;
      this.playbackStartSec = currentPos;
      this.audioStartTime = this.audioCtx.currentTime;
      this.currentBpm = val;
      this.playbackRate = this.baseBpm > 0 ? (this.currentBpm / this.baseBpm) : 1.0;
      this.nextNoteIdx = this.findNoteIndexAt(this.playbackStartSec);
    } else {
      this.currentBpm = val;
      this.playbackRate = this.baseBpm > 0 ? (this.currentBpm / this.baseBpm) : 1.0;
    }

    if (this.onBpmChange) {
      this.onBpmChange(this.currentBpm, this.baseBpm, this.playbackRate);
    }
  }

  resetBpm() {
    this.setBpm(this.baseBpm);
  }

  parseMidi(data) {
    if (data.length < 14) return { notes: [], baseBpm: 120 };
    // MThd check
    if (data[0] !== 0x4D || data[1] !== 0x54 || data[2] !== 0x68 || data[3] !== 0x64) {
      return { notes: [], baseBpm: 120 };
    }

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

        if (cmd === 0x9 || cmd === 0x8) {
          const note = data[tp++];
          let vel = data[tp++];
          if (cmd === 0x8) vel = 0;
          allEvents.push({ tick, type: vel > 0 ? 'noteOn' : 'noteOff', ch, note, vel });
        } else if (cmd === 0xB || cmd === 0xE) {
          tp += 2;
        } else if (cmd === 0xC || cmd === 0xD) {
          tp += 1;
        } else if (cmd === 0xA) {
          tp += 2;
        } else if (st === 0xFF) {
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
    let firstTempoUsPerQ = null;

    for (const ev of allEvents) {
      const dTick = ev.tick - currentTick;
      if (dTick > 0) {
        currentTimeSec += (dTick / ppqn) * (currentUsPerQ / 1000000.0);
        currentTick = ev.tick;
      }
      ev.timeSec = currentTimeSec;
      if (ev.type === 'tempo') {
        currentUsPerQ = ev.usPerQ;
        if (firstTempoUsPerQ === null && ev.usPerQ > 0) {
          firstTempoUsPerQ = ev.usPerQ;
        }
      }
    }

    // Pair noteOn and noteOff to create discrete notes with duration
    const notes = [];
    const activeMap = new Map();

    for (const ev of allEvents) {
      const key = `${ev.ch}_${ev.note}`;
      if (ev.type === 'noteOn') {
        if (activeMap.has(key)) {
          const prev = activeMap.get(key);
          notes.push({
            startSec: prev.startSec,
            durSec: Math.max(0.04, ev.timeSec - prev.startSec),
            ch: prev.ch,
            note: prev.note,
            vel: prev.vel
          });
        }
        activeMap.set(key, { startSec: ev.timeSec, ch: ev.ch, note: ev.note, vel: ev.vel });
      } else if (ev.type === 'noteOff') {
        if (activeMap.has(key)) {
          const prev = activeMap.get(key);
          activeMap.delete(key);
          notes.push({
            startSec: prev.startSec,
            durSec: Math.max(0.04, ev.timeSec - prev.startSec),
            ch: prev.ch,
            note: prev.note,
            vel: prev.vel
          });
        }
      }
    }

    // Close any unended notes
    for (const prev of activeMap.values()) {
      notes.push({
        startSec: prev.startSec,
        durSec: 0.3,
        ch: prev.ch,
        note: prev.note,
        vel: prev.vel
      });
    }

    notes.sort((a, b) => a.startSec - b.startSec);
    const baseBpm = firstTempoUsPerQ ? Math.round(60000000 / firstTempoUsPerQ) : 120;
    return { notes, baseBpm };
  }

  findNoteIndexAt(timeSec) {
    let low = 0;
    let high = this.notes.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.notes[mid].startSec < timeSec) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }

  play() {
    this.initAudio();
    if (this.notes.length === 0) return;

    if (this.currentTimeSec >= this.durationSec) {
      this.currentTimeSec = 0;
    }

    this.isPlaying = true;
    this.audioStartTime = this.audioCtx.currentTime;
    this.playbackStartSec = this.currentTimeSec;
    this.nextNoteIdx = this.findNoteIndexAt(this.playbackStartSec);

    // Lookahead scheduler
    const lookaheadSec = 0.20; // 200ms ahead
    const scheduleIntervalMs = 25;

    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
    }

    this.schedulerTimer = setInterval(() => {
      if (!this.isPlaying || !this.audioCtx) return;

      const elapsed = this.audioCtx.currentTime - this.audioStartTime;
      const currentPos = this.playbackStartSec + (elapsed * this.playbackRate);
      this.currentTimeSec = Math.min(currentPos, this.durationSec);

      const windowSongEnd = currentPos + (lookaheadSec * this.playbackRate);

      // Schedule notes inside window
      while (this.nextNoteIdx < this.notes.length) {
        const note = this.notes[this.nextNoteIdx];
        if (note.startSec > windowSongEnd) {
          break;
        }

        if (note.startSec + note.durSec >= currentPos) {
          const noteAudioStart = this.audioStartTime + ((note.startSec - this.playbackStartSec) / this.playbackRate);
          this.scheduleVoice(note, noteAudioStart);
        }
        this.nextNoteIdx++;
      }

      if (this.onProgress) {
        this.onProgress(this.currentTimeSec, this.durationSec);
      }

      if (this.currentTimeSec >= this.durationSec) {
        this.stop();
        if (this.onEnd) this.onEnd();
      }
    }, scheduleIntervalMs);
  }

  scheduleVoice(note, noteAudioStart) {
    if (!this.audioCtx) return;

    const dur = Math.max(0.04, note.durSec / this.playbackRate);
    const endAudioTime = noteAudioStart + dur;
    const now = this.audioCtx.currentTime;

    if (endAudioTime <= now) return;

    const startAudioTime = Math.max(now, noteAudioStart);
    const remainingDur = endAudioTime - startAudioTime;
    if (remainingDur < 0.015) return;

    // Freq from MIDI pitch
    const freq = 440 * Math.pow(2, (note.note - 69) / 12);
    if (!isFinite(freq) || freq <= 0 || freq > 20000) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    // Timbre
    if (note.ch === 9) {
      // Drums / percussion: triangle or low pulse
      osc.type = 'triangle';
    } else if (note.note < 48) {
      // Bass line
      osc.type = 'sawtooth';
    } else {
      // Melodic voices: alternating square and sawtooth
      osc.type = (note.ch % 2 === 0) ? 'sawtooth' : 'square';
    }

    osc.frequency.setValueAtTime(freq, startAudioTime);

    // Smooth linear envelope (avoids exponential ramp errors with zero values)
    const vol = (note.vel / 127) * 0.16;
    const attack = Math.min(0.008, remainingDur * 0.2);
    const release = Math.min(0.05, remainingDur * 0.4);

    if (startAudioTime > noteAudioStart + 0.01) {
      gain.gain.setValueAtTime(vol, startAudioTime);
    } else {
      gain.gain.setValueAtTime(0.0001, startAudioTime);
      gain.gain.linearRampToValueAtTime(vol, startAudioTime + attack);
    }
    gain.gain.setValueAtTime(vol, Math.max(startAudioTime + attack, endAudioTime - release));
    gain.gain.linearRampToValueAtTime(0.0001, endAudioTime);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startAudioTime);
    osc.stop(endAudioTime);

    const voice = { osc, gain };
    this.activeVoices.add(voice);

    osc.onended = () => {
      this.activeVoices.delete(voice);
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (e) {}
    };
  }

  pause() {
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    // Stop and cleanup active voices
    for (const voice of this.activeVoices) {
      try {
        voice.osc.stop();
        voice.osc.disconnect();
        voice.gain.disconnect();
      } catch (e) {}
    }
    this.activeVoices.clear();
  }

  stop() {
    this.pause();
    this.currentTimeSec = 0;
    this.playbackStartSec = 0;
    this.nextNoteIdx = 0;
  }

  seek(seconds) {
    const wasPlaying = this.isPlaying;
    this.pause();
    this.currentTimeSec = Math.max(0, Math.min(seconds, this.durationSec));
    this.playbackStartSec = this.currentTimeSec;
    this.nextNoteIdx = this.findNoteIndexAt(this.playbackStartSec);
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
