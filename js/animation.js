'use strict';

let NUM_PARTICLES, ROWS, COLS, THICKNESS, SPACING, MARGIN, COLOR, DRAG, EASE;

let container, continueLoop, particle, canvas, list, ctx, tog, man;
let dx, dy, mx, my, d, t, f, a, b, i, n, w, h, p, bounds;

particle = {
    vx: 0,
    vy: 0,
    x: 0,
    y: 0
};

function init() {
    container = document.getElementById('container');
    if (!container) return;

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { alpha: false });
    man = false;
    tog = true;
    list = [];

    // Simple responsive config based on viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (vw <= 600) {
        // Small phones
        ROWS = 80;
        COLS = 80;
        MARGIN = 10;
        THICKNESS = Math.pow(50, 2);
    } else if (vw <= 1024) {
        // Tablets and small laptops
        ROWS = 100;
        COLS = Math.floor(vw / 3.5);
        MARGIN = 30;
        THICKNESS = Math.pow(60, 2);
    } else {
        // Desktop
        ROWS = 105;
        COLS = 300;
        MARGIN = 90;
        THICKNESS = Math.pow(80, 2);
    }

    SPACING = 3.5;
    COLOR = 220;
    DRAG = 0.95;
    EASE = 0.25;
    NUM_PARTICLES = ROWS * COLS;

    w = canvas.width = COLS * SPACING + MARGIN * 2;
    h = canvas.height = ROWS * SPACING + MARGIN * 2;

    container.style.width = w + 'px';
    container.style.height = h + 'px';

    for (i = 0; i < NUM_PARTICLES; i++) {
        p = Object.create(particle);
        p.x = p.ox = MARGIN + SPACING * (i % COLS);
        p.y = p.oy = MARGIN + SPACING * Math.floor(i / COLS);
        list[i] = p;
    }

    const movementFunction = (e) => {
        clearInterval(continueLoop);

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        bounds = container.getBoundingClientRect();
        mx = clientX - bounds.left;
        my = clientY - bounds.top;
        man = true;

        continueLoop = setInterval(() => {
            man = false;
        }, 2000);
    };

    container.addEventListener('mousemove', movementFunction);
    container.addEventListener('touchmove', movementFunction, { passive: true });

    container.appendChild(canvas);
}

function step() {
    if (tog = !tog) {
        // Physics update frame
        if (!man) {
            // Automatic motion pattern
            t = Date.now() * 0.001;
            mx = w * 0.5 + (Math.cos(t * 1.2) * Math.cos(t * 0.9) * w * 0.45);
            my = h * 0.5 + (Math.sin(t * 2.3) * Math.tan(Math.sin(t * 0.8)) * h * 0.45);
        }

        // Update particle physics
        for (i = 0; i < NUM_PARTICLES; i++) {
            p = list[i];

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
    } else {
        // Render frame
        a = ctx.createImageData(w, h);
        b = a.data;

        // Draw particles (optimized single-pass)
        for (i = 0; i < NUM_PARTICLES; i++) {
            p = list[i];
            n = (~~p.x + ~~p.y * w) * 4;
            b[n] = b[n + 1] = b[n + 2] = COLOR;
            b[n + 3] = 255;
        }

        ctx.putImageData(a, 0, 0);
    }

    requestAnimationFrame(step);
}

// Initialize and start animation
init();
step();
