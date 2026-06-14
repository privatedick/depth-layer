// depth-layer/engine/behavior.js
// Behavioral tracking — records how the player interacts
// Exports: BehaviorTracker class

export class BehaviorTracker {
    constructor(maxLayer) {
        this.maxLayer = maxLayer;
        this.reset();
    }

    reset() {
        this.startTime = 0;
        this.layerEnterTimes = {};
        this.layerDwellTime = {};
        this.layerLastEnter = {};
        this.oscillations = 0;
        this.descentDirection = 'down';
        this.totalPauses = 0;
        this.lastMoveTime = 0;
        this.deepestLayer = this.maxLayer;
        this.touchedZero = false;
        this.wentNegative = false;
        this.prevLayerInt = this.maxLayer;
        this._inPause = false;
        this._pauseCheckInterval = null;
    }

    start() {
        this.reset();
        this.startTime = performance.now();
        this.lastMoveTime = performance.now();
        this._startPauseDetector();
    }

    stop() {
        if (this._pauseCheckInterval) {
            clearInterval(this._pauseCheckInterval);
            this._pauseCheckInterval = null;
        }
    }

    // Call on every input event
    activity() {
        this.lastMoveTime = performance.now();
        this._inPause = false;
    }

    // Call when layer changes
    recordTransition(currentLayer, newLayer) {
        const now = performance.now();
        const prevInt = Math.floor(currentLayer);
        const newInt = Math.floor(newLayer);

        if (prevInt === newInt) return;

        // Dwell time for previous layer
        if (this.layerLastEnter[prevInt] !== undefined) {
            this.layerDwellTime[prevInt] = (this.layerDwellTime[prevInt] || 0) +
                (now - this.layerLastEnter[prevInt]);
        }

        // Oscillation: went UP after going down
        if (newInt > prevInt && this.descentDirection === 'down') {
            this.oscillations++;
            this.descentDirection = 'up';
        } else if (newInt < prevInt) {
            this.descentDirection = 'down';
        }

        // First entry time
        if (this.layerEnterTimes[newInt] === undefined) {
            this.layerEnterTimes[newInt] = now;
        }
        this.layerLastEnter[newInt] = now;

        // Milestones
        if (newInt <= 0) this.touchedZero = true;
        if (newInt < 0) this.wentNegative = true;
        if (newInt < this.deepestLayer) this.deepestLayer = newInt;

        this.prevLayerInt = newInt;
    }

    // Compute summary signals for reading generation
    getSignals() {
        const totalMs = performance.now() - this.startTime;
        const totalSec = totalMs / 1000;
        const descentRange = this.maxLayer - this.deepestLayer;
        const descentSpeed = totalSec > 0 ? descentRange / totalSec : 0;
        const layersVisited = Object.keys(this.layerEnterTimes).length;
        const pace = descentSpeed > 1.5 ? 'fast' : descentSpeed > 0.5 ? 'moderate' : 'slow';
        const pausesPerMin = totalSec > 0 ? (this.totalPauses / (totalSec / 60)) : 0;
        const isContemplative = pausesPerMin > 3 || (pace === 'slow' && this.totalPauses > 1);
        const isOscillating = this.oscillations > 3;
        const isCommitted = this.touchedZero;
        const isDeep = this.wentNegative;

        // Find linger layer
        let lingerLayer = null, lingerTime = 0;
        for (const [layer, ms] of Object.entries(this.layerDwellTime)) {
            if (ms > lingerTime) { lingerTime = ms; lingerLayer = parseInt(layer); }
        }

        return {
            pace, isContemplative, isOscillating, isCommitted, isDeep,
            layersVisited, deepestLayer: Math.floor(this.deepestLayer),
            oscillations: this.oscillations, pauses: this.totalPauses,
            totalSec: Math.round(totalSec), lingerLayer, lingerTime,
            maxLayer: this.maxLayer
        };
    }

    _startPauseDetector() {
        if (this._pauseCheckInterval) clearInterval(this._pauseCheckInterval);
        this._pauseCheckInterval = setInterval(() => {
            const idle = performance.now() - this.lastMoveTime;
            if (idle > 2000 && !this._inPause) {
                this._inPause = true;
                this.totalPauses++;
            }
        }, 1000);
    }
}
