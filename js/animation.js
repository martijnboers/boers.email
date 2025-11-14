'use strict';

let NUM_PARTICLES, ROWS, COLS, THICKNESS, SPACING, MARGIN, COLOR, DRAG, EASE;

let container, continueLoop, particle, canvas, list, ctx, tog, man;
let dx, dy, mx, my, d, t, f, a, b, i, n, w, h, p, bounds;
let startTime, growthDuration, centerX, centerY, accumulatedTime, lastFrameTime;
let prevMx, prevMy, manualEndTime;
let debugPanel, showDebug, frameCount, lastFpsTime, fps, isMobile, speedMultiplier;

particle = {
    vx: 0,
    vy: 0,
    x: 0,
    y: 0,
    distFromCenter: 0,
    active: false
};

function createDebugPanel() {
    debugPanel = document.createElement('div');
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: #0f0;
        padding: 15px;
        font-family: monospace;
        font-size: 11px;
        z-index: 9999;
        border: 1px solid #0f0;
        border-radius: 4px;
        max-width: 300px;
        line-height: 1.5;
        display: none;
    `;
    document.body.appendChild(debugPanel);
    showDebug = false;
    frameCount = 0;
    lastFpsTime = Date.now();
    fps = 0;
}

function toggleDebug() {
    showDebug = !showDebug;
    debugPanel.style.display = showDebug ? 'block' : 'none';
}

function updateDebugPanel() {
    if (!showDebug || !debugPanel) return;

    frameCount++;
    const now = Date.now();
    if (now - lastFpsTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
    }

    const activeParticles = list.filter(p => p.active).length;
    const growthPercent = ((Date.now() - startTime) / growthDuration * 100).toFixed(1);
    const canvasRect = canvas.getBoundingClientRect();
    const canvasVisible = canvasRect.width > 0 && canvasRect.height > 0;
    const canvasStyle = window.getComputedStyle(canvas);
    const containerStyle = window.getComputedStyle(container);

    debugPanel.innerHTML = `
        <strong>🐛 Debug Info</strong><br>
        <br>
        <strong>System:</strong><br>
        Device: ${isMobile ? 'Mobile' : 'Desktop'}<br>
        Viewport: ${window.innerWidth}x${window.innerHeight}<br>
        Container: ${container.id}<br>
        Container Display: ${containerStyle.display}<br>
        Container Visible: ${containerStyle.display !== 'none' ? '✅' : '❌'}<br>
        <br>
        <strong>Canvas:</strong><br>
        Dimensions: ${w}x${h}<br>
        BoundingRect: ${Math.floor(canvasRect.width)}x${Math.floor(canvasRect.height)}<br>
        Canvas Visible: ${canvasVisible ? '✅' : '❌'}<br>
        Canvas Display: ${canvasStyle.display}<br>
        In DOM: ${document.contains(canvas) ? '✅' : '❌'}<br>
        <br>
        <strong>Performance:</strong><br>
        FPS: ${fps}<br>
        Frame: ${tog ? 'Physics' : 'Render'}<br>
        <br>
        <strong>Particles:</strong><br>
        Total: ${NUM_PARTICLES}<br>
        Active: ${activeParticles}<br>
        Growth: ${Math.min(growthPercent, 100)}%<br>
        <br>
        <strong>Cursor:</strong><br>
        Mode: ${man ? 'Manual' : 'Auto'}<br>
        Pos: ${Math.floor(mx)}, ${Math.floor(my)}<br>
        Speed: ${speedMultiplier ? speedMultiplier.toFixed(2) : 'N/A'}x<br>
        <br>
        <em>Desktop: Press ?<br>Mobile: 3-finger tap</em>
    `;
}

function setupMobileDebug() {
    if (!isMobile) return;

    // Three-finger tap anywhere on screen to toggle debug
    let touchCount = 0;
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length === 3) {
            touchCount++;
            if (touchCount === 1) {
                setTimeout(() => {
                    if (touchCount === 1) {
                        toggleDebug();
                    }
                    touchCount = 0;
                }, 300);
            }
        }
    }, { passive: true });
}

function init() {
    isMobile = window.innerWidth <= 768 || window.matchMedia('(orientation: portrait)').matches;

    // Create debug panel
    createDebugPanel();

    // Setup keyboard shortcut for desktop
    document.addEventListener('keydown', (e) => {
        if (e.key === '?') {
            toggleDebug();
        }
    });

    // Setup mobile debug controls
    setupMobileDebug();

    // Use different container for mobile vs desktop
    const containerId = isMobile ? 'container-mobile' : 'container';
    container = document.getElementById(containerId);

    if (!container) {
        console.error('Container not found:', containerId);
        return;
    }

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { alpha: false });
    man = false;
    tog = true;
    list = [];

    // Simple responsive config based on viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (isMobile) {
        // Mobile: contained in 600px section
        SPACING = 3.5;
        THICKNESS = Math.pow(50, 2);

        // Get actual container dimensions (accounts for padding and borders)
        const containerRect = container.getBoundingClientRect();
        w = canvas.width = containerRect.width;
        h = canvas.height = 600;

        // Grid uses 90% of canvas (5% margin on each side)
        MARGIN = w * 0.05;
        const gridWidth = w * 0.9;
        const gridHeight = h * 0.9;

        COLS = Math.floor(gridWidth / SPACING);
        ROWS = Math.floor(gridHeight / SPACING);
    } else if (vw <= 1024) {
        // Tablets and small laptops - use 70% of screen (15% margin on all sides)
        THICKNESS = Math.pow(60, 2);
        SPACING = 3.5;

        const gridWidth = vw * 0.7;
        const gridHeight = vh * 0.7;
        MARGIN = vw * 0.15;

        w = canvas.width = vw;
        h = canvas.height = vh;

        COLS = Math.floor(gridWidth / SPACING);
        ROWS = Math.floor(gridHeight / SPACING);
    } else {
        // Desktop - use 70% of screen (15% margin on all sides)
        THICKNESS = Math.pow(80, 2);
        SPACING = 3.5;

        const gridWidth = vw * 0.6;
        const gridHeight = vh * 0.6;
        MARGIN = vw * 0.15;

        w = canvas.width = vw;
        h = canvas.height = vh;

        COLS = Math.floor(gridWidth / SPACING);
        ROWS = Math.floor(gridHeight / SPACING);
    }

    COLOR = 220;
    DRAG = 0.95;
    EASE = 0.25;
    NUM_PARTICLES = ROWS * COLS;

    // Growth settings
    startTime = Date.now();
    growthDuration = 45000; // 45 seconds to full growth
    centerX = w * 0.5;
    centerY = h * 0.5;
    accumulatedTime = 0;
    lastFrameTime = Date.now();
    mx = prevMx = centerX;
    my = prevMy = centerY;
    manualEndTime = null;
    speedMultiplier = 0.5;

    // Create particles and calculate distance from center
    const offsetX = (w - (COLS * SPACING)) / 2;
    const offsetY = (h - (ROWS * SPACING)) / 2;

    let maxDist = 0;

    for (i = 0; i < NUM_PARTICLES; i++) {
        p = Object.create(particle);
        p.x = p.ox = offsetX + SPACING * (i % COLS);
        p.y = p.oy = offsetY + SPACING * Math.floor(i / COLS);

        // Calculate base circular distance and angle from center
        const dcx = p.ox - centerX;
        const dcy = p.oy - centerY;
        p.baseDist = Math.sqrt(dcx * dcx + dcy * dcy);
        p.angle = Math.atan2(dcy, dcx);

        // Add organic variation per particle
        p.growthOffset = Math.random() * 0.15; // Random variation per particle
        p.active = false;

        maxDist = Math.max(maxDist, p.baseDist);

        list[i] = p;
    }

    // Store max distance for threshold calculation
    container.maxDist = maxDist;

    const updateCursorPosition = (clientX, clientY) => {
        clearInterval(continueLoop);

        // Map to canvas coordinates
        bounds = canvas.getBoundingClientRect();
        const targetX = (clientX - bounds.left) * (w / bounds.width);
        const targetY = (clientY - bounds.top) * (h / bounds.height);

        // Heavy smoothing for manual control too - 20% per frame
        mx += (targetX - mx) * 0.2;
        my += (targetY - my) * 0.2;
        man = true;

        // Return to automatic mode after 2 seconds of no movement
        continueLoop = setInterval(() => {
            man = false;
            manualEndTime = Date.now();
        }, 2000);
    };

    const mouseMoveHandler = (e) => {
        updateCursorPosition(e.clientX, e.clientY);
    };

    const touchHandler = (e) => {
        if (e.touches && e.touches.length > 0) {
            updateCursorPosition(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    // Listen on document for desktop, canvas for mobile
    if (isMobile) {
        canvas.addEventListener('touchstart', touchHandler, { passive: true });
        canvas.addEventListener('touchmove', touchHandler, { passive: true });
    } else {
        document.addEventListener('mousemove', mouseMoveHandler);
    }

    container.appendChild(canvas);
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
    return t * t * t;
}

function step() {
    // Calculate growth progress
    const elapsed = Date.now() - startTime;
    const growthProgress = Math.min(elapsed / growthDuration, 1);
    const easedProgress = easeOutCubic(growthProgress);

    // Calculate base threshold - starts small, expands outward
    const minRadius = 0.08; // Start with 8% visible (small center)
    const radiusProgress = minRadius + easedProgress * (1 - minRadius);
    const baseThreshold = container.maxDist * radiusProgress;

    // Create asymmetric, virus-like growth using multiple sine waves at different frequencies
    const time = elapsed * 0.001;

    // Activate particles based on organic, asymmetric threshold
    for (i = 0; i < NUM_PARTICLES; i++) {
        p = list[i];

        // Create organic, directional growth variations based on angle
        // Multiple frequencies create complex, virus-like patterns
        const directionalGrowth =
            Math.sin(p.angle * 3 + time * 0.5) * 0.15 +      // 3 lobes, slow rotation
            Math.sin(p.angle * 5 - time * 0.8) * 0.1 +       // 5 lobes, faster rotation
            Math.sin(p.angle * 7 + time * 1.2) * 0.08 +      // 7 lobes, more detail
            Math.sin(time * 2.0 + p.angle) * 0.12;           // Pulsing asymmetry

        // Apply directional growth to threshold (grows more in some directions)
        const particleThreshold = baseThreshold * (1 + directionalGrowth + p.growthOffset);

        // Activate particle if within organic threshold
        p.active = p.baseDist <= particleThreshold;
    }

    if (tog = !tog) {
        // Physics update frame
        if (!man) {
            const now = Date.now();
            const deltaTime = (now - lastFrameTime) * 0.001;
            lastFrameTime = now;

            // Simple time-based speed increase
            const timeProgress = Math.min(elapsed / growthDuration, 1);

            // Smooth acceleration from 1.0x to 2.0x over the full duration
            speedMultiplier = 1.0 + (easeInCubic(timeProgress) * 1.0);

            // Use real time for smooth motion
            accumulatedTime += deltaTime;
            t = accumulatedTime;

            // Apply speed to the circular motion itself
            const autoMx = w * 0.5 + Math.sin(t * speedMultiplier) * w * 0.4;
            const autoMy = h * 0.5 + Math.cos(t * speedMultiplier * 0.8) * h * 0.4;

            // Adaptive smoothing: increase smoothing factor as speed increases
            // This prevents the cursor from lagging behind when moving fast
            const smoothingFactor = 0.03 * speedMultiplier;

            // Smooth transition from manual to automatic
            if (manualEndTime) {
                const timeSinceManual = (now - manualEndTime) / 1000;
                const blendAmount = Math.min(timeSinceManual / 1.5, 1);
                mx += (autoMx - mx) * blendAmount * 0.05;
                my += (autoMy - my) * blendAmount * 0.05;

                if (blendAmount >= 1) {
                    manualEndTime = null;
                }
            } else {
                // Adaptive smoothing scales with speed to prevent lag
                mx += (autoMx - mx) * smoothingFactor;
                my += (autoMy - my) * smoothingFactor;
            }
        }

        // Update particle physics (only active particles)
        // NO sub-stepping - simple and smooth
        for (i = 0; i < NUM_PARTICLES; i++) {
            p = list[i];
            if (!p.active) continue;

            dx = mx - p.x;
            dy = my - p.y;
            d = dx * dx + dy * dy;

            if (d < THICKNESS) {
                f = -THICKNESS / d;
                t = Math.atan2(dy, dx);
                p.vx += f * Math.cos(t);
                p.vy += f * Math.sin(t);
            }

            p.vx *= DRAG;
            p.vy *= DRAG;
            p.x += p.vx + (p.ox - p.x) * EASE;
            p.y += p.vy + (p.oy - p.y) * EASE;
        }

        // Store cursor position for next frame
        prevMx = mx;
        prevMy = my;
    } else {
        // Render frame
        a = ctx.createImageData(w, h);
        b = a.data;

        // Fill background with black
        for (i = 0; i < b.length; i += 4) {
            b[i] = b[i + 1] = b[i + 2] = 0;     // RGB: black
            b[i + 3] = 255;                      // Alpha: opaque
        }

        // Draw particles (only active ones)
        for (i = 0; i < NUM_PARTICLES; i++) {
            p = list[i];
            if (!p.active) continue;

            // Skip particles that are out of bounds
            const px = ~~p.x;
            const py = ~~p.y;
            if (px < 0 || px >= w || py < 0 || py >= h) continue;

            n = (px + py * w) * 4;
            b[n] = b[n + 1] = b[n + 2] = COLOR;
            b[n + 3] = 255;
        }

        ctx.putImageData(a, 0, 0);
    }

    updateDebugPanel();
    requestAnimationFrame(step);
}

// Initialize and start animation
init();
step();
