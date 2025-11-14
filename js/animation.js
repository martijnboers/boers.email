"use strict";

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
	// Particle grid
	SPACING: 3.5,
	COLOR: 220,

	// Particle physics (original values)
	PARTICLE_DRAG: 0.85,
	PARTICLE_EASE: 0.20,
	REPULSION_RADIUS_SQ: Math.pow(65, 2), // Original THICKNESS value (squared distance)

	CURSOR_PATH_SPEED_MIN: 80, // Start speed
	CURSOR_PATH_SPEED_MAX: 160, // End speed (3.5x faster)
	CURSOR_PATH_RADIUS: 0.3,
	CURSOR_SPEED_DURATION: 30000, // Time to reach max speed (30 seconds)

	// Cursor physics (stronger spring for smoother tracking at high speeds)
	CURSOR_SPRING: 0.35,
	CURSOR_DAMPING: 0.7,

	// Growth animation
	GROWTH_DURATION: 105000,
	GROWTH_START_RADIUS: 0.08,

	// Manual interaction
	MANUAL_TIMEOUT: 2000,
};

// ============================================================================
// STATE
// ============================================================================
let container, canvas, ctx;
let list = [];
let w, h, centerX, centerY;
let isMobile = false;

// Cursor state
let cursorX, cursorY; // Actual cursor position
let cursorVx = 0,
	cursorVy = 0; // Cursor velocity
let targetX, targetY; // Target position (from path or manual)
let pathTime = 0; // Position along automatic path
let isManual = false; // Manual control active
let manualTimeout = null;

// Animation state
let startTime;
let lastFrameTime;
let frameToggle = true;

// Debug
let debugPanel,
	showDebug = false;
let frameCount = 0,
	lastFpsTime,
	fps = 0;

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================
class Particle {
	constructor(x, y, centerX, centerY) {
		this.x = x;
		this.y = y;
		this.ox = x; // Original position
		this.oy = y;
		this.vx = 0;
		this.vy = 0;

		// Calculate distance and angle from center for growth animation
		const dx = x - centerX;
		const dy = y - centerY;
		this.distFromCenter = Math.sqrt(dx * dx + dy * dy);
		this.angle = Math.atan2(dy, dx);
		this.growthOffset = Math.random() * 0.15; // Random variation

		this.active = false;
	}

	update(cursorX, cursorY) {
		if (!this.active) return;

		// Calculate vector from particle to cursor
		const dx = cursorX - this.x;
		const dy = cursorY - this.y;
		const distSq = dx * dx + dy * dy;

		// Apply inverse-square repulsion (original physics)
		if (distSq < CONFIG.REPULSION_RADIUS_SQ) {
			// Prevent division by zero and extreme forces
			const safeDist = Math.max(distSq, 1);

			// Negative force = repulsion (away from cursor)
			const force = -CONFIG.REPULSION_RADIUS_SQ / safeDist;
			const angle = Math.atan2(dy, dx);

			this.vx += force * Math.cos(angle);
			this.vy += force * Math.sin(angle);
		}

		// Apply drag first (before adding spring force)
		this.vx *= CONFIG.PARTICLE_DRAG;
		this.vy *= CONFIG.PARTICLE_DRAG;

		// Spring back to original position
		this.x += this.vx + (this.ox - this.x) * CONFIG.PARTICLE_EASE;
		this.y += this.vy + (this.oy - this.y) * CONFIG.PARTICLE_EASE;
	}
}

// ============================================================================
// CURSOR SYSTEM
// ============================================================================
function updateCursor(deltaTime) {
	// Calculate speed progression independent of growth (0-100 scale)
	const elapsed = Date.now() - startTime;
	const speedProgress = Math.min(elapsed / CONFIG.CURSOR_SPEED_DURATION, 1);

	// Smooth acceleration using cubic easing
	const speedValue =
		CONFIG.CURSOR_PATH_SPEED_MIN +
		(CONFIG.CURSOR_PATH_SPEED_MAX - CONFIG.CURSOR_PATH_SPEED_MIN) *
			(speedProgress * speedProgress * speedProgress);

	// Convert 0-100 scale to actual speed multiplier
	const speed = speedValue / 100;

	if (!isManual) {
		// Auto mode: update path position and follow it
		pathTime += deltaTime * speed;

		// Use larger radius on mobile for more dramatic movement
		const radius = isMobile ? 0.5 : CONFIG.CURSOR_PATH_RADIUS;

		// Add organic variation that increases with speed
		const variation = speedProgress * 0.3; // Max 30% variation at full speed
		const wobbleX =
			Math.sin(pathTime * 2.3) * variation +
			Math.sin(pathTime * 4.1) * variation * 0.5;
		const wobbleY =
			Math.cos(pathTime * 1.7) * variation +
			Math.cos(pathTime * 3.3) * variation * 0.5;

		// Calculate target on circular path with organic variation
		targetX = centerX + Math.sin(pathTime) * w * (radius + wobbleX);
		targetY = centerY + Math.cos(pathTime * 0.8) * h * (radius + wobbleY);

		// Simple lerp
		cursorX += (targetX - cursorX) * 0.5;
		cursorY += (targetY - cursorY) * 0.5;
	} else {
		// Manual mode: follow user input with spring physics
		const dx = targetX - cursorX;
		const dy = targetY - cursorY;

		cursorVx += dx * CONFIG.CURSOR_SPRING;
		cursorVy += dy * CONFIG.CURSOR_SPRING;
		cursorVx *= CONFIG.CURSOR_DAMPING;
		cursorVy *= CONFIG.CURSOR_DAMPING;

		cursorX += cursorVx;
		cursorY += cursorVy;
	}
}

// ============================================================================
// GROWTH SYSTEM
// ============================================================================
function updateGrowth() {
	const elapsed = Date.now() - startTime;
	const progress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);
	const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

	// Calculate base threshold
	const radiusProgress =
		CONFIG.GROWTH_START_RADIUS +
		easedProgress * (1 - CONFIG.GROWTH_START_RADIUS);
	const maxDist = Math.max(...list.map((p) => p.distFromCenter));
	const baseThreshold = maxDist * radiusProgress;

	// Organic growth with sine waves for virus-like asymmetry
	const time = elapsed * 0.001;

	list.forEach((p) => {
		const directionalGrowth =
			Math.sin(p.angle * 3 + time * 0.5) * 0.15 +
			Math.sin(p.angle * 5 - time * 0.8) * 0.1 +
			Math.sin(p.angle * 7 + time * 1.2) * 0.08 +
			Math.sin(time * 2.0 + p.angle) * 0.12;

		const threshold = baseThreshold * (1 + directionalGrowth + p.growthOffset);
		p.active = p.distFromCenter <= threshold;
	});
}

// ============================================================================
// DEBUG PANEL
// ============================================================================
function createDebugPanel() {
	debugPanel = document.createElement("div");
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
	frameCount = 0;
	lastFpsTime = Date.now();
}

function toggleDebug() {
	showDebug = !showDebug;
	debugPanel.style.display = showDebug ? "block" : "none";
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

	const elapsed = Date.now() - startTime;
	const growthProgress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);
	const speedProgress = Math.min(elapsed / CONFIG.CURSOR_SPEED_DURATION, 1);
	const activeParticles = list.filter((p) => p.active).length;
	const growthPercent = (growthProgress * 100).toFixed(1);

	// Calculate current speed (0-100 scale)
	const currentSpeed =
		CONFIG.CURSOR_PATH_SPEED_MIN +
		(CONFIG.CURSOR_PATH_SPEED_MAX - CONFIG.CURSOR_PATH_SPEED_MIN) *
			(speedProgress * speedProgress * speedProgress);

	debugPanel.innerHTML = `
        <strong>🐛 Debug Info</strong><br>
        <br>
        <strong>System:</strong><br>
        Device: ${isMobile ? "Mobile" : "Desktop"}<br>
        Viewport: ${window.innerWidth}x${window.innerHeight}<br>
        Canvas: ${w}x${h}<br>
        <br>
        <strong>Performance:</strong><br>
        FPS: ${fps}<br>
        Frame: ${frameToggle ? "Physics" : "Render"}<br>
        <br>
        <strong>Particles:</strong><br>
        Total: ${list.length}<br>
        Active: ${activeParticles}<br>
        Growth: ${growthPercent}%<br>
        <br>
        <strong>Cursor:</strong><br>
        Mode: ${isManual ? "Manual" : "Auto"}<br>
        Pos: ${Math.floor(cursorX)}, ${Math.floor(cursorY)}<br>
        Velocity: ${Math.floor(Math.sqrt(cursorVx * cursorVx + cursorVy * cursorVy))}<br>
        Speed: ${Math.floor(currentSpeed)}/100<br>
        <br>
        <em>Desktop: Press ?<br>Mobile: 3-finger tap</em>
    `;
}

function setupMobileDebug() {
	if (!isMobile) return;

	let touchCount = 0;
	document.addEventListener(
		"touchstart",
		(e) => {
			if (e.touches.length === 3) {
				touchCount++;
				if (touchCount === 1) {
					setTimeout(() => {
						if (touchCount === 1) toggleDebug();
						touchCount = 0;
					}, 300);
				}
			}
		},
		{ passive: true },
	);
}

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
	// Detect mobile
	isMobile =
		window.innerWidth <= 768 ||
		window.matchMedia("(orientation: portrait)").matches;

	// Setup debug
	createDebugPanel();
	document.addEventListener("keydown", (e) => {
		if (e.key === "?") toggleDebug();
	});
	setupMobileDebug();

	// Get container
	const containerId = isMobile ? "container-mobile" : "container";
	container = document.getElementById(containerId);
	if (!container) {
		console.error("Container not found:", containerId);
		return;
	}

	// Create canvas
	canvas = document.createElement("canvas");
	ctx = canvas.getContext("2d", { alpha: false });

	// Calculate dimensions
	const vw = window.innerWidth;
	const vh = window.innerHeight;

	if (isMobile) {
		// Use full viewport width on mobile
		w = canvas.width = vw;
		h = canvas.height = 600;
	} else {
		w = canvas.width = vw;
		h = canvas.height = vh;
	}

	centerX = w * 0.5;
	centerY = h * 0.5;

	// Calculate grid size (use margin to keep particles away from edges)
	let marginH, marginV; // horizontal and vertical margins
	if (isMobile) {
		marginH = marginV = w * 0.05;
	} else {
		// Desktop: keep horizontal padding, reduce vertical padding for more height
		marginH = Math.min(vw, vh) * 0.15; // Same horizontal padding
		marginV = Math.min(vw, vh) * 0.05; // Much less vertical padding
	}
	const gridWidth = w - marginH * 2;
	const gridHeight = h - marginV * 2;
	const cols = Math.floor(gridWidth / CONFIG.SPACING);
	const rows = Math.floor(gridHeight / CONFIG.SPACING);

	// Create particles
	const offsetX = (w - cols * CONFIG.SPACING) / 2;
	const offsetY = (h - rows * CONFIG.SPACING) / 2;

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const x = offsetX + col * CONFIG.SPACING;
			const y = offsetY + row * CONFIG.SPACING;
			list.push(new Particle(x, y, centerX, centerY));
		}
	}

	// Initialize cursor
	cursorX = targetX = centerX;
	cursorY = targetY = centerY;

	// Initialize timing
	startTime = Date.now();
	lastFrameTime = startTime;

	// Input handlers
	const handleInput = (clientX, clientY) => {
		if (manualTimeout) clearTimeout(manualTimeout);

		const bounds = canvas.getBoundingClientRect();
		targetX = (clientX - bounds.left) * (w / bounds.width);
		targetY = (clientY - bounds.top) * (h / bounds.height);

		if (!isManual) {
			// Just switched to manual - reset velocity for clean transition
			cursorVx = 0;
			cursorVy = 0;
		}
		isManual = true;

		manualTimeout = setTimeout(() => {
			isManual = false;
			// pathTime keeps running, so cursor smoothly blends back to current path position
			cursorVx = 0;
			cursorVy = 0;
		}, CONFIG.MANUAL_TIMEOUT);
	};

	if (isMobile) {
		canvas.addEventListener(
			"touchstart",
			(e) => {
				if (e.touches.length > 0) {
					handleInput(e.touches[0].clientX, e.touches[0].clientY);
				}
			},
			{ passive: true },
		);
		canvas.addEventListener(
			"touchmove",
			(e) => {
				if (e.touches.length > 0) {
					handleInput(e.touches[0].clientX, e.touches[0].clientY);
				}
			},
			{ passive: true },
		);
	} else {
		document.addEventListener("mousemove", (e) => {
			handleInput(e.clientX, e.clientY);
		});
	}

	container.appendChild(canvas);
}

// ============================================================================
// MAIN ANIMATION LOOP
// ============================================================================
function step() {
	const now = Date.now();
	const deltaTime = (now - lastFrameTime) * 0.001;
	lastFrameTime = now;

	// Update growth (which particles are active)
	updateGrowth();

	// Update cursor EVERY frame to avoid jumpiness
	updateCursor(deltaTime);

	// Alternate between physics and render frames
	if ((frameToggle = !frameToggle)) {
		// PHYSICS FRAME
		// Update all active particles
		list.forEach((p) => p.update(cursorX, cursorY));
	} else {
		// RENDER FRAME

		const imageData = ctx.createImageData(w, h);
		const data = imageData.data;

		// Fill background with black
		for (let i = 0; i < data.length; i += 4) {
			data[i] = data[i + 1] = data[i + 2] = 0; // RGB: black
			data[i + 3] = 255; // Alpha: opaque
		}

		// Draw active particles
		list.forEach((p) => {
			if (!p.active) return;

			const px = Math.floor(p.x);
			const py = Math.floor(p.y);

			// Skip if out of bounds
			if (px < 0 || px >= w || py < 0 || py >= h) return;

			const idx = (px + py * w) * 4;
			data[idx] = data[idx + 1] = data[idx + 2] = CONFIG.COLOR;
			data[idx + 3] = 255;
		});

		ctx.putImageData(imageData, 0, 0);
	}

	updateDebugPanel();
	requestAnimationFrame(step);
}

// Initialize and start animation
init();
step();
