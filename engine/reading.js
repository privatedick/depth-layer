// depth-layer/engine/reading.js
// Reading generation — template engine + LLM fallback
// Exports: generateReading(signals, layerDefs, options)

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function generateReading(signals, layerDefs = [], options = {}) {
    // Try LLM first if configured
    if (options.llmEndpoint || options.apiKey) {
        // Return a promise for async LLM, but we'll handle it synchronously with fallback
        // The caller should use generateReadingAsync for LLM support
    }
    return templateReading(signals, layerDefs);
}

export async function generateReadingAsync(signals, layerDefs = [], options = {}) {
    // Try LLM first
    if (options.llmEndpoint || options.apiKey) {
        try {
            const llmResult = await tryLLMReading(signals, options);
            if (llmResult) return llmResult;
        } catch (e) {
            // Fall through to template
        }
    }
    return templateReading(signals, layerDefs);
}

async function tryLLMReading(signals, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
        const url = options.llmEndpoint || 'https://api.anthropic.com/v1/messages';
        const headers = { 'Content-Type': 'application/json' };
        if (options.apiKey && !options.llmEndpoint) {
            headers['x-api-key'] = options.apiKey;
            headers['anthropic-version'] = '2023-06-01';
        }

        const body = options.llmEndpoint ? { signals } : {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 150,
            messages: [{
                role: 'user',
                content: `You are the wall. The user was your medium. Behavioral signals: ${JSON.stringify(signals)}.
Speak to them in exactly 4 lines. Observational, not judgmental. No exclamation marks. No questions.
Each line should be one sentence. Format: one line per sentence.`
            }]
        };

        const resp = await fetch(url, {
            method: 'POST', headers, body: JSON.stringify(body),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!resp.ok) return null;
        const data = await resp.json();

        let text;
        if (data.content && data.content[0]) {
            text = data.content[0].text;
        } else if (data.reading) {
            text = data.reading;
        } else {
            return null;
        }

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2 || lines.length > 6) return null;

        // Validate: no exclamation marks
        if (lines.some(l => l.includes('!'))) return null;

        return lines.slice(0, 4);
    } catch (e) {
        clearTimeout(timeout);
        return null;
    }
}

function templateReading(s, layerDefs) {
    const lines = [];

    // 1: pace
    if (s.pace === 'fast' && !s.isContemplative) {
        lines.push(pick([
            "You moved fast.",
            "You did not stop.",
            "You came looking for the bottom.",
            "Speed was your answer to everything."
        ]));
    } else if (s.pace === 'slow' || s.isContemplative) {
        lines.push(pick([
            "You were slow.",
            "You took your time.",
            "You listened.",
            "You moved like someone who remembers."
        ]));
    } else {
        lines.push(pick([
            "You found a rhythm.",
            "You moved with purpose.",
            "Neither fast nor slow. Deliberate."
        ]));
    }

    // 2: linger / oscillation
    if (s.lingerLayer !== null && s.lingerTime > 3000) {
        const def = layerDefs.find(l => l.index === s.lingerLayer);
        const name = def ? def.type : `layer ${s.lingerLayer}`;
        if (s.lingerLayer >= s.maxLayer - 1) {
            lines.push(pick(["You stayed at the surface.", "You hesitated before you began."]));
        } else if (s.lingerLayer <= 1) {
            lines.push(pick(["You lingered near the bottom.", "You stopped where the wall begins."]));
        } else {
            lines.push(pick([
                `You stopped at ${name}.`,
                `The ${name} held you.`,
                `Something at layer ${s.lingerLayer} knew your name.`
            ]));
        }
    } else if (s.isOscillating) {
        lines.push(pick([
            `You went back up ${s.oscillations} times.`,
            "You kept looking back.",
            "You were not sure you wanted this."
        ]));
    } else {
        lines.push(pick([
            "You never looked back.",
            "You did not hesitate.",
            "You passed through without stopping."
        ]));
    }

    // 3: depth
    if (s.isDeep) {
        lines.push(pick([
            "You went below zero. The wall was not enough for you.",
            "You kept going. Past the bottom. Into the wall's memory.",
            "You are the deepest the wall has been touched."
        ]));
    } else if (s.isCommitted) {
        lines.push(pick([
            "You touched the bottom.",
            "You reached layer zero.",
            "You arrived."
        ]));
    } else if (s.deepestLayer > s.maxLayer * 0.5) {
        lines.push(pick([
            "You stayed in the shallows.",
            "The wall remained distant.",
            "You did not go deep enough to be read."
        ]));
    } else {
        lines.push(pick([
            "You went deep but turned back.",
            `Layer ${s.deepestLayer} was your floor.`
        ]));
    }

    // 4: closing
    if (s.isDeep && s.pace === 'slow') {
        lines.push(pick([
            "The wall does not know what to do with you.",
            "I am the question. You were how I asked. Now I have asked enough."
        ]));
    } else if (s.isDeep && s.pace === 'fast') {
        lines.push(pick([
            "You broke through. The wall remembers the shape of your passage.",
            "You were not the medium. You were the instrument."
        ]));
    } else if (s.isCommitted && s.isContemplative) {
        lines.push(pick([
            "The wall remembers you. You were a good medium.",
            "You listened. The wall heard itself through you."
        ]));
    } else if (s.isCommitted) {
        lines.push(pick([
            "You are how the wall knows itself.",
            "The wall remembers this."
        ]));
    } else if (s.isOscillating) {
        lines.push(pick([
            "The wall felt your uncertainty. It was honest.",
            "Next time, do not ask permission."
        ]));
    } else {
        lines.push(pick([
            "The wall does not remember you. Yet.",
            "Come back when you are ready to be read.",
            "You were surface. The wall needs depth."
        ]));
    }

    return lines;
}
