// depth-layer/engine/audio.js
// Real audio synthesis engine for Depth Layer
// Exports: DepthAudio class with 7 layer types + crossfade

export class DepthAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.layers = new Map(); // layerIndex → AudioLayerInstance
        this.activeLayers = new Set();
        this.maxConcurrent = 6;
        this.suspended = false;
        this.suspendTimer = null;
        this.suspendTimeout = 30000; // 30s idle → suspend
    }

    async init() {
        if (this.ctx && this.ctx.state !== 'closed') {
            try { await this.ctx.close(); } catch (e) {}
        }
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
        await this.ctx.resume();
        this.suspended = false;
    }

    async resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
            this.suspended = false;
        }
    }

    // Reset the suspend timer on any input
    activity() {
        this.suspended = false;
        if (this.suspendTimer) clearTimeout(this.suspendTimer);
        this.suspendTimer = setTimeout(() => this.suspend(), this.suspendTimeout);
    }

    suspend() {
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend();
            this.suspended = true;
        }
    }

    async close() {
        if (this.suspendTimer) clearTimeout(this.suspendTimer);
        this.stopAll();
        if (this.ctx && this.ctx.state !== 'closed') {
            try { await this.ctx.close(); } catch (e) {}
        }
    }

    stopAll() {
        for (const [, layer] of this.layers) {
            layer.stop();
        }
        this.layers.clear();
        this.activeLayers.clear();
    }

    // --- Crossfade Engine ---
    // floatPosition: e.g. 4.3 → blend layers 4 (70%) and 5 (30%)
    crossfade(floatPosition, layerDefs) {
        const lo = Math.floor(floatPosition);
        const hi = Math.ceil(floatPosition);
        const frac = floatPosition - lo; // 0.0 → all lo, 1.0 → all hi

        const loDef = layerDefs.find(l => l.index === lo);
        const hiDef = layerDefs.find(l => l.index === hi);

        // Stop layers not in range
        const needed = new Set();
        if (loDef) needed.add(lo);
        if (hiDef) needed.add(hi);
        if (lo === hi && loDef) needed.add(lo);

        for (const idx of [...this.activeLayers]) {
            if (!needed.has(idx)) {
                const layer = this.layers.get(idx);
                if (layer) layer.stop();
                this.activeLayers.delete(idx);
                this.layers.delete(idx);
            }
        }

        // Enforce max concurrent
        if (this.activeLayers.size >= this.maxConcurrent && needed.size > this.activeLayers.size) {
            // Remove oldest
            const oldest = this.activeLayers.values().next().value;
            const layer = this.layers.get(oldest);
            if (layer) layer.stop();
            this.activeLayers.delete(oldest);
            this.layers.delete(oldest);
        }

        // Set gains
        if (loDef) {
            const loGain = lo === hi ? 1.0 : 1.0 - frac;
            this.ensureLayer(lo, loDef).setGain(loGain);
        }
        if (hiDef && hi !== lo) {
            this.ensureLayer(hi, hiDef).setGain(frac);
        }

        this.activity();
    }

    ensureLayer(index, def) {
        if (!this.layers.has(index)) {
            const layer = this.createLayer(index, def);
            this.layers.set(index, layer);
            this.activeLayers.add(index);
            layer.start();
        }
        return this.layers.get(index);
    }

    createLayer(index, def) {
        const t = def.type;
        const p = def.params || {};
        switch (t) {
            case 'shepard': return new ShepardLayer(this.ctx, this.master, p);
            case 'noise': return new NoiseLayer(this.ctx, this.master, p);
            case 'heartbeat': return new HeartbeatLayer(this.ctx, this.master, p);
            case 'breath': return new BreathLayer(this.ctx, this.master, p);
            case 'drone': return new DroneLayer(this.ctx, this.master, p);
            case 'binaural': return new BinauralLayer(this.ctx, this.master, p);
            case 'speech': return new SpeechLayer(this.ctx, this.master, p);
            case 'reverse': return new ReverseLayer(this.ctx, this.master, p);
            case 'silence': return new SilenceLayer(this.ctx, this.master, p);
            default: return new SilenceLayer(this.ctx, this.master, p);
        }
    }
}

// --- Base Layer ---
class AudioLayer {
    constructor(ctx, destination, params) {
        this.ctx = ctx;
        this.destination = destination;
        this.params = params;
        this.gainNode = ctx.createGain();
        this.gainNode.gain.value = 0;
        this.gainNode.connect(destination);
        this.playing = false;
    }
    start() { this.playing = true; }
    stop() {
        this.playing = false;
        try { this.gainNode.disconnect(); } catch (e) {}
    }
    setGain(v) {
        const now = this.ctx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.linearRampToValueAtTime(Math.max(0.0001, v), now + 0.3);
    }
}

// --- Shepard-Risset Glissando ---
class ShepardLayer extends AudioLayer {
    constructor(ctx, dest, params) {
        super(ctx, dest, params);
        this.centerFreq = params.centerFreq || 400;
        this.voices = params.voices || 4;
        this.glideRate = params.glideRate || 0.5; // octaves per second downward
        this.oscillators = [];
        this.gains = [];
    }

    start() {
        super.start();
        const now = this.ctx.currentTime;
        for (let i = 0; i < this.voices; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            // Spread voices across one octave
            const freqOffset = Math.pow(2, i / this.voices);
            osc.frequency.value = this.centerFreq * freqOffset;
            // Raised cosine bell: voices at edges are quieter
            const bellGain = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.voices));
            gain.gain.value = Math.max(0.0001, bellGain / this.voices * 2);
            osc.connect(gain);
            gain.connect(this.gainNode);
            osc.start(now);
            this.oscillators.push(osc);
            this.gains.push(gain);
        }
        this.glide();
    }

    glide() {
        if (!this.playing) return;
        const now = this.ctx.currentTime;
        const glideDuration = 1.0 / this.glideRate; // seconds per octave

        for (let i = 0; i < this.oscillators.length; i++) {
            const osc = this.oscillators[i];
            const currentFreq = osc.frequency.value;
            const targetFreq = currentFreq / 2; // glide down one octave

            osc.frequency.linearRampToValueAtTime(Math.max(20, targetFreq), now + glideDuration);

            // If we've gone below centerFreq/2, wrap back up
            if (targetFreq < this.centerFreq / 2) {
                // Reset to top of octave range at the end of glide
                const wrapFreq = this.centerFreq * 2 * Math.pow(2, i / this.voices);
                // Schedule a frequency jump after glide completes
                setTimeout(() => {
                    if (this.playing && osc.frequency) {
                        osc.frequency.cancelScheduledValues(this.ctx.currentTime);
                        osc.frequency.value = wrapFreq;
                    }
                }, glideDuration * 1000);
            }
        }

        // Continue gliding
        this._glideTimer = setTimeout(() => this.glide(), glideDuration * 1000);
    }

    stop() {
        if (this._glideTimer) clearTimeout(this._glideTimer);
        for (const osc of this.oscillators) {
            try { osc.stop(); } catch (e) {}
        }
        super.stop();
    }
}

// --- Filtered Noise ---
class NoiseLayer extends AudioLayer {
    constructor(ctx, dest, params) {
        super(ctx, dest, params);
        this.color = params.color || 'white';
        this.bandpassFreq = params.bandpassFreq || 0;
        this.bandpassQ = params.bandpassQ || 1;
    }

    start() {
        super.start();
        // Create noise buffer (2 seconds, looped)
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;

        // Color filter
        if (this.color === 'pink') {
            this.filter = this.ctx.createBiquadFilter();
            this.filter.type = 'lowshelf';
            this.filter.frequency.value = 1000;
            this.filter.gain.value = -3; // rough pink noise approximation
        } else if (this.color === 'brown') {
            this.filter = this.ctx.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.value = 400;
            this.filter.Q.value = 0.5;
        } else {
            this.filter = this.ctx.createGain(); // pass-through
            this.filter.gain.value = 1;
        }

        // Bandpass
        if (this.bandpassFreq > 0) {
            this.bandpass = this.ctx.createBiquadFilter();
            this.bandpass.type = 'bandpass';
            this.bandpass.frequency.value = this.bandpassFreq;
            this.bandpass.Q.value = this.bandpassQ;
        } else {
            this.bandpass = null;
        }

        this.source.connect(this.filter);
        if (this.bandpass) {
            this.filter.connect(this.bandpass);
            this.bandpass.connect(this.gainNode);
        } else {
            this.filter.connect(this.gainNode);
        }

        this.source.start();
    }

    stop() {
        try { this.source.stop(); } catch (e) {}
        super.stop();
    }
}

// --- Heartbeat ---
class HeartbeatLayer extends AudioLayer {
    constructor(ctx, dest, params) {
        super(ctx, dest, params);
        this.bpm = params.freq || 72;
        this.resonance = params.resonance || 0.5;
    }

    start() {
        super.start();
        this.beatLoop();
    }

    beatLoop() {
        if (!this.playing) return;
        const now = this.ctx.currentTime;
        const period = 60 / this.bpm;

        // Create a beat: low thump
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 40 + this.resonance * 30;
        env.gain.value = 0;
        osc.connect(env);
        env.connect(this.gainNode);
        osc.start(now);

        // Attack: 10ms
        env.gain.linearRampToValueAtTime(0.3, now + 0.01);
        // Decay: 300ms
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

        // Optional second beat (double thump)
        if (this.bpm < 90) {
            const osc2 = this.ctx.createOscillator();
            const env2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.value = 30 + this.resonance * 20;
            env2.gain.value = 0;
            osc2.connect(env2);
            env2.connect(this.gainNode);
            osc2.start(now + 0.15);
            env2.gain.linearRampToValueAtTime(0.15, now + 0.16);
            env2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
            osc2.stop(now + 0.45);
        }

        osc.stop(now + 0.5);

        this._beatTimer = setTimeout(() => this.beatLoop(), period * 1000);
    }

    stop() {
        if (this._beatTimer) clearTimeout(this._beatTimer);
        super.stop();
    }
}

// --- Breath ---
class BreathLayer extends AudioLayer {
    constructor(ctx, dest, params) {
        super(ctx, dest, params);
        this.cycleSec = params.cycleSec || 6;
        this.depth = params.depth || 0.5;
        this.tone = params.tone || 0; // 0 = pure noise, 1 = pure tone
    }

    start() {
        super.start();
        // Noise source
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        this.noiseSource = this.ctx.createBufferSource();
        this.noiseSource.buffer = buffer;
        this.noiseSource.loop = true;
        this.noiseGain = this.ctx.createGain();
        this.noiseGain.gain.value = 0;
        this.noiseSource.connect(this.noiseGain);
        this.noiseGain.connect(this.gainNode);
        this.noiseSource.start();

        // Optional tone
        if (this.tone > 0) {
            this.toneOsc = this.ctx.createOscillator();
            this.toneOsc.type = 'sine';
            this.toneOsc.frequency.value = 200;
            this.toneGain = this.ctx.createGain();
            this.toneGain.gain.value = 0;
            this.toneOsc.connect(this.toneGain);
            this.toneGain.connect(this.gainNode);
            this.toneOsc.start();
        }

        this.breatheLoop();
    }

    breatheLoop() {
        if (!this.playing) return;
        const now = this.ctx.currentTime;
        const half = this.cycleSec / 2;
        const vol = 0.15 * this.depth;

        // Inhale: ramp up
        this.noiseGain.gain.linearRampToValueAtTime(vol, now + half);
        if (this.toneGain) this.toneGain.gain.linearRampToValueAtTime(vol * this.tone * 0.5, now + half);

        // Exhale: ramp down
        this.noiseGain.gain.linearRampToValueAtTime(0.0001, now + this.cycleSec);
        if (this.toneGain) this.toneGain.gain.linearRampToValueAtTime(0.0001, now + this.cycleSec);

        this._breathTimer = setTimeout(() => this.breatheLoop(), this.cycleSec * 1000);
    }

    stop() {
        if (this._breathTimer) clearTimeout(this._breathTimer);
        try { this.noiseSource.stop(); } catch (e) {}
        if (this.toneOsc) try { this.toneOsc.stop(); } catch (e) {}
        super.stop();
    }
}

// --- Drone ---
class DroneLayer extends AudioLayer {
    constructor(ctx, dest, params) {
        super(ctx, dest, params);
        this.baseFreq = params.baseFreq || 60;
        this.harmonics = params.harmonics || [1, 2, 3, 5];
        this.detune = params.detune || 5; // cents
        this.wobble = params.wobble || 0.2; // Hz
    }

    start() {
        super.start();
        this.oscs = [];
        this.oscGains = [];
        const now = this.ctx.currentTime;

        this.harmonics.forEach((h, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = i === 0 ? 'sawtooth' : 'sine';
            osc.frequency.value = this.baseFreq * h;
            osc.detune.value = (i - this.harmonics.length / 2) * this.detune;
            gain.gain.value = 1 / (h * this.harmonics.length);
            osc.connect(gain);
            gain.connect(this.gainNode);
            osc.start(now);
            this.oscs.push(osc);
            this.oscGains.push(gain);
        });

        // Wobble LFO
        if (this.wobble > 0) {
            this.lfo = this.ctx.createOscillator();
            this.lfoGain = this.ctx.createGain();
            this.lfo.frequency.value = this.wobble;
            this.lfoGain.gain.value = 0.1;
            this.lfo.connect(this.lfoGain);
            this.lfoGain.connect(this.gainNode.gain);
            this.lfo.start(now);
        }
    }

    stop() {
        for (const osc of this.oscs) try { osc.stop(); } catch (e) {}
        if (this.lfo) try { this.lfo.stop(); } catch (e) {}
        super.stop();
    }
}

// --- Binaural Beats ---
class BinauralLayer extends AudioLayer {
    constructor(ctx, dest, params) {
        super(ctx, dest, params);
        this.baseFreq = params.baseFreq || 200;
        this.beatFreq = params.beatFreq || 10;
    }

    start() {
        super.start();
        const now = this.ctx.currentTime;

        // Left ear
        this.left = this.ctx.createOscillator();
        this.leftPan = this.ctx.createStereoPanner();
        this.leftPan.pan.value = -1;
        this.left.frequency.value = this.baseFreq;
        this.left.type = 'sine';
        this.left.connect(this.leftPan);
        this.leftPan.connect(this.gainNode);
        this.left.start(now);

        // Right ear
        this.right = this.ctx.createOscillator();
        this.rightPan = this.ctx.createStereoPanner();
        this.rightPan.pan.value = 1;
        this.right.frequency.value = this.baseFreq + this.beatFreq;
        this.right.type = 'sine';
        this.right.connect(this.rightPan);
        this.rightPan.connect(this.gainNode);
        this.right.start(now);
    }

    stop() {
        try { this.left.stop(); } catch (e) {}
        try { this.right.stop(); } catch (e) {}
        super.stop();
    }
}

// --- Speech (via Web Speech API) ---
class SpeechLayer extends AudioLayer {
    constructor(ctx, dest, params) {
        super(ctx, dest, params);
        this.text = params.text || 'wall';
        this.rate = params.rate || 0.8;
        this.pitch = params.pitch || 0.6;
        this.repeat = params.repeat !== false;
        this._spoken = false;
    }

    start() {
        super.start();
        this.speak();
    }

    speak() {
        if (!this.playing) return;
        if (!this.repeat && this._spoken) return;
        this._spoken = true;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(this.text);
        u.rate = this.rate;
        u.pitch = this.pitch;
        u.onend = () => {
            if (this.playing && this.repeat) {
                this._timer = setTimeout(() => this.speak(), 2000);
            }
        };
        speechSynthesis.speak(u);
    }

    setGain(v) {
        super.setGain(v);
        // Speech volume is controlled by the gain node we feed through
    }

    stop() {
        if (this._timer) clearTimeout(this._timer);
        speechSynthesis.cancel();
        super.stop();
    }
}

// --- Reverse Speech ---
class ReverseLayer extends AudioLayer {
    constructor(ctx, dest, params) {
        super(ctx, dest, params);
        this.text = params.text || 'the wall';
        this.rate = params.rate || 0.4;
        this._spoken = false;
    }

    start() {
        super.start();
        if (!this._spoken) {
            this._spoken = true;
            speechSynthesis.cancel();
            // Reverse the text character by character
            const reversed = this.text.split('').reverse().join('');
            const u = new SpeechSynthesisUtterance(reversed);
            u.rate = this.rate;
            u.pitch = 0.4;
            speechSynthesis.speak(u);
        }
    }

    stop() {
        speechSynthesis.cancel();
        super.stop();
    }
}

// --- Silence ---
class SilenceLayer extends AudioLayer {
    start() { super.start(); }
    stop() { super.stop(); }
}
