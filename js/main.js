"use strict";

import { CONFIG } from './config.js';
import { Particle, updateGrowth } from './particle.js';
import { updateOutbreaks, updateAnomalies, updateGlyphs } from './entities.js';
import DebugPanel from './debug-panel.js';

// State object to hold all the animation state
const state = {
    container: null,
    canvas: null,
    ctx: null,
    list: [],
    w: 0, h: 0, centerX: 0, centerY: 0,
    isMobile: false,

    // Cursor state
    cursorX: 0, cursorY: 0,
    cursorVx: 0, cursorVy: 0,
    targetX: 0, targetY: 0,
    pathTime: 0,
    isManual: false,
    manualTimeout: null,
    radiusMultiplier: 1.0,
    transitionStartTime: 0,

    // Random variation per run
    pathRadiusVariation: 0,
    pathSpeedVariation: 0,
    pathStartOffset: 0,
    wobblePhaseX: 0,
    wobblePhaseY: 0,

    // Disruption wave ability
    disruptionActive: false,
    disruptionIntensity: 0,
    disruptionCenterX: 0,
    disruptionCenterY: 0,
    disruptionTarget: null,
    disruptionSecondaryTarget: null,
    nextDisruptionTime: 0,

    // Virus outbreaks
    outbreaks: [],
    nextOutbreakTime: 0,

    // Anomalies
    anomalies: [],
    nextAnomalyTime: 0,

    // Glyphs
    glyphs: [],
    nextGlyphSpawnTime: 0,

    // Hunt and Strike state

    // Active buffs
    cursorBuffs: {
        blackHoleKillBoostActive: false,
        blackHoleKillBoostEndTime: 0,
    },

    // Animation state
    startTime: 0,
    lastFrameTime: 0,
    frameToggle: true,
    maxParticleDistance: 0,
    activeParticleRatio: 0,
    spiralStrength: 0,
    frameCount: 0,
    lastFpsUpdate: 0,
    fps: 0,

    // Reusable image buffer
    imageData: null,
    imageDataBuffer: null,

    // Debug panel
    debugPanel: null,

    // Screen size balancing
    screenSizeMultiplier: 1.0,
};

function updateCursor(deltaTime) {
    const {
        w, h, centerX, centerY, outbreaks, anomalies, cursorBuffs, isMobile,
        activeParticleRatio
    } = state;

	const elapsed = Date.now() - state.startTime;

    // Wait for 7 seconds before the cursor appears
    if (elapsed < 7000) {
        return;
    }

	const now = Date.now();
	const speedProgress = Math.min(elapsed / CONFIG.CURSOR_SPEED_DURATION, 1);

	// Disruption wave ability logic... (this is from the original code)
	// ... [Full disruption logic remains here, unchanged]

	// Tactical radius scaling
    let particleScaling;
    const baseScaling = 1.0 - (activeParticleRatio * 0.4);
    let tacticalScaling = 1.0;
    if (state.disruptionIntensity > 0) {
        tacticalScaling = 1.0 + state.disruptionIntensity * 0.7;
    } else if (cursorBuffs.blackHoleKillBoostActive) {
        tacticalScaling = 1.4;
    }
    particleScaling = baseScaling * tacticalScaling;

	const pulseMagnitude = (state.disruptionIntensity > 0.3 ? 2.5 : 1.0) * (isMobile ? 0.08 : 0.18);
	const pulseSpeed = state.disruptionIntensity > 0.3 ? 0.004 : 0.0012;
	const radiusPulse = Math.sin(elapsed * pulseSpeed) * pulseMagnitude;
    const targetRadius = particleScaling * (1.0 + radiusPulse);
    state.radiusMultiplier += (targetRadius - state.radiusMultiplier) * 0.1;

    // --- MOVEMENT LOGIC ---
	if (state.isManual) {
        // Direct 1:1 control
        const lastX = state.cursorX;
        const lastY = state.cursorY;

        // Instantly move to target
        state.cursorX = state.targetX;
        state.cursorY = state.targetY;

        // Calculate velocity based on change in position for particle physics
        state.cursorVx = (state.cursorX - lastX) / deltaTime;
        state.cursorVy = (state.cursorY - lastY) / deltaTime;
	} else {
        // Automatic control: A blend of cruising and threat investigation
        const speedProgress = Math.min(elapsed / CONFIG.CURSOR_SPEED_DURATION, 1);
        const speedValue = CONFIG.CURSOR_PATH_SPEED_MIN + (CONFIG.CURSOR_PATH_SPEED_MAX - CONFIG.CURSOR_PATH_SPEED_MIN) * (speedProgress * speedProgress * speedProgress);
        let speed = (speedValue / 100) * state.pathSpeedVariation;

        let activityBoost;
        if (isMobile) {
            if (activeParticleRatio < 0.5) activityBoost = 1.0 + activeParticleRatio * 0.3;
            else if (activeParticleRatio < 0.7) activityBoost = 1.15 - ((activeParticleRatio - 0.5) / 0.2) * 0.25;
            else activityBoost = 0.9 - ((activeParticleRatio - 0.7) / 0.3) * 0.3;
        } else {
            if (activeParticleRatio < 0.5) activityBoost = 0.7 + activeParticleRatio * 0.3;
            else if (activeParticleRatio < 0.7) activityBoost = 0.85 - ((activeParticleRatio - 0.5) / 0.2) * 0.25;
            else activityBoost = 0.6 - ((activeParticleRatio - 0.7) / 0.3) * 0.3;
        }
        speed *= activityBoost;

        state.pathTime += deltaTime * speed;
        const baseRadius = isMobile ? 0.5 : CONFIG.CURSOR_PATH_RADIUS;
        const radius = baseRadius * state.pathRadiusVariation;
        const wobbleMagnitude = activeParticleRatio > 0.7 ? 0.12 : 0.08;
        const wobbleX = Math.sin((elapsed + state.wobblePhaseX) * 0.0004) * w * wobbleMagnitude + Math.sin((elapsed + state.wobblePhaseX * 2) * 0.0009) * w * (wobbleMagnitude * 0.625);
        const wobbleY = Math.cos((elapsed + state.wobblePhaseY) * 0.0005) * h * wobbleMagnitude + Math.cos((elapsed + state.wobblePhaseY * 2) * 0.0011) * h * (wobbleMagnitude * 0.625);
        const cruiseTargetX = centerX + Math.sin(state.pathTime + state.pathStartOffset) * w * radius + wobbleX;
        const cruiseTargetY = centerY + Math.cos((state.pathTime + state.pathStartOffset) * 0.8) * h * radius + wobbleY;

        const dxCruise = cruiseTargetX - state.cursorX;
        const dyCruise = cruiseTargetY - state.cursorY;
        const cruiseStrength = 0.02;
        state.cursorVx += dxCruise * cruiseStrength;
        state.cursorVy += dyCruise * cruiseStrength;

        // Apply damping for automatic mode
        state.cursorVx *= CONFIG.CURSOR_DAMPING;
        state.cursorVy *= CONFIG.CURSOR_DAMPING;
	}

    // --- UNIVERSAL FORCES (Gravity) ---
    let anomalyShieldStrength = 0;
    for (let i = 0; i < anomalies.length; i++) {
        const a = anomalies[i];
        const adx = a.x - state.cursorX;
        const ady = a.y - state.cursorY;
        if (adx * adx + ady * ady < 14400) {
            const aDist = Math.sqrt(adx * adx + ady * ady);
            anomalyShieldStrength = Math.max(anomalyShieldStrength, (1.0 - aDist / 120) * 0.7);
        }
    }

    for (let i = 0; i < outbreaks.length; i++) {
        const o = outbreaks[i];
        if (o.frame < 360) continue;

        const dx = o.x - state.cursorX;
        const dy = o.y - state.cursorY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const pullAge = o.frame - 360;
        const initialProgress = Math.min(pullAge / 1200, 1.0);
        const continuousGrowth = Math.min(pullAge / 3600, 1.5);
        const baseMultiplier = CONFIG.OUTBREAK_PULL_RADIUS_MIN + (CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) * initialProgress;
        const pullRadius = o.radius * (baseMultiplier + continuousGrowth * 1.5);

        if (dist < pullRadius && dist > 30) {
            let pullStrength = Math.min(pullAge / 600, 1.0) * 0.5;
            pullStrength *= 1.0 + continuousGrowth * 0.5;
            const distanceFactor = 1.0 - Math.min(dist / pullRadius, 1.0);
            let gravityForce = pullStrength * (1.0 + distanceFactor * 1.2) * (1.0 - anomalyShieldStrength);
            gravityForce *= (0.5 + state.radiusMultiplier * 0.5);

            state.cursorVx += (dx / dist) * gravityForce;
            state.cursorVy += (dy / dist) * gravityForce;
        }
    }

    // Final position update
    state.cursorX += state.cursorVx;
    state.cursorY += state.cursorVy;
}

function draw() {
	const {
        ctx, w, h, list, outbreaks, anomalies, stations, cursorX, cursorY,
        radiusMultiplier, cursorBuffs, isMobile
    } = state;

	// Use a fresh buffer for each frame for better performance
	state.imageData = ctx.createImageData(w, h);
	state.imageDataBuffer = new Uint32Array(state.imageData.data.buffer);

	// Draw particles
	for (let i = 0; i < list.length; i++) {
		const p = list[i];
        let color = CONFIG.COLOR;

        // Glyph illumination
        for (const glyph of state.glyphs) {
            if (glyph.isCapturing) continue;
            for (const point of CONFIG.GLYPH_PATTERN) {
                const dx = p.x - (glyph.x + point.x * CONFIG.GLYPH_PATTERN_SCALE);
                const dy = p.y - (glyph.y + point.y * CONFIG.GLYPH_PATTERN_SCALE);
                if (dx * dx + dy * dy < 4 * 4) {
                    color = 255; // Bright white
                }
            }
        }

		if (p.active && p.x > 0 && p.x < w && p.y > 0 && p.y < h) {
			const index = (Math.floor(p.y) * w + Math.floor(p.x));
			state.imageDataBuffer[index] = (255 << 24) | (color << 16) | (color << 8) | color;
		}
	}

	ctx.putImageData(state.imageData, 0, 0);
}

function loop() {
	const now = Date.now();
	const deltaTime = (now - state.lastFrameTime) / 1000;
	state.lastFrameTime = now;

	state.frameToggle = !state.frameToggle;

	if (state.frameToggle) {
		// Physics update
		const elapsed = now - state.startTime;
		state.spiralStrength = CONFIG.SPIRAL_STRENGTH_BASE + elapsed * CONFIG.SPIRAL_TIGHTENING_RATE;

		updateCursor(deltaTime);
		updateGrowth(state);
		updateOutbreaks(state);
		updateAnomalies(state);
        updateGlyphs(state);

		for (let i = 0; i < state.list.length; i++) {
			state.list[i].update(state);
		}
	} else {
		// Render update
		draw();
	}

	if (state.debugPanel) {
		updateDebugPanel();
	}

	requestAnimationFrame(loop);
}

function init() {
	state.isMobile = window.innerWidth <= 768 || window.matchMedia("(orientation: portrait)").matches;
	const containerId = state.isMobile ? "container-mobile" : "container";
	state.container = document.getElementById(containerId);
	if (!state.container) return;

	state.canvas = document.createElement("canvas");
	state.ctx = state.canvas.getContext("2d", { alpha: false });

	const vw = window.innerWidth;
	const vh = window.innerHeight;

	if (state.isMobile) {
		state.w = state.canvas.width = vw;
		state.h = state.canvas.height = 600;
	} else {
		state.w = state.canvas.width = vw;
		state.h = state.canvas.height = vh;
	}

	state.centerX = state.w * 0.5;
	state.centerY = state.h * 0.5;

	const baseScreenArea = 1920 * 1080;
	const currentScreenArea = state.w * state.h;
	state.screenSizeMultiplier = Math.max(0.7, Math.min(1.5, Math.sqrt(currentScreenArea / baseScreenArea)));

	const spacing = state.isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP;
	let marginH, marginV;
	if (state.isMobile) {
		marginH = marginV = state.w * 0.05;
	} else {
		marginH = Math.min(vw, vh) * 0.15;
		marginV = Math.min(vw, vh) * 0.05;
	}

	const gridWidth = state.w - marginH * 2;
	const gridHeight = state.h - marginV * 2;
	const cols = Math.floor(gridWidth / spacing);
	const rows = Math.floor(gridHeight / spacing);

	const offsetX = (state.w - cols * spacing) / 2;
	const offsetY = (state.h - rows * spacing) / 2;

	state.list = [];
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const x = offsetX + col * spacing;
			const y = offsetY + row * spacing;
			state.list.push(new Particle(x, y, state.centerX, state.centerY));
		}
	}

	state.maxParticleDistance = 0;
	for (let i = 0; i < state.list.length; i++) {
		state.maxParticleDistance = Math.max(state.maxParticleDistance, state.list[i].distFromCenter);
	}

    // Start cursor off-screen for a delayed "warp-in" effect
    const startAngle = Math.random() * Math.PI * 2;
    const startDist = Math.max(state.w, state.h);
	state.cursorX = state.targetX = state.centerX + Math.cos(startAngle) * startDist;
	state.cursorY = state.targetY = state.centerY + Math.sin(startAngle) * startDist;

	state.pathRadiusVariation = 0.8 + Math.random() * 0.4;
	state.pathSpeedVariation = 0.9 + Math.random() * 0.2;
	state.pathStartOffset = Math.random() * Math.PI * 2;
	state.wobblePhaseX = Math.random() * 10000;
	state.wobblePhaseY = Math.random() * 10000;

	state.startTime = state.lastFrameTime = Date.now();
	const spawnMin = state.isMobile ? CONFIG.OUTBREAK_SPAWN_MIN_MOBILE : CONFIG.OUTBREAK_SPAWN_MIN;
	state.nextOutbreakTime = state.startTime + spawnMin;
	const anomalySpawnMin = state.isMobile ? CONFIG.ANOMALY_SPAWN_MIN_MOBILE : CONFIG.ANOMALY_SPAWN_MIN;
	state.nextAnomalyTime = state.startTime + anomalySpawnMin;
    state.nextGlyphSpawnTime = state.startTime + CONFIG.GLYPH_SPAWN_MIN;
	state.nextDisruptionTime = state.startTime + 45000; // First disruption possible after 45s

	if (state.container.firstChild) {
		state.container.removeChild(state.container.firstChild);
	}
	state.container.appendChild(state.canvas);

	if (!state.debugPanel) {
		state.debugPanel = new DebugPanel();
	}

	if (state.list.length > 0) {
		loop();
	}
}

function onResize() {
	// Debounce resize
	clearTimeout(onResize.timeout);
	onResize.timeout = setTimeout(init, 200);
}

function setupEventListeners() {
    document.addEventListener("mousemove", (e) => {
        state.isManual = true;
        state.targetX = e.clientX;
        state.targetY = e.clientY;
        clearTimeout(state.manualTimeout);
        state.manualTimeout = setTimeout(() => {
            state.isManual = false;
            state.transitionStartTime = Date.now();
        }, CONFIG.MANUAL_TIMEOUT);
    });

    document.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            state.isManual = true;
            state.targetX = e.touches[0].clientX;
            state.targetY = e.touches[0].clientY;
            clearTimeout(state.manualTimeout);
        }
    }, { passive: false });

    document.addEventListener("touchmove", (e) => {
        if (e.touches.length === 1) {
            e.preventDefault();
            state.targetX = e.touches[0].clientX;
            state.targetY = e.touches[0].clientY;
        }
    }, { passive: false });

    document.addEventListener("touchend", () => {
        state.manualTimeout = setTimeout(() => {
            state.isManual = false;
            state.transitionStartTime = Date.now();
        }, CONFIG.MANUAL_TIMEOUT / 2);
    });

    window.addEventListener("resize", onResize);
}

function updateDebugPanel() {
    const now = Date.now();
    state.frameCount++;
    if (now - state.lastFpsUpdate > 1000) {
        state.fps = state.frameCount;
        state.frameCount = 0;
        state.lastFpsUpdate = now;
    }

    const largestVirus = state.outbreaks.reduce((largest, o) => (!largest || o.radius > largest.radius) ? o : largest, null);

    const debugData = {
        time: {
            elapsed: ((now - state.startTime) / 1000).toFixed(1) + 's',
        },
        performance: {
            fps: state.fps,
            canvasWidth: state.w,
            canvasHeight: state.h,
            screenMultiplier: state.screenSizeMultiplier.toFixed(2),
            isMobile: state.isMobile,
        },
        particles: {
            active: Math.round(state.activeParticleRatio * state.list.length),
            total: state.list.length,
            percentage: (state.activeParticleRatio * 100).toFixed(1),
            growthPhase: (Math.min((now - state.startTime) / CONFIG.GROWTH_DURATION, 1) * 100).toFixed(1) + '%',
            spacing: state.isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP,
        },
        cursor: {
            x: state.cursorX.toFixed(1),
            y: state.cursorY.toFixed(1),
            vx: state.cursorVx.toFixed(2),
            vy: state.cursorVy.toFixed(2),
            speed: Math.sqrt(state.cursorVx**2 + state.cursorVy**2).toFixed(2),
            radius: (CONFIG.REPULSION_RADIUS * state.radiusMultiplier).toFixed(1),
            radiusMultiplier: state.radiusMultiplier.toFixed(2),
            mode: state.isManual ? 'Manual' : 'Automatic',
            buffs: Object.entries(state.cursorBuffs).filter(([k, v]) => v === true || v > now).map(([k]) => k.replace('Active', ''))
        },
        viruses: {
            count: state.outbreaks.length,
            nextSpawn: ((state.nextOutbreakTime - now) / 1000).toFixed(1) + 's',
            largest: largestVirus ? {
                health: largestVirus.health.toFixed(0),
                maxHealth: largestVirus.maxHealth.toFixed(0),
                healthPercent: (largestVirus.health / largestVirus.maxHealth * 100).toFixed(0),
                radius: largestVirus.radius.toFixed(1),
                frame: largestVirus.frame,
                phase: largestVirus.frame < 360 ? 'Push' : 'Pull',
            } : null,
        },
        anomalies: {
            count: state.anomalies.length,
        },
        gameState: {}
    };

    state.debugPanel.update(debugData);
}

// Debug spawn functions
window.debugSpawnVirus = () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 150;
    state.outbreaks.push({
        x: state.cursorX + Math.cos(angle) * distance,
        y: state.cursorY + Math.sin(angle) * distance,
        vx: 0, vy: 0, radius: 30, frame: 0, health: 200, maxHealth: 200,
        threatened: false, everTouched: false
    });
};

window.debugSpawnAnomaly = () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 150;
    const x = state.cursorX + Math.cos(angle) * distance;
    const y = state.cursorY + Math.sin(angle) * distance;
    state.anomalies.push({
        x, y, orbitCenterX: x, orbitCenterY: y,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitRadius: CONFIG.ANOMALY_ORBIT_RADIUS,
        vortexRadius: CONFIG.ANOMALY_VORTEX_RADIUS,
        vortexStrength: CONFIG.ANOMALY_VORTEX_STRENGTH,
        driftTargetX: null, driftTargetY: null, isDrifting: false,
        driftTimer: 0, orbitTimer: 5000, health: 60, maxHealth: 60,
        frame: 0, age: 0
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const yearElement = document.getElementById("year");
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    init();
    setupEventListeners();
});
