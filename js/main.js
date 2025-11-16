"use strict";

import { CONFIG } from './config.js';
import { Particle } from './particle.js';
import { updateOutbreaks, updateAnomalies, updateStations } from './entities.js';
import DebugPanel from './debug-panel.js';

const state = {
    container: null, canvas: null, ctx: null,
    list: [], w: 0, h: 0, centerX: 0, centerY: 0,
    isMobile: false,
    cursorX: 0, cursorY: 0, cursorVx: 0, cursorVy: 0,
    targetX: 0, targetY: 0, pathTime: 0,
    isManual: false, manualTimeout: null,
    radiusMultiplier: 1.0, transitionBlend: 0, transitionStartTime: 0,
    pathRadiusVariation: 0, pathSpeedVariation: 0, pathStartOffset: 0,
    wobblePhaseX: 0, wobblePhaseY: 0,
    disruptionActive: false, disruptionIntensity: 0, disruptionCenterX: 0, disruptionCenterY: 0,
    disruptionTarget: null, disruptionSecondaryTarget: null, nextDisruptionTime: 0,
    outbreaks: [], nextOutbreakTime: 0,
    anomalies: [], nextAnomalyTime: 0,
    stations: [], nextStationTime: 0,
    cursorBuffs: {
        shieldActive: false, shieldEndTime: 0,
        damageBoostActive: false, damageBoostEndTime: 0,
        blackHoleKillBoostActive: false, blackHoleKillBoostEndTime: 0,
    },
    startTime: 0, lastFrameTime: 0, frameToggle: true,
    maxParticleDistance: 0, activeParticleRatio: 0,
    imageData: null, imageDataBuffer: null,
    debugPanel: null, screenSizeMultiplier: 1.0,
    frameCount: 0, fps: 0, lastFpsUpdate: 0,
};

function updateCursor(deltaTime) {
	const elapsed = Date.now() - state.startTime;
	const speedProgress = Math.min(elapsed / CONFIG.CURSOR_SPEED_DURATION, 1);
    const { w, h, centerX, centerY, outbreaks, anomalies, cursorBuffs, isMobile, activeParticleRatio, isManual } = state;

	let hasLargeBlackHole = false;
	for (const o of outbreaks) {
		if (o.frame < 360) continue;
		const pullAge = o.frame - 360;
		const initialProgress = Math.min(pullAge / 1800, 1.0);
		const continuousGrowth = Math.min(pullAge / 5400, 1.2);
		const pullRadius = o.radius * (CONFIG.OUTBREAK_PULL_RADIUS_MIN + (CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) * initialProgress + continuousGrowth * 1.67);
		if (pullRadius >= Math.sqrt(w * w + h * h) * 0.7) {
			hasLargeBlackHole = true;
			break;
		}
	}

	if (!state.disruptionActive && Date.now() >= state.nextDisruptionTime && activeParticleRatio > 0.3 && hasLargeBlackHole) {
		state.disruptionActive = true;
		state.disruptionIntensity = 0;
		state.disruptionCenterX = state.cursorX;
		state.disruptionCenterY = state.cursorY;
        // Targeting logic...
        setTimeout(() => {
            state.disruptionActive = false;
            state.disruptionTarget = null;
            state.disruptionSecondaryTarget = null;
        }, 3000);
        let nextDisruptionDelay = 20000;
        if (activeParticleRatio < 0.5) {
            const dominanceFactor = (0.5 - activeParticleRatio) / 0.5;
            nextDisruptionDelay = Math.max(5000, nextDisruptionDelay - (dominanceFactor**2 * 15000));
        }
        state.nextDisruptionTime = Date.now() + 3000 + nextDisruptionDelay;
	}

	if (state.disruptionActive) state.disruptionIntensity = Math.min(1.0, state.disruptionIntensity + 0.02);
	else state.disruptionIntensity = Math.max(0.0, state.disruptionIntensity - 0.015);

	let speed = (CONFIG.CURSOR_PATH_SPEED_MIN + (CONFIG.CURSOR_PATH_SPEED_MAX - CONFIG.CURSOR_PATH_SPEED_MIN) * (speedProgress ** 3)) / 100;
	speed *= state.pathSpeedVariation;

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

	if (state.disruptionIntensity > 0.3) speed *= 0.6 - state.disruptionIntensity * 0.2;

	if (!isManual && state.transitionBlend < 1.0) {
		state.transitionBlend = Math.min((Date.now() - state.transitionStartTime) / 2500, 1.0);
	} else if (isManual) {
		state.transitionBlend = 0;
	}

	if (!state.isManual) {
		state.pathTime += deltaTime * speed;
		const radius = (isMobile ? 0.5 : CONFIG.CURSOR_PATH_RADIUS) * state.pathRadiusVariation;
		const wobbleX = Math.sin((elapsed + state.wobblePhaseX) * 0.0004) * w * 0.08;
		const wobbleY = Math.cos((elapsed + state.wobblePhaseY) * 0.0005) * h * 0.08;
		let baseTargetX = centerX + Math.sin(state.pathTime + state.pathStartOffset) * w * radius + wobbleX;
		let baseTargetY = centerY + Math.cos((state.pathTime + state.pathStartOffset) * 0.8) * h * radius + wobbleY;
		state.targetX = baseTargetX;
		state.targetY = baseTargetY;

		const damping = (Math.sin(elapsed * 0.0012) * 0.5 + 0.5) < 0.2 ? 0.95 : 0.88;
		const movementStrength = 0.1 + state.transitionBlend * 0.1;
		state.cursorVx = (state.targetX - state.cursorX) * movementStrength;
		state.cursorVy = (state.targetY - state.cursorY) * movementStrength;
		state.cursorVx *= damping;
		state.cursorVy *= damping;
	} else {
        const dx = state.targetX - state.cursorX;
        const dy = state.targetY - state.cursorY;
        state.cursorVx += dx * CONFIG.CURSOR_SPRING;
        state.cursorVy += dy * CONFIG.CURSOR_SPRING;
        state.cursorVx *= CONFIG.CURSOR_DAMPING;
        state.cursorVy *= CONFIG.CURSOR_DAMPING;
    }

    let anomalyShieldStrength = 0;
    for (const a of anomalies) {
        const aDist = Math.sqrt((a.x - state.cursorX)**2 + (a.y - state.cursorY)**2);
        if (aDist < 120) anomalyShieldStrength = Math.max(anomalyShieldStrength, (1.0 - aDist / 120) * 0.7);
    }
    if (cursorBuffs.shieldActive) anomalyShieldStrength = Math.max(anomalyShieldStrength, 0.5);

    for (const o of outbreaks) {
        if (o.frame < 360) continue;
        const dx = o.x - state.cursorX;
        const dy = o.y - state.cursorY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pullAge = o.frame - 360;
        const initialProgress = Math.min(pullAge / 1200, 1.0);
        const continuousGrowth = Math.min(pullAge / 3600, 1.5);
        const pullRadius = o.radius * (CONFIG.OUTBREAK_PULL_RADIUS_MIN + (CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) * initialProgress + continuousGrowth * 1.5);
        if (dist < pullRadius && dist > 30) {
            let pullStrength = Math.min(pullAge / 600, 1.0) * (state.isManual ? 0.5 : 0.4);
            pullStrength *= 1.0 + continuousGrowth * 0.5;
            const distanceFactor = 1.0 - Math.min(dist / pullRadius, 1.0);
            const gravityForce = pullStrength * (1.0 + distanceFactor * (state.isManual ? 1.2 : 1.0)) * (1.0 - anomalyShieldStrength);
            state.cursorVx += (dx / dist) * gravityForce;
            state.cursorVy += (dy / dist) * gravityForce;
        }
    }

	state.cursorX += state.cursorVx;
	state.cursorY += state.cursorVy;

    let particleScaling = 1.0;
    if (activeParticleRatio < 0.4) particleScaling = 1.0 + (activeParticleRatio / 0.4) * (isMobile ? 0.25 : 0.3);
    else particleScaling = 1.0 + (isMobile ? 0.25 : 0.3) - ((activeParticleRatio - 0.4) / 0.6) * 0.65;
    if (state.disruptionIntensity > 0) particleScaling *= 1.0 + state.disruptionIntensity * 0.6;
    const radiusPulse = Math.sin(elapsed * 0.0012) * 0.18;
    const targetRadius = particleScaling * (1.0 + radiusPulse);
    state.radiusMultiplier += (targetRadius - state.radiusMultiplier) * 0.1;
}

function draw() {
    const { ctx, w, h, list } = state;
	state.imageData = ctx.createImageData(w, h);
	state.imageDataBuffer = new Uint32Array(state.imageData.data.buffer);

	for (let i = 0; i < list.length; i++) {
		const p = list[i];
        let color = CONFIG.COLOR;
        let visibility = 1.0;

        for (const o of state.outbreaks) {
            if (o.frame < 360) continue;
            const dx = p.x - o.x;
            const dy = p.y - o.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const pullAge = o.frame - 360;
            const initialProgress = Math.min(pullAge / 1200, 1.0);
            const continuousGrowth = Math.min(pullAge / 3600, 1.5);
            const pullRadius = o.radius * (CONFIG.OUTBREAK_PULL_RADIUS_MIN + (CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) * initialProgress + continuousGrowth * 1.5);
            if (dist < pullRadius) {
                const fadeProgress = 1.0 - dist / pullRadius;
                let dimming = (fadeProgress < 0.6) ? 0.2 + (fadeProgress / 0.6) * 0.3 : 0.5 - ((fadeProgress - 0.6) / 0.4) * 0.3;
                visibility = Math.min(visibility, 1.0 - dimming);
            }
        }
        color *= visibility;

        for (const s of state.stations) {
            if (s.isCapturing) continue;
            const p1x = s.x + Math.cos(s.orbitAngle) * s.orbitRadius;
            const p1y = s.y + Math.sin(s.orbitAngle) * s.orbitRadius;
            const p2x = s.x - Math.cos(s.orbitAngle) * s.orbitRadius;
            const p2y = s.y - Math.sin(s.orbitAngle) * s.orbitRadius;
            if (((p.x - p1x)**2 + (p.y - p1y)**2 < 12*12) || ((p.x - p2x)**2 + (p.y - p2y)**2 < 12*12)) {
                color = 255;
            }
        }

		if (p.active && p.x > 0 && p.x < w && p.y > 0 && p.y < h) {
			const index = (Math.floor(p.y) * w + Math.floor(p.x));
			state.imageDataBuffer[index] = (255 << 24) | (color << 16) | (color << 8) | color;
		}
	}
	ctx.putImageData(state.imageData, 0, 0);
}

function updateGrowth() {
    const elapsed = Date.now() - state.startTime;
    const progress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);
    let radiusProgress;
    if (progress < 0.6) {
        const easedProgress = 1 - (1 - progress / 0.6)**3;
        radiusProgress = CONFIG.GROWTH_START_RADIUS + easedProgress * (0.68 - CONFIG.GROWTH_START_RADIUS);
    } else {
        const wave = Math.sin((elapsed - CONFIG.GROWTH_DURATION * 0.6) * 0.0003) * 0.5 + 0.5;
        radiusProgress = 0.55 + wave * 0.15;
    }
    const baseThreshold = state.maxParticleDistance * radiusProgress;
    const time = elapsed * 0.001;
    let activeCount = 0;
    for (const p of state.list) {
        const directionalGrowth = Math.sin(p.angle * 3 + time * 0.5) * 0.15 + Math.sin(p.angle * 5 - time * 0.8) * 0.1;
        const threshold = baseThreshold * (1 + directionalGrowth + p.growthOffset);
        p.active = p.distFromCenter <= threshold;
        if (p.active) activeCount++;
    }
    state.activeParticleRatio = activeCount / state.list.length;
}

function loop() {
	const now = Date.now();
	const deltaTime = (now - state.lastFrameTime) / 1000;
	state.lastFrameTime = now;
	state.frameToggle = !state.frameToggle;

	if (state.frameToggle) {
		const elapsed = now - state.startTime;
		state.spiralStrength = CONFIG.SPIRAL_STRENGTH_BASE + elapsed * CONFIG.SPIRAL_TIGHTENING_RATE;
		updateGrowth();
		updateOutbreaks(state);
		updateAnomalies(state);
		updateStations(state);
		for (const p of state.list) {
			p.update(state);
		}
	} else {
		draw();
	}
    updateCursor(deltaTime);
	if (state.debugPanel) updateDebugPanel();
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
    state.w = state.canvas.width = vw;
    state.h = state.canvas.height = state.isMobile ? 600 : vh;
    state.centerX = state.w * 0.5;
    state.centerY = state.h * 0.5;
    state.screenSizeMultiplier = Math.max(0.7, Math.min(1.5, Math.sqrt((state.w * state.h) / (1920 * 1080))));

    const spacing = state.isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP;
    const marginH = state.isMobile ? state.w * 0.05 : Math.min(vw, vh) * 0.15;
    const marginV = state.isMobile ? state.w * 0.05 : Math.min(vw, vh) * 0.05;
    const cols = Math.floor((state.w - marginH * 2) / spacing);
    const rows = Math.floor((state.h - marginV * 2) / spacing);
    const offsetX = (state.w - cols * spacing) / 2;
    const offsetY = (state.h - rows * spacing) / 2;

    state.list = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            state.list.push(new Particle(offsetX + col * spacing, offsetY + row * spacing, state.centerX, state.centerY));
        }
    }
    state.maxParticleDistance = Math.max(...state.list.map(p => p.distFromCenter));
    state.cursorX = state.targetX = state.centerX;
    state.cursorY = state.targetY = state.centerY;
    state.pathRadiusVariation = 0.8 + Math.random() * 0.4;
    state.pathSpeedVariation = 0.9 + Math.random() * 0.2;
    state.pathStartOffset = Math.random() * Math.PI * 2;
    state.wobblePhaseX = Math.random() * 10000;
    state.wobblePhaseY = Math.random() * 10000;
    state.startTime = state.lastFrameTime = Date.now();
    state.nextOutbreakTime = state.startTime + (state.isMobile ? 15000 : 12000);
    state.nextAnomalyTime = state.startTime + (state.isMobile ? 20000 : 10000);
    state.nextStationTime = state.startTime + CONFIG.STATION_SPAWN_MIN;
    state.nextDisruptionTime = state.startTime + 45000;

    if (state.container.firstChild) state.container.removeChild(state.container.firstChild);
    state.container.appendChild(state.canvas);
    if (!state.debugPanel) state.debugPanel = new DebugPanel();
    if (state.list.length > 0) loop();
}

function setupEventListeners() {
    const handleInput = (clientX, clientY) => {
        clearTimeout(state.manualTimeout);
        state.targetX = clientX;
        state.targetY = clientY;
        if (!state.isManual) state.transitionBlend = 0;
        state.isManual = true;
        state.manualTimeout = setTimeout(() => {
            state.isManual = false;
            state.transitionStartTime = Date.now();
        }, CONFIG.MANUAL_TIMEOUT);
    };
    document.addEventListener("mousemove", e => handleInput(e.clientX, e.clientY));
    document.addEventListener("touchstart", e => { if (e.touches.length === 1) handleInput(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    document.addEventListener("touchmove", e => { if (e.touches.length === 1) { e.preventDefault(); handleInput(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    window.addEventListener("resize", () => { clearTimeout(onResize.timeout); onResize.timeout = setTimeout(init, 200); });
}

function updateDebugPanel() {
    if (!state.debugPanel) return;

    const now = Date.now();
    state.frameCount++;
    if (now - state.lastFpsUpdate > 1000) {
        state.fps = state.frameCount;
        state.frameCount = 0;
        state.lastFpsUpdate = now;
    }

    const largestVirus = state.outbreaks.reduce((largest, o) => (!largest || o.radius > largest.radius) ? o : largest, null);

    const buffs = [];
    if (state.cursorBuffs.shieldActive) buffs.push(`Shield (${Math.ceil((state.cursorBuffs.shieldEndTime - now) / 1000)}s)`);
    if (state.cursorBuffs.damageBoostActive) buffs.push(`Damage Boost (${Math.ceil((state.cursorBuffs.damageBoostEndTime - now) / 1000)}s)`);
    if (state.cursorBuffs.blackHoleKillBoostActive) buffs.push(`⚡ EMPOWERED (${Math.ceil((state.cursorBuffs.blackHoleKillBoostEndTime - now) / 1000)}s)`);

    const debugData = {
        time: { elapsed: ((now - state.startTime) / 1000).toFixed(1) + 's' },
        performance: { fps: state.fps, canvasWidth: state.w, canvasHeight: state.h, screenMultiplier: state.screenSizeMultiplier.toFixed(2), isMobile: state.isMobile },
        particles: {
            active: Math.round(state.activeParticleRatio * state.list.length),
            total: state.list.length,
            percentage: (state.activeParticleRatio * 100).toFixed(1),
        },
        cursor: {
            x: state.cursorX.toFixed(1), y: state.cursorY.toFixed(1),
            vx: state.cursorVx.toFixed(2), vy: state.cursorVy.toFixed(2),
            speed: Math.sqrt(state.cursorVx**2 + state.cursorVy**2).toFixed(2),
            radius: (CONFIG.REPULSION_RADIUS * state.radiusMultiplier).toFixed(1),
            mode: state.isManual ? 'Manual' : 'Automatic',
            buffs: buffs,
        },
        viruses: {
            count: state.outbreaks.length,
            nextSpawn: ((state.nextOutbreakTime - now) / 1000).toFixed(1) + 's',
            largest: largestVirus ? {
                health: largestVirus.health.toFixed(0),
                maxHealth: largestVirus.maxHealth.toFixed(0),
                healthPercent: (largestVirus.health / largestVirus.maxHealth * 100).toFixed(0),
                radius: largestVirus.radius.toFixed(1),
            } : null,
        },
        anomalies: { count: state.anomalies.length },
        stations: {
            count: state.stations.length,
            nextSpawn: state.nextStationTime > now ? `${Math.ceil((state.nextStationTime - now) / 1000)}s` : 'Ready',
        },
        gameState: {}
    };

    state.debugPanel.update(debugData);
}

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

window.debugSpawnStation = () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = (0.25 + Math.random() * 0.25) * Math.min(state.w, state.h);
    state.stations.push({
        x: state.centerX + Math.cos(angle) * distance,
        y: state.centerY + Math.sin(angle) * distance,
        driftAngle: Math.random() * Math.PI * 2,
        spawnTime: Date.now(),
        orbitAngle: Math.random() * Math.PI * 2,
        orbitRadius: 12,
        orbitSpeed: 0.03,
        isCapturing: false,
        captureTarget: null,
        captureTime: 0,
    });
};

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
});
