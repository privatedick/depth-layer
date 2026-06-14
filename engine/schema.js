// depth-layer/engine/schema.js
// Experience config validation and defaults

export const LAYER_TYPES = ['shepard', 'noise', 'heartbeat', 'breath', 'drone', 'binaural', 'speech', 'reverse', 'silence', 'ambient'];

export const PARAM_DEFS = {
    shepard: [
        { name: 'centerFreq', type: 'number', min: 50, max: 2000, default: 400, step: 10 },
        { name: 'voices', type: 'number', min: 2, max: 6, default: 4, step: 1 },
        { name: 'glideRate', type: 'number', min: 0.1, max: 2, default: 0.5, step: 0.1 },
    ],
    noise: [
        { name: 'color', type: 'select', options: ['white', 'pink', 'brown'], default: 'pink' },
        { name: 'bandpassFreq', type: 'number', min: 0, max: 10000, default: 0, step: 100 },
        { name: 'bandpassQ', type: 'number', min: 0.1, max: 20, default: 1, step: 0.1 },
    ],
    heartbeat: [
        { name: 'freq', type: 'number', min: 30, max: 150, default: 72, step: 1, label: 'BPM' },
        { name: 'resonance', type: 'number', min: 0, max: 1, default: 0.5, step: 0.05 },
    ],
    breath: [
        { name: 'cycleSec', type: 'number', min: 2, max: 20, default: 6, step: 0.5 },
        { name: 'depth', type: 'number', min: 0, max: 1, default: 0.5, step: 0.05 },
        { name: 'tone', type: 'number', min: 0, max: 1, default: 0, step: 0.1 },
    ],
    drone: [
        { name: 'baseFreq', type: 'number', min: 20, max: 500, default: 60, step: 5 },
        { name: 'harmonics', type: 'text', default: '1,2,3,5' },
        { name: 'detune', type: 'number', min: 0, max: 50, default: 5, step: 1 },
        { name: 'wobble', type: 'number', min: 0, max: 2, default: 0.2, step: 0.05 },
    ],
    binaural: [
        { name: 'baseFreq', type: 'number', min: 100, max: 500, default: 200, step: 10 },
        { name: 'beatFreq', type: 'number', min: 1, max: 40, default: 10, step: 1 },
    ],
    speech: [
        { name: 'text', type: 'text', default: 'wall' },
        { name: 'rate', type: 'number', min: 0.1, max: 2, default: 0.8, step: 0.1 },
        { name: 'pitch', type: 'number', min: 0, max: 2, default: 0.6, step: 0.1 },
        { name: 'repeat', type: 'boolean', default: true },
    ],
    reverse: [
        { name: 'text', type: 'text', default: 'the wall' },
        { name: 'rate', type: 'number', min: 0.1, max: 1, default: 0.4, step: 0.1 },
    ],
    silence: [],
    ambient: [
        { name: 'url', type: 'text', default: '' },
        { name: 'loop', type: 'boolean', default: true },
        { name: 'volume', type: 'number', min: 0, max: 1, default: 0.5, step: 0.05 },
    ],
};

export function validateExperience(exp) {
    const errors = [];
    if (!exp || typeof exp !== 'object') return { valid: false, errors: ['Not an object'] };

    if (typeof exp.name !== 'string' || exp.name.length === 0) errors.push('name must be a non-empty string');
    if (typeof exp.maxDepth !== 'number') errors.push('maxDepth must be a number');
    if (typeof exp.durationSec !== 'number' || exp.durationSec < 0) errors.push('durationSec must be >= 0');
    if (!Array.isArray(exp.layers)) errors.push('layers must be an array');

    if (Array.isArray(exp.layers)) {
        const indices = new Set();
        for (const layer of exp.layers) {
            if (typeof layer.index !== 'number') errors.push(`layer missing numeric index`);
            if (!LAYER_TYPES.includes(layer.type)) errors.push(`layer ${layer.index}: unknown type "${layer.type}"`);
            if (indices.has(layer.index)) errors.push(`duplicate layer index: ${layer.index}`);
            indices.add(layer.index);
        }
    }

    return { valid: errors.length === 0, errors };
}

export function defaultParams(type) {
    const defs = PARAM_DEFS[type] || [];
    const params = {};
    for (const d of defs) {
        if (d.type === 'text') params[d.name] = d.default;
        else if (d.type === 'boolean') params[d.name] = d.default;
        else if (d.type === 'select') params[d.name] = d.default;
        else params[d.name] = d.default;
    }
    return params;
}
