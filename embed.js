// depth-layer/embed.js
// Shadow DOM embeddable player widget
// Usage: <script src="./embed.js" data-experience="base64config"></script>
//        <div id="depth-layer-embed"></div>

(function() {
    // Find this script tag
    const scripts = document.querySelectorAll('script[src*="embed.js"]');
    const script = scripts[scripts.length - 1];
    if (!script) return;

    // Find target container
    const container = document.getElementById('depth-layer-embed');
    if (!container) {
        console.warn('Depth Layer: no #depth-layer-embed container found');
        return;
    }

    // Load config
    const b64 = script.getAttribute('data-experience');
    const url = script.getAttribute('data-experience-url');
    let configJson = null;

    if (b64) {
        try { configJson = JSON.parse(atob(b64)); } catch(e) {
            console.warn('Depth Layer: invalid base64 config');
            container.innerHTML = '<p style="color:#a44;font-family:monospace;padding:20px;">Invalid experience config</p>';
            return;
        }
    }

    // Create shadow DOM
    const shadow = container.attachShadow({ mode: 'open' });

    // Inline the player (simplified version — loads index.html in an iframe for full engine)
    // This embed approach uses an iframe pointing to the player with config param
    function embed(config) {
        const json = JSON.stringify(config);
        const encoded = btoa(json);
        const playerUrl = new URL('./index.html', script.src).href;

        const style = document.createElement('style');
        style.textContent = `
            :host { display: block; width: 100%; height: 100vh; }
            iframe { width: 100%; height: 100%; border: none; border-radius: 12px; background: #000; }
        `;

        const iframe = document.createElement('iframe');
        iframe.src = `${playerUrl}?config=${encodeURIComponent(encoded)}`;
        iframe.allow = 'accelerometer; gyroscope; clipboard-write';
        iframe.setAttribute('allowfullscreen', '');

        shadow.appendChild(style);
        shadow.appendChild(iframe);

        // Responsive
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => {
                iframe.style.height = container.clientHeight + 'px';
                iframe.style.width = container.clientWidth + 'px';
            }).observe(container);
        }
    }

    if (configJson) {
        embed(configJson);
    } else if (url) {
        fetch(url).then(r => r.json()).then(config => embed(config)).catch(() => {
            container.innerHTML = '<p style="color:#a44;font-family:monospace;padding:20px;">Failed to load experience</p>';
        });
    } else {
        // No config provided — embed with default
        embed({
            name: "Depth Layer", maxDepth: -10, durationSec: 120, unlockPrice: 2.99,
            layers: [
                { index: 7, type: "silence", params: {} },
                { index: 0, type: "silence", params: {} }
            ]
        });
    }
})();
