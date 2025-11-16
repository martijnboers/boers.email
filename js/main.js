"use strict";

import { CONFIG } from './config.js';
import { Particle, updateGrowth } from './particle.js';
import { updateOutbreaks, updateAnomalies, updateStations } from './entities.js';
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
    transitionBlend: 0, // 0 = manual, 1 = automatic
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

    // Energy Stations
    stations: [],
    nextStationTime: 0,

    // Active buffs
    cursorBuffs: {
        shieldActive: false,
        shieldEndTime: 0,
        damageBoostActive: false,
        damageBoostEndTime: 0,
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
	const now = Date.now();
	const speedProgress = Math.min(elapsed / CONFIG.CURSOR_SPEED_DURATION, 1);

	// Check if any black hole is large enough to affect 70% of screen
	const screenDiagonal = Math.sqrt(w * w + h * h);
	const requiredCoverage = screenDiagonal * 0.7;
	let hasLargeBlackHole = false;

	for (let i = 0; i < outbreaks.length; i++) {
		const o = outbreaks[i];
		if (o.frame < 360) continue; // Only pull phase

		const pullAge = o.frame - 360;
		const initialProgress = Math.min(pullAge / 1800, 1.0);
		const continuousGrowth = Math.min(pullAge / 5400, 1.2);
		const baseMultiplier =
			CONFIG.OUTBREAK_PULL_RADIUS_MIN +
			(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
				initialProgress;
		const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.67; // Reaches ~4x at 90 seconds
		const pullRadius = o.radius * pullRadiusMultiplier;

		if (pullRadius >= requiredCoverage) {
			hasLargeBlackHole = true;
			break;
		}
	}

	// Disruption wave ability - only available when a massive black hole exists
	if (
		!state.disruptionActive &&
		now >= state.nextDisruptionTime &&
		activeParticleRatio > 0.3 &&
		hasLargeBlackHole
	) {
		state.disruptionActive = true;
		state.disruptionIntensity = 0;
		state.disruptionCenterX = state.cursorX;
		state.disruptionCenterY = state.cursorY;

		// Find highest value target: prioritize maxed viruses, large viruses, or clusters
		let bestTarget = null;
		let bestScore = 0;

		for (let i = 0; i < outbreaks.length; i++) {
			const v = outbreaks[i];
			let score = v.radius * 2; // Base score on size

			// Maxed viruses are high priority
			if (v.maxed) score *= 2.5;

			// Bonus for viruses with high health (harder to kill normally)
			score += (v.health / v.maxHealth) * 50;

			// Bonus for viruses near other viruses (cluster breaking)
			let nearbyCount = 0;
			for (let j = 0; j < outbreaks.length; j++) {
				if (i === j) continue;
				const dx = v.x - outbreaks[j].x;
				const dy = v.y - outbreaks[j].y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < 200) nearbyCount++;
			}
			score += nearbyCount * 30;

			// Penalty for distance from cursor
			const dx = v.x - state.cursorX;
			const dy = v.y - state.cursorY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			score -= dist * 0.05;

			if (score > bestScore) {
				bestScore = score;
				bestTarget = v;
			}
		}

		// Also consider anomalies
		for (let i = 0; i < anomalies.length; i++) {
			const a = anomalies[i];
			let score = 80; // Base score for anomaly

			const dx = a.x - state.cursorX;
			const dy = a.y - state.cursorY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			score -= dist * 0.05;

			if (score > bestScore) {
				bestScore = score;
				bestTarget = a;
			}
		}

		state.disruptionTarget = bestTarget;

		// If target is a virus, find a secondary virus to pull them together
		state.disruptionSecondaryTarget = null;
		if (bestTarget && outbreaks.includes(bestTarget)) {
			let secondBestScore = 0;
			for (let i = 0; i < outbreaks.length; i++) {
				const v = outbreaks[i];
				if (v === bestTarget) continue;

				// Look for viruses relatively close to the target
				const dx = v.x - bestTarget.x;
				const dy = v.y - bestTarget.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < 500 && dist > 80) {
					let score = v.radius * 1.5;
					if (v.maxed) score *= 2.0;
					score += (v.health / v.maxHealth) * 40;
					// Prefer viruses at medium distance for interesting collision
					const distScore = 1.0 - Math.abs(dist - 250) / 250;
					score += distScore * 100;

					if (score > secondBestScore) {
						secondBestScore = score;
						state.disruptionSecondaryTarget = v;
					}
				}
			}
		}

		// Disruption lasts 3 seconds
		setTimeout(() => {
			state.disruptionActive = false;
			state.disruptionTarget = null;
			state.disruptionSecondaryTarget = null;
		}, 3000);

		// Schedule next disruption - charge faster when black hole is dominating
		// Base cooldown: 20 seconds
		let nextDisruptionDelay = 20000;

		// Speed up significantly when black hole is winning
		if (activeParticleRatio < 0.5) {
			// Below 50% particles: black hole is dominating, speed up
			const dominanceFactor = (0.5 - activeParticleRatio) / 0.5; // 0 to 1
			const speedup = dominanceFactor * dominanceFactor * 15000; // Quadratic: up to -15s
			nextDisruptionDelay = Math.max(5000, nextDisruptionDelay - speedup);
		}
		// Above 50% particles: full 20s cooldown

		state.nextDisruptionTime = now + 3000 + nextDisruptionDelay;
	}

	// Smooth disruption intensity ramp
	if (state.disruptionActive) {
		state.disruptionIntensity = Math.min(1.0, state.disruptionIntensity + 0.02);
	} else {
		state.disruptionIntensity = Math.max(0.0, state.disruptionIntensity - 0.015);
	}

	// Smooth speed progression
	const speedValue =
		CONFIG.CURSOR_PATH_SPEED_MIN +
		(CONFIG.CURSOR_PATH_SPEED_MAX - CONFIG.CURSOR_PATH_SPEED_MIN) *
			(speedProgress * speedProgress * speedProgress);

	let speed = speedValue / 100;

	// Apply per-run speed variation
	speed *= state.pathSpeedVariation;

	// Speed scales with particle activity - mobile needs to be faster
	let activityBoost;
	if (isMobile) {
		// Mobile: faster overall for better responsiveness
		if (activeParticleRatio < 0.5) {
			activityBoost = 1.0 + activeParticleRatio * 0.3; // From 1.0 to 1.15
		} else if (activeParticleRatio < 0.7) {
			const midGameFactor = (activeParticleRatio - 0.5) / 0.2;
			activityBoost = 1.15 - midGameFactor * 0.25; // From 1.15 to 0.9
		} else {
			const lateGameFactor = (activeParticleRatio - 0.7) / 0.3;
			activityBoost = 0.9 - lateGameFactor * 0.3; // From 0.9 to 0.6
		}
	} else {
		// Desktop: slower, more methodical
		if (activeParticleRatio < 0.5) {
			activityBoost = 0.7 + activeParticleRatio * 0.3; // From 0.7 to 0.85
		} else if (activeParticleRatio < 0.7) {
			const midGameFactor = (activeParticleRatio - 0.5) / 0.2;
			activityBoost = 0.85 - midGameFactor * 0.25; // From 0.85 to 0.6
		} else {
			const lateGameFactor = (activeParticleRatio - 0.7) / 0.3;
			activityBoost = 0.6 - lateGameFactor * 0.3; // Slow down from 0.6 to 0.3
		}
	}
	speed *= activityBoost;

	// Disruption mode: slow down for strategic, high-damage moments
	if (state.disruptionIntensity > 0.3) {
		const slowdownFactor = 0.6 - state.disruptionIntensity * 0.2; // Down to 0.4x speed (60% slower)
		speed *= slowdownFactor;
	}

	// Random slowdown periods - less on mobile for consistent movement
	if (!isMobile) {
		// Desktop: more frequent slowdown periods for varied pacing
		const slowdownWave = Math.sin(elapsed * 0.0005) * 0.5 + 0.5;
		const slowdownThreshold = 0.4;
		if (slowdownWave < slowdownThreshold) {
			const slowdownIntensity =
				(slowdownThreshold - slowdownWave) / slowdownThreshold;
			speed *= 0.3 + slowdownIntensity * 0.3;
		}

		// Additional slower crawl periods in late game
		if (activeParticleRatio > 0.6) {
			const crawlWave = Math.sin(elapsed * 0.0002) * 0.5 + 0.5;
			if (crawlWave < 0.3) {
				speed *= 0.5;
			}
		}
	} else {
		// Mobile: minimal slowdowns, keep it moving
		const slowdownWave = Math.sin(elapsed * 0.0004) * 0.5 + 0.5;
		if (slowdownWave < 0.2) {
			speed *= 0.7; // Light slowdown only
		}
	}

	// Subtle random speed variations
	const speedNoise =
		Math.sin(elapsed * 0.0007) * 0.15 + Math.sin(elapsed * 0.0013) * 0.1;
	speed *= 1.0 + speedNoise;

	// Black hole kill boost - massive speed increase! (but not during manual control)
	if (cursorBuffs.blackHoleKillBoostActive && !state.isManual) {
		// During transition, blend the speed boost in gradually
		const speedBoostMultiplier = state.transitionBlend < 1.0 ? (1.0 + state.transitionBlend) : 2.0;
		speed *= speedBoostMultiplier; // 1x manual -> 2x fully auto
	}

	// Radius scales with active particles - much smaller in late game for precision
	let particleScaling;
	if (activeParticleRatio < 0.4) {
		// Early game: grows slightly
		const maxScaling = isMobile ? 0.25 : 0.3;
		particleScaling = 1.0 + (activeParticleRatio / 0.4) * maxScaling;
	} else {
		// Late game: shrinks significantly for more precision
		const maxScaling = isMobile ? 0.25 : 0.3;
		const shrinkFactor = (activeParticleRatio - 0.4) / 0.6; // 0 to 1 as we go from 40% to 100%
		particleScaling = 1.0 + maxScaling - shrinkFactor * 0.65; // Shrink from 1.25-1.3 to 0.6-0.65
	}

	// Visual feedback during disruption - cursor grows when charged
	if (state.disruptionIntensity > 0) {
		particleScaling *= 1.0 + state.disruptionIntensity * 0.6; // Up to 60% larger when hunting
	}

	// Dynamic radius pulsing - less dramatic on mobile, more movement-focused
	const basePulseMagnitude = isMobile
		? activeParticleRatio > 0.7
			? 0.15
			: 0.08 // Smaller pulses on mobile
		: activeParticleRatio > 0.7
			? 0.4
			: 0.18; // Dramatic pulses on desktop
	const pulseMagnitude =
		state.disruptionIntensity > 0.3
			? basePulseMagnitude * 2.5 // Much stronger pulse when charged
			: basePulseMagnitude;
	const pulseSpeed = state.disruptionIntensity > 0.3 ? 0.004 : 0.0012; // Slower, more noticeable pulse
	const radiusPulse =
		Math.sin(elapsed * pulseSpeed) * pulseMagnitude +
		Math.sin(elapsed * pulseSpeed * 1.875) * (pulseMagnitude * 0.66) +
		Math.sin(elapsed * pulseSpeed * 0.5) * (pulseMagnitude * 0.4); // Extra slow wave for more variation

	// Update transition blend for smooth manual->auto transition
	if (!state.isManual && state.transitionBlend < 1.0) {
		const transitionDuration = 2500; // 2.5 seconds to fully transition back
		const elapsed = Date.now() - state.transitionStartTime;
		state.transitionBlend = Math.min(elapsed / transitionDuration, 1.0);
	} else if (state.isManual) {
		state.transitionBlend = 0; // Full manual control
	}

	if (!state.isManual) {
		// Normal circular path with subtle variations
		state.pathTime += deltaTime * speed;
		const baseRadius = isMobile ? 0.5 : CONFIG.CURSOR_PATH_RADIUS;
		const radius = baseRadius * state.pathRadiusVariation;

		// Add path wobbles with random phases - more flowing in late game
		const wobbleMagnitude = activeParticleRatio > 0.7 ? 0.12 : 0.08; // Larger, slower wobbles late game
		const wobbleX =
			Math.sin((elapsed + state.wobblePhaseX) * 0.0004) * w * wobbleMagnitude +
			Math.sin((elapsed + state.wobblePhaseX * 2) * 0.0009) *
				w *
				(wobbleMagnitude * 0.625);
		const wobbleY =
			Math.cos((elapsed + state.wobblePhaseY) * 0.0005) * h * wobbleMagnitude +
			Math.cos((elapsed + state.wobblePhaseY * 2) * 0.0011) *
				h *
				(wobbleMagnitude * 0.625);

		let baseTargetX =
			centerX + Math.sin(state.pathTime + state.pathStartOffset) * w * radius + wobbleX;
		let baseTargetY =
			centerY +
			Math.cos((state.pathTime + state.pathStartOffset) * 0.8) * h * radius +
			wobbleY;

		// Subtle attraction to viruses and anomalies - looks like cursor is investigating/searching
		let pullX = 0;
		let pullY = 0;

		// DISRUPTION MODE: Gentle steering toward target (not aggressive)
		if (state.disruptionActive && state.disruptionTarget && state.disruptionIntensity > 0.2) {
			const dx = state.disruptionTarget.x - state.cursorX;
			const dy = state.disruptionTarget.y - state.cursorY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist > 20) {
				// Subtle strategic pull toward target
				const huntStrength = state.disruptionIntensity * 25;
				pullX = (dx / dist) * huntStrength;
				pullY = (dy / dist) * huntStrength;
			}
		} else {
			// Normal mode: very subtle attraction only in early game
			const timeProgress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);

			// Only attract in early game, and much weaker
			if (timeProgress < 0.3) {
				for (let i = 0; i < outbreaks.length; i++) {
					const o = outbreaks[i];
					const dx = o.x - state.cursorX;
					const dy = o.y - state.cursorY;
					const dist = Math.sqrt(dx * dx + dy * dy);

					if (dist < 250 && o.radius > 50) {
						const influence =
							(o.radius / 140) * (1.0 - Math.min(dist / 250, 1.0));
						pullX += (dx / dist) * influence * 4; // Much weaker pull
						pullY += (dy / dist) * influence * 4;
					}
				}
			}
		}

		state.targetX = baseTargetX + pullX;
		state.targetY = baseTargetY + pullY;

		const targetRadius = particleScaling * (1.0 + radiusPulse);
		state.radiusMultiplier += (targetRadius - state.radiusMultiplier) * 0.1;

		// Smooth following with occasional hesitations - more pronounced in late game
		const hesitation = Math.sin(elapsed * 0.0012) * 0.5 + 0.5;
		const lateGameHesitation = activeParticleRatio > 0.7;
		const damping =
			hesitation < 0.2 ? (lateGameHesitation ? 0.97 : 0.95) : 0.88;

		// During transition, reduce movement influence to let cursor gradually resume auto path
		const transitionFactor = state.transitionBlend; // 0 = stay where manual left it, 1 = full auto
		const movementStrength = 0.1 + transitionFactor * 0.1; // 0.1 -> 0.2

		state.cursorVx = (state.targetX - state.cursorX) * movementStrength;
		state.cursorVy = (state.targetY - state.cursorY) * movementStrength;
		state.cursorVx *= damping;
		state.cursorVy *= damping;

		// Black hole gravity - viruses pull the cursor
		// But anomalies provide counter-gravity (strategic gameplay)
		let anomalyShieldStrength = 0;
		for (let i = 0; i < anomalies.length; i++) {
			const a = anomalies[i];
			const adx = a.x - state.cursorX;
			const ady = a.y - state.cursorY;
			const aDist = Math.sqrt(adx * adx + ady * ady);

			// Close to anomaly = reduced gravity pull
			if (aDist < 120) {
				const shieldFactor = 1.0 - aDist / 120;
				anomalyShieldStrength = Math.max(
					anomalyShieldStrength,
					shieldFactor * 0.7,
				); // Up to 70% reduction
			}
		}

		// Energy station shield buff
		if (cursorBuffs.shieldActive) {
			anomalyShieldStrength = Math.max(anomalyShieldStrength, 0.5); // 50% gravity reduction
		}

		for (let i = 0; i < outbreaks.length; i++) {
			const o = outbreaks[i];
			if (o.frame < 360) continue; // Only pull phase

			const dx = o.x - state.cursorX;
			const dy = o.y - state.cursorY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Calculate pull radius (same as particle system)
			const pullAge = o.frame - 360;
			const initialProgress = Math.min(pullAge / 1200, 1.0);
			const continuousGrowth = Math.min(pullAge / 3600, 1.5);
			const baseMultiplier =
				CONFIG.OUTBREAK_PULL_RADIUS_MIN +
				(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
					initialProgress;
			const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.5;
			const pullRadius = o.radius * pullRadiusMultiplier;

			if (dist < pullRadius && dist > 30) {
				let pullStrength = Math.min(pullAge / 600, 1.0) * 0.4;
				pullStrength *= 1.0 + continuousGrowth * 0.5;
				const distanceFactor = 1.0 - Math.min(dist / pullRadius, 1.0);
				const gravityForce =
					pullStrength *
					(1.0 + distanceFactor * 1.0) *
					(1.0 - anomalyShieldStrength);

				state.cursorVx += (dx / dist) * gravityForce;
				state.cursorVy += (dy / dist) * gravityForce;
			}
		}

		state.cursorX += state.cursorVx;
		state.cursorY += state.cursorVy;
	} else {
		// Manual control
		const dx = state.targetX - state.cursorX;
		const dy = state.targetY - state.cursorY;

		state.cursorVx += dx * CONFIG.CURSOR_SPRING;
		state.cursorVy += dy * CONFIG.CURSOR_SPRING;
		state.cursorVx *= CONFIG.CURSOR_DAMPING;
		state.cursorVy *= CONFIG.CURSOR_DAMPING;

		// Black hole gravity - viruses pull the cursor
		// But anomalies provide counter-gravity (strategic gameplay)
		let anomalyShieldStrength = 0;
		for (let i = 0; i < anomalies.length; i++) {
			const a = anomalies[i];
			const adx = a.x - state.cursorX;
			const ady = a.y - state.cursorY;
			const aDist = Math.sqrt(adx * adx + ady * ady);

			// Close to anomaly = reduced gravity pull
			if (aDist < 120) {
				const shieldFactor = 1.0 - aDist / 120;
				anomalyShieldStrength = Math.max(
					anomalyShieldStrength,
					shieldFactor * 0.7,
				); // Up to 70% reduction
			}
		}

		// Energy station shield buff
		if (cursorBuffs.shieldActive) {
			anomalyShieldStrength = Math.max(anomalyShieldStrength, 0.5); // 50% gravity reduction
		}

		for (let i = 0; i < outbreaks.length; i++) {
			const o = outbreaks[i];
			if (o.frame < 360) continue; // Only pull phase

			const dx = o.x - state.cursorX;
			const dy = o.y - state.cursorY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Calculate pull radius (same as particle system)
			const pullAge = o.frame - 360;
			const initialProgress = Math.min(pullAge / 1200, 1.0);
			const continuousGrowth = Math.min(pullAge / 3600, 1.5);
			const baseMultiplier =
				CONFIG.OUTBREAK_PULL_RADIUS_MIN +
				(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
					initialProgress;
			const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.5;
			const pullRadius = o.radius * pullRadiusMultiplier;

			if (dist < pullRadius && dist > 30) {
				let pullStrength = Math.min(pullAge / 600, 1.0) * 0.5;
				pullStrength *= 1.0 + continuousGrowth * 0.5;
				const distanceFactor = 1.0 - Math.min(dist / pullRadius, 1.0);
				const gravityForce =
					pullStrength *
					(1.0 + distanceFactor * 1.2) *
					(1.0 - anomalyShieldStrength);

				state.cursorVx += (dx / dist) * gravityForce;
				state.cursorVy += (dy / dist) * gravityForce;
			}
		}

		state.cursorX += state.cursorVx;
		state.cursorY += state.cursorVy;

		const targetRadius = particleScaling * (1.0 + radiusPulse);
		state.radiusMultiplier += (targetRadius - state.radiusMultiplier) * 0.1;
	}
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
		if (p.active && p.x > 0 && p.x < w && p.y > 0 && p.y < h) {
			const index = (Math.floor(p.y) * w + Math.floor(p.x));
			state.imageDataBuffer[index] = (255 << 24) | (CONFIG.COLOR << 16) | (CONFIG.COLOR << 8) | CONFIG.COLOR;
		}
	}

	ctx.putImageData(state.imageData, 0, 0);

	// Draw cursor buffs
	const now = Date.now();
	const manualReduction = state.isManual ? 0.3 : 1.0;

	if (cursorBuffs.shieldActive) {
		const pulse = Math.sin(now * 0.008) * 0.5 + 0.5;
		const radius = CONFIG.REPULSION_RADIUS * radiusMultiplier * (1.0 + 0.8 * manualReduction);
		ctx.beginPath();
		ctx.strokeStyle = `rgba(0, 255, 0, ${0.2 + pulse * 0.3})`;
		ctx.lineWidth = 1 + pulse * 2;
		ctx.arc(cursorX, cursorY, radius, 0, Math.PI * 2);
		ctx.stroke();
	}

	if (cursorBuffs.damageBoostActive) {
		const pulse = Math.sin(now * 0.014) * 0.5 + 0.5;
		const radius = CONFIG.REPULSION_RADIUS * radiusMultiplier * (1.0 + 1.0 * manualReduction);
		ctx.beginPath();
		ctx.strokeStyle = `rgba(255, 100, 0, ${0.2 + pulse * 0.4})`;
		ctx.lineWidth = 2 + pulse * 3;
		ctx.arc(cursorX, cursorY, radius, 0, Math.PI * 2);
		ctx.stroke();
	}

	if (cursorBuffs.blackHoleKillBoostActive) {
		const pulse = Math.sin(now * 0.018) * 0.5 + 0.5;
		const radius = CONFIG.REPULSION_RADIUS * radiusMultiplier * (1.0 + 1.5 * manualReduction);
		ctx.beginPath();
		ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + pulse * 0.5})`;
		ctx.lineWidth = 3 + pulse * 4;
		ctx.arc(cursorX, cursorY, radius, 0, Math.PI * 2);
		ctx.stroke();
	}
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
		updateStations(state);

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

	state.cursorX = state.targetX = state.centerX;
	state.cursorY = state.targetY = state.centerY;

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
	state.nextStationTime = state.startTime + CONFIG.STATION_SPAWN_MIN;
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
    // ... implementation to be added
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

window.debugSpawnStation = () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100;
    state.stations.push({
        x: state.cursorX + Math.cos(angle) * distance,
        y: state.cursorY + Math.sin(angle) * distance,
        driftAngle: Math.random() * Math.PI * 2,
        frame: 0, spawnTime: Date.now(), captured: false,
        ripples: [], nextRippleTime: Date.now() + 1000
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
