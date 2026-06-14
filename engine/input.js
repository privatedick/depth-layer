// depth-layer/engine/input.js
// Unified input system — drag, scroll, gyro, touch
// First-gesture-wins: the first input type detected becomes the session's input mode
// Exports: InputHandler class

export class InputHandler {
    constructor(container, onDrag, onActivity) {
        this.container = container;
        this.onDrag = onDrag;       // (deltaPixels) => void
        this.onActivity = onActivity; // () => void
        this.mode = null;            // 'drag' | 'scroll' | 'gyro' | null
        this.active = false;
        this.cleanup = null;
    }

    start() {
        this.active = true;
        this.mode = null;
        this._bindAll();
    }

    stop() {
        this.active = false;
        if (this.cleanup) { this.cleanup(); this.cleanup = null; }
    }

    _bindAll() {
        let dragging = false, startY = 0;

        // --- Mouse drag ---
        const onMouseDown = (e) => {
            if (!this.active) return;
            if (this.mode && this.mode !== 'drag') return;
            this.mode = 'drag';
            dragging = true;
            startY = e.clientY;
            e.preventDefault();
        };
        const onMouseMove = (e) => {
            if (!dragging || !this.active || this.mode !== 'drag') return;
            const dy = e.clientY - startY;
            startY = e.clientY;
            this.onDrag(dy);
            this.onActivity();
        };
        const onMouseUp = () => { dragging = false; };

        // --- Touch drag ---
        const onTouchStart = (e) => {
            if (!this.active) return;
            if (this.mode && this.mode !== 'drag') return;
            this.mode = 'drag';
            dragging = true;
            startY = e.touches[0].clientY;
            e.preventDefault();
        };
        const onTouchMove = (e) => {
            if (!dragging || !this.active || this.mode !== 'drag') return;
            const dy = e.touches[0].clientY - startY;
            startY = e.touches[0].clientY;
            this.onDrag(dy);
            this.onActivity();
        };
        const onTouchEnd = () => { dragging = false; };

        // --- Scroll wheel ---
        const onWheel = (e) => {
            if (!this.active) return;
            if (this.mode && this.mode !== 'scroll') return;
            this.mode = 'scroll';
            e.preventDefault();
            this.onDrag(e.deltaY * 0.5);
            this.onActivity();
        };

        // --- Gyro ---
        let gyroBound = false;
        let lastAlpha = null;
        const onOrient = (e) => {
            if (!this.active || e.alpha === null) return;
            if (this.mode && this.mode !== 'gyro') return;
            this.mode = 'gyro';
            if (lastAlpha === null) { lastAlpha = e.alpha; return; }
            let delta = e.alpha - lastAlpha;
            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;
            lastAlpha = e.alpha;
            this.onDrag(delta);
            this.onActivity();
        };

        // iOS 13+ permission
        const requestGyro = () => {
            if (typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission().then(state => {
                    if (state === 'granted') {
                        window.addEventListener('deviceorientation', onOrient);
                        gyroBound = true;
                    }
                }).catch(() => {});
            } else if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', onOrient);
                gyroBound = true;
            }
        };

        // Request gyro on first interaction
        if (!gyroBound) requestGyro();

        // Attach all listeners
        this.container.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        this.container.addEventListener('touchstart', onTouchStart, { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
        this.container.addEventListener('wheel', onWheel, { passive: false });

        this.cleanup = () => {
            this.container.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            this.container.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            this.container.removeEventListener('wheel', onWheel);
            if (gyroBound) window.removeEventListener('deviceorientation', onOrient);
        };
    }
}
