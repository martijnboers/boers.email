"use strict";

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
	// Particle grid
	SPACING_MOBILE: 5.0,
	SPACING_DESKTOP: 6.5,
	COLOR: 220,

	// Particle physics
	PARTICLE_DRAG: 0.92,
	PARTICLE_EASE: 0.35,
	REPULSION_RADIUS: 80,
	REPULSION_STRENGTH: 1.0,
	SPIRAL_STRENGTH_BASE: 0.3,
	SPIRAL_TIGHTENING_RATE: 0.00015,

	// Cursor movement
	CURSOR_PATH_SPEED_MIN: 100,
	CURSOR_PATH_SPEED_MAX: 155,
	CURSOR_PATH_RADIUS: 0.45,
	CURSOR_SPEED_DURATION: 30000,
	CURSOR_SPRING: 0.35,
	CURSOR_DAMPING: 0.7,
	MANUAL_TIMEOUT: 2000,

	// Growth animation
	GROWTH_DURATION: 180000, // 3 minutes
	GROWTH_START_RADIUS: 0.08,

	// Virus outbreaks
	OUTBREAK_SPAWN_MIN: 35000,
	OUTBREAK_SPAWN_MAX: 18000,
	OUTBREAK_SPAWN_MIN_MOBILE: 40000,
	OUTBREAK_SPAWN_MAX_MOBILE: 22000,
	OUTBREAK_GROWTH_RATE: 0.4,
	OUTBREAK_GROWTH_RATE_MOBILE: 0.35,
	OUTBREAK_MAX_RADIUS: 140,
	OUTBREAK_MAX_RADIUS_MOBILE: 120,
	OUTBREAK_KILL_RADIUS: 50,
	OUTBREAK_DAMAGE_RADIUS: 100,
	OUTBREAK_DISSOLVE_RADIUS: 25,
	OUTBREAK_PULL_RADIUS_MIN: 0.5, // Start pulling at 50% of virus size
	OUTBREAK_PULL_RADIUS_MAX: 2.5, // Can pull up to 2.5x virus size

	// Anomalies
	ANOMALY_SPAWN_MIN: 12000,
	ANOMALY_SPAWN_MAX: 20000,
	ANOMALY_SPAWN_MIN_MOBILE: 25000,
	ANOMALY_SPAWN_MAX_MOBILE: 40000,
	ANOMALY_ORBIT_RADIUS: 40,
	ANOMALY_ORBIT_SPEED: 0.02,
	ANOMALY_DRIFT_SPEED: 0.3,
	ANOMALY_VORTEX_RADIUS: 60,
	ANOMALY_VORTEX_STRENGTH: 0.8,
	ANOMALY_DISSOLVE_RADIUS: 20,

	// Synergy between anomalies and viruses
	SYNERGY_RANGE: 100, // Distance for synergy effects
	SYNERGY_VORTEX_BOOST: 1.6, // Anomaly vortex becomes much stronger near virus
	SYNERGY_GROWTH_BOOST: 1.8, // Virus grows faster near anomaly
	SYNERGY_REGEN_BOOST: 3.0, // Virus regenerates faster near anomaly
	SYNERGY_PROTECTION: 0.5, // Virus takes less damage near anomaly
};

// ============================================================================
// STATE
// ============================================================================
let container, canvas, ctx;
let list = [];
let w, h, centerX, centerY;
let isMobile = false;

// Cursor state
let cursorX, cursorY;
let cursorVx = 0,
	cursorVy = 0;
let targetX, targetY;
let pathTime = 0;
let isManual = false;
let manualTimeout = null;
let radiusMultiplier = 1.0;

// Random variation per run
let pathRadiusVariation = 0;
let pathSpeedVariation = 0;
let pathStartOffset = 0;
let wobblePhaseX = 0;
let wobblePhaseY = 0;

// Disruption wave ability
let disruptionActive = false;
let disruptionIntensity = 0;
let disruptionCenterX = 0;
let disruptionCenterY = 0;
let disruptionTarget = null;
let disruptionSecondaryTarget = null;
let nextDisruptionTime = 0;

// Virus outbreaks
let outbreaks = [];
let nextOutbreakTime = 0;

// Anomalies
let anomalies = [];
let nextAnomalyTime = 0;

// Animation state
let startTime;
let lastFrameTime;
let frameToggle = true;
let maxParticleDistance = 0;
let activeParticleRatio = 0;

// Reusable image buffer
let imageData = null;
let imageDataBuffer = null;

// Debug menu
let debugEnabled = false;
let debugElement = null;

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================
class Particle {
	constructor(x, y, centerX, centerY) {
		this.x = x;
		this.y = y;
		this.ox = x;
		this.oy = y;
		this.vx = 0;
		this.vy = 0;

		const dx = x - centerX;
		const dy = y - centerY;
		this.distFromCenter = Math.sqrt(dx * dx + dy * dy);
		this.angle = Math.atan2(dy, dx);

		this.active = false;
		this.growthOffset = Math.random() * 0.15; // Random variation per particle

		// Organic behavior traits
		this.nervousness = 0.8 + Math.random() * 0.4;
		this.awareness = Math.random() * 40 + 25;
	}

	update(
		cursorX,
		cursorY,
		radiusMult,
		spiralStrength,
		outbreaks,
		anomalies,
		cursorVx,
		cursorVy,
	) {
		if (!this.active) return;

		const dx = cursorX - this.x;
		const dy = cursorY - this.y;
		const distSq = dx * dx + dy * dy;
		const dist = Math.sqrt(distSq);

		const dynamicRadiusSq =
			CONFIG.REPULSION_RADIUS *
			CONFIG.REPULSION_RADIUS *
			radiusMult *
			radiusMult;

		// Anticipation - particles sense fast-moving cursor
		const awarenessRadiusSq =
			(this.awareness + Math.sqrt(dynamicRadiusSq)) ** 2;
		if (distSq < awarenessRadiusSq && dist > Math.sqrt(dynamicRadiusSq)) {
			const cursorSpeed = Math.sqrt(cursorVx * cursorVx + cursorVy * cursorVy);
			if (cursorSpeed > 1.5) {
				const cursorDirX = cursorVx / cursorSpeed;
				const cursorDirY = cursorVy / cursorSpeed;
				const toParticleX = -dx / dist;
				const toParticleY = -dy / dist;
				const alignmentDot =
					cursorDirX * toParticleX + cursorDirY * toParticleY;

				if (alignmentDot > 0.4) {
					const anticipationForce = alignmentDot * 0.2 * this.nervousness;
					this.vx -= anticipationForce * cursorDirX;
					this.vy -= anticipationForce * cursorDirY;
				}
			}
		}

		// Cursor repulsion with spiral
		if (distSq < dynamicRadiusSq) {
			const safeDist = Math.max(distSq, 1);
			const baseForce =
				(-dynamicRadiusSq / safeDist) * CONFIG.REPULSION_STRENGTH;
			const force = baseForce * this.nervousness;
			const angle = Math.atan2(dy, dx);

			this.vx += force * Math.cos(angle);
			this.vy += force * Math.sin(angle);

			const tangentialAngle = angle + Math.PI / 2;
			const spiralForce =
				(force * spiralStrength * dist) / Math.sqrt(dynamicRadiusSq);
			this.vx += spiralForce * Math.cos(tangentialAngle);
			this.vy += spiralForce * Math.sin(tangentialAngle);
		}

		// Outbreak forces with organic morphing
		for (let i = 0; i < outbreaks.length; i++) {
			const o = outbreaks[i];
			const odx = this.x - o.x;
			const ody = this.y - o.y;
			const oDistSq = odx * odx + ody * ody;
			const oDist = Math.sqrt(oDistSq);

			// Subtle organic growth variation (not heavy breathing)
			const morphPulse =
				Math.sin(o.frame * 0.05) * 0.05 +
				Math.sin(o.frame * 0.02 + this.angle * 2) * 0.04 +
				1.0;

			// Asymmetric tentacle-like directional variations
			const angleToParticle = Math.atan2(ody, odx);
			const tentacleVariation =
				Math.sin(angleToParticle * 3 + o.frame * 0.03) * 0.08 +
				Math.cos(angleToParticle * 5 - o.frame * 0.04) * 0.06;

			const organicRadius = o.radius * morphPulse * (1.0 + tentacleVariation);
			const currentRadiusSq = organicRadius ** 2;

			if (o.frame < 360) {
				// Push phase - growing organism expanding (longer: 360 frames = 6 seconds)
				const edgeThickness = 18;
				const innerRadiusSq = Math.max(0, organicRadius - edgeThickness) ** 2;

				if (oDistSq < currentRadiusSq && oDistSq > innerRadiusSq) {
					const edgePos =
						(oDist - (organicRadius - edgeThickness)) / edgeThickness;
					const force = (1.0 - edgePos) * 2.0;
					const angle = Math.atan2(ody, odx);
					this.vx += force * Math.cos(angle);
					this.vy += force * Math.sin(angle);
				}
			} else {
				// Pull phase - death black hole effect with slow, continuous growth
				const pullAge = o.frame - 360;

				// Very slow progression - takes 20 seconds to reach initial full power
				const initialProgress = Math.min(pullAge / 1200, 1.0);

				// Then continues growing indefinitely but more slowly
				const continuousGrowth = Math.min(pullAge / 3600, 1.5); // Up to 2.5x over 60 seconds

				// Pull radius grows from 50% to 250%, then up to 400% over time
				const baseMultiplier =
					CONFIG.OUTBREAK_PULL_RADIUS_MIN +
					(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
						initialProgress;
				const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.5;
				const pullRadius = organicRadius * pullRadiusMultiplier;
				const pullRadiusSq = pullRadius * pullRadius;

				if (oDistSq < pullRadiusSq) {
					// Very slow strength ramp-up, then continues growing
					let pullStrength = Math.min(pullAge / 600, 1.0) * 1.2; // Takes 10 seconds to reach base strength
					pullStrength *= 1.0 + continuousGrowth * 0.5; // Continues growing stronger

					// Black holes benefit from lack of particles - stronger in late game
					const particleBonus = 1.0 + (1.0 - activeParticleRatio) * 0.8;
					pullStrength *= particleBonus;

					// Black hole effect - stronger pull near center (inverse square)
					const distanceFactor = 1.0 - Math.min(oDist / pullRadius, 1.0);
					const blackHoleForce = pullStrength * (1.0 + distanceFactor * 1.4);

					const angle = Math.atan2(ody, odx);
					this.vx -= blackHoleForce * Math.cos(angle);
					this.vy -= blackHoleForce * Math.sin(angle);
				}
			}
		}

		// Anomaly spiral vortex forces
		for (let i = 0; i < anomalies.length; i++) {
			const a = anomalies[i];
			const adx = this.x - a.x;
			const ady = this.y - a.y;
			const aDistSq = adx * adx + ady * ady;
			const aDist = Math.sqrt(aDistSq);

			// Use anomaly's grown vortex radius and strength
			const vortexRadius = a.vortexRadius || CONFIG.ANOMALY_VORTEX_RADIUS;
			const baseStrength = a.vortexStrength || CONFIG.ANOMALY_VORTEX_STRENGTH;

			if (aDist < vortexRadius) {
				const falloff = 1.0 - aDist / vortexRadius;
				let vortexStrength = baseStrength * falloff;

				// SYNERGY: Check if anomaly is near any virus
				for (let j = 0; j < outbreaks.length; j++) {
					const v = outbreaks[j];
					const vdx = v.x - a.x;
					const vdy = v.y - a.y;
					const vDist = Math.sqrt(vdx * vdx + vdy * vdy);
					if (vDist < CONFIG.SYNERGY_RANGE) {
						// Vortex becomes stronger - maxed viruses provide even more boost
						const boost = v.maxed
							? CONFIG.SYNERGY_VORTEX_BOOST * 1.4
							: CONFIG.SYNERGY_VORTEX_BOOST;
						vortexStrength *= boost;
						break;
					}
				}

				// Radial component (slight pull toward anomaly)
				const pullStrength = vortexStrength * 0.3;
				const angleToAnomaly = Math.atan2(ady, adx);
				this.vx -= pullStrength * Math.cos(angleToAnomaly);
				this.vy -= pullStrength * Math.sin(angleToAnomaly);

				// Tangential component (spiral rotation)
				const tangentialAngle = angleToAnomaly + Math.PI / 2;
				const spiralForce = vortexStrength * 1.2;
				this.vx += spiralForce * Math.cos(tangentialAngle);
				this.vy += spiralForce * Math.sin(tangentialAngle);
			}
		}

		this.vx *= CONFIG.PARTICLE_DRAG;
		this.vy *= CONFIG.PARTICLE_DRAG;
		this.x += this.vx + (this.ox - this.x) * CONFIG.PARTICLE_EASE;
		this.y += this.vy + (this.oy - this.y) * CONFIG.PARTICLE_EASE;
	}
}

// ============================================================================
// CURSOR SYSTEM
// ============================================================================
function updateCursor(deltaTime) {
	const elapsed = Date.now() - startTime;
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
		const initialProgress = Math.min(pullAge / 1200, 1.0);
		const continuousGrowth = Math.min(pullAge / 3600, 1.5);
		const baseMultiplier =
			CONFIG.OUTBREAK_PULL_RADIUS_MIN +
			(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
				initialProgress;
		const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.5;
		const pullRadius = o.radius * pullRadiusMultiplier;

		if (pullRadius >= requiredCoverage) {
			hasLargeBlackHole = true;
			break;
		}
	}

	// Disruption wave ability - only available when a massive black hole exists
	if (
		!disruptionActive &&
		now >= nextDisruptionTime &&
		activeParticleRatio > 0.3 &&
		hasLargeBlackHole
	) {
		disruptionActive = true;
		disruptionIntensity = 0;
		disruptionCenterX = cursorX;
		disruptionCenterY = cursorY;

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
			const dx = v.x - cursorX;
			const dy = v.y - cursorY;
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

			const dx = a.x - cursorX;
			const dy = a.y - cursorY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			score -= dist * 0.05;

			if (score > bestScore) {
				bestScore = score;
				bestTarget = a;
			}
		}

		disruptionTarget = bestTarget;

		// If target is a virus, find a secondary virus to pull them together
		disruptionSecondaryTarget = null;
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
						disruptionSecondaryTarget = v;
					}
				}
			}
		}

		// Disruption lasts 3 seconds
		setTimeout(() => {
			disruptionActive = false;
			disruptionTarget = null;
			disruptionSecondaryTarget = null;
		}, 3000);

		// Schedule next disruption - more frequent late game when needed
		const nextDisruptionDelay =
			activeParticleRatio < 0.7
				? 12000 + Math.random() * 15000 // 12-27 seconds early game
				: 8000 + Math.random() * 12000; // 8-20 seconds late game
		nextDisruptionTime = now + 3000 + nextDisruptionDelay;
	}

	// Smooth disruption intensity ramp
	if (disruptionActive) {
		disruptionIntensity = Math.min(1.0, disruptionIntensity + 0.02);
	} else {
		disruptionIntensity = Math.max(0.0, disruptionIntensity - 0.015);
	}

	// Smooth speed progression
	const speedValue =
		CONFIG.CURSOR_PATH_SPEED_MIN +
		(CONFIG.CURSOR_PATH_SPEED_MAX - CONFIG.CURSOR_PATH_SPEED_MIN) *
			(speedProgress * speedProgress * speedProgress);

	let speed = speedValue / 100;

	// Apply per-run speed variation
	speed *= pathSpeedVariation;

	// Speed scales with particle activity - slower overall
	let activityBoost;
	if (activeParticleRatio < 0.7) {
		// Early/mid game: moderate speed
		activityBoost = 0.8 + activeParticleRatio * 0.4; // From 0.8 to 1.08
	} else {
		// Late game: even slower, more deliberate
		const lateGameFactor = (activeParticleRatio - 0.7) / 0.3;
		activityBoost = 1.08 - lateGameFactor * 0.45; // Slow down from 1.08 to 0.63
	}
	speed *= activityBoost;

	// Disruption mode: slow down for strategic, high-damage moments
	if (disruptionIntensity > 0.3) {
		const slowdownFactor = 0.6 - disruptionIntensity * 0.2; // Down to 0.4x speed (60% slower)
		speed *= slowdownFactor;
	}

	// Random slowdown periods
	const slowdownWave = Math.sin(elapsed * 0.0003) * 0.5 + 0.5;
	const slowdownThreshold = 0.25;
	if (slowdownWave < slowdownThreshold) {
		const slowdownIntensity =
			(slowdownThreshold - slowdownWave) / slowdownThreshold;
		speed *= 0.4 + slowdownIntensity * 0.4;
	}

	// Subtle random speed variations
	const speedNoise =
		Math.sin(elapsed * 0.0007) * 0.15 + Math.sin(elapsed * 0.0013) * 0.1;
	speed *= 1.0 + speedNoise;

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
	if (disruptionIntensity > 0) {
		particleScaling *= 1.0 + disruptionIntensity * 0.6; // Up to 60% larger when hunting
	}

	// Dynamic radius pulsing - dramatic during disruption
	const basePulseMagnitude = activeParticleRatio > 0.7 ? 0.25 : 0.12;
	const pulseMagnitude =
		disruptionIntensity > 0.3
			? basePulseMagnitude * 2.5 // Much stronger pulse when charged
			: basePulseMagnitude;
	const pulseSpeed = disruptionIntensity > 0.3 ? 0.004 : 0.0008; // 5x faster pulse
	const radiusPulse =
		Math.sin(elapsed * pulseSpeed) * pulseMagnitude +
		Math.sin(elapsed * pulseSpeed * 1.875) * (pulseMagnitude * 0.66);

	if (!isManual) {
		// Normal circular path with subtle variations
		pathTime += deltaTime * speed;
		const baseRadius = isMobile ? 0.5 : CONFIG.CURSOR_PATH_RADIUS;
		const radius = baseRadius * pathRadiusVariation;

		// Add path wobbles with random phases - more flowing in late game
		const wobbleMagnitude = activeParticleRatio > 0.7 ? 0.12 : 0.08; // Larger, slower wobbles late game
		const wobbleX =
			Math.sin((elapsed + wobblePhaseX) * 0.0004) * w * wobbleMagnitude +
			Math.sin((elapsed + wobblePhaseX * 2) * 0.0009) *
				w *
				(wobbleMagnitude * 0.625);
		const wobbleY =
			Math.cos((elapsed + wobblePhaseY) * 0.0005) * h * wobbleMagnitude +
			Math.cos((elapsed + wobblePhaseY * 2) * 0.0011) *
				h *
				(wobbleMagnitude * 0.625);

		let baseTargetX =
			centerX + Math.sin(pathTime + pathStartOffset) * w * radius + wobbleX;
		let baseTargetY =
			centerY +
			Math.cos((pathTime + pathStartOffset) * 0.8) * h * radius +
			wobbleY;

		// Subtle attraction to viruses and anomalies - looks like cursor is investigating/searching
		let pullX = 0;
		let pullY = 0;

		// DISRUPTION MODE: Gentle steering toward target (not aggressive)
		if (disruptionActive && disruptionTarget && disruptionIntensity > 0.2) {
			const dx = disruptionTarget.x - cursorX;
			const dy = disruptionTarget.y - cursorY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist > 20) {
				// Subtle strategic pull toward target
				const huntStrength = disruptionIntensity * 25;
				pullX = (dx / dist) * huntStrength;
				pullY = (dy / dist) * huntStrength;
			}
		} else {
			// Normal mode: subtle attraction
			const timeProgress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);
			const earlyGameBoost = timeProgress < 0.3 ? 1.8 : 1.0;

			for (let i = 0; i < outbreaks.length; i++) {
				const o = outbreaks[i];
				const dx = o.x - cursorX;
				const dy = o.y - cursorY;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < 300 && o.radius > 40) {
					const influence =
						(o.radius / 140) * (1.0 - Math.min(dist / 300, 1.0));
					pullX += (dx / dist) * influence * 10 * earlyGameBoost;
					pullY += (dy / dist) * influence * 10 * earlyGameBoost;
				}
			}

			for (let i = 0; i < anomalies.length; i++) {
				const a = anomalies[i];
				const dx = a.x - cursorX;
				const dy = a.y - cursorY;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < 250) {
					const influence = 1.0 - Math.min(dist / 250, 1.0);
					pullX += (dx / dist) * influence * 12 * earlyGameBoost;
					pullY += (dy / dist) * influence * 12 * earlyGameBoost;
				}
			}
		}

		targetX = baseTargetX + pullX;
		targetY = baseTargetY + pullY;

		const targetRadius = particleScaling * (1.0 + radiusPulse);
		radiusMultiplier += (targetRadius - radiusMultiplier) * 0.1;

		// Smooth following with occasional hesitations - more pronounced in late game
		const hesitation = Math.sin(elapsed * 0.0012) * 0.5 + 0.5;
		const lateGameHesitation = activeParticleRatio > 0.7;
		const damping =
			hesitation < 0.2 ? (lateGameHesitation ? 0.97 : 0.95) : 0.88;

		cursorVx = (targetX - cursorX) * 0.2;
		cursorVy = (targetY - cursorY) * 0.2;
		cursorVx *= damping;
		cursorVy *= damping;

		// Black hole gravity - viruses pull the cursor
		// But anomalies provide counter-gravity (strategic gameplay)
		let anomalyShieldStrength = 0;
		for (let i = 0; i < anomalies.length; i++) {
			const a = anomalies[i];
			const adx = a.x - cursorX;
			const ady = a.y - cursorY;
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

		for (let i = 0; i < outbreaks.length; i++) {
			const o = outbreaks[i];
			if (o.frame < 360) continue; // Only pull phase

			const dx = o.x - cursorX;
			const dy = o.y - cursorY;
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

				cursorVx += (dx / dist) * gravityForce;
				cursorVy += (dy / dist) * gravityForce;
			}
		}

		cursorX += cursorVx;
		cursorY += cursorVy;
	} else {
		// Manual control
		const dx = targetX - cursorX;
		const dy = targetY - cursorY;

		cursorVx += dx * CONFIG.CURSOR_SPRING;
		cursorVy += dy * CONFIG.CURSOR_SPRING;
		cursorVx *= CONFIG.CURSOR_DAMPING;
		cursorVy *= CONFIG.CURSOR_DAMPING;

		// Black hole gravity - viruses pull the cursor
		// But anomalies provide counter-gravity (strategic gameplay)
		let anomalyShieldStrength = 0;
		for (let i = 0; i < anomalies.length; i++) {
			const a = anomalies[i];
			const adx = a.x - cursorX;
			const ady = a.y - cursorY;
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

		for (let i = 0; i < outbreaks.length; i++) {
			const o = outbreaks[i];
			if (o.frame < 360) continue; // Only pull phase

			const dx = o.x - cursorX;
			const dy = o.y - cursorY;
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

				cursorVx += (dx / dist) * gravityForce;
				cursorVy += (dy / dist) * gravityForce;
			}
		}

		cursorX += cursorVx;
		cursorY += cursorVy;

		const targetRadius = particleScaling * (1.0 + radiusPulse);
		radiusMultiplier += (targetRadius - radiusMultiplier) * 0.1;
	}
}

// ============================================================================
// GROWTH SYSTEM
// ============================================================================
function updateGrowth() {
	const elapsed = Date.now() - startTime;
	const progress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);

	// Random target shrink amount (40-60%), calculated once at start
	if (!window._shrinkTarget) {
		window._shrinkTarget = 0.4 + Math.random() * 0.2; // 40% to 60%
	}

	let radiusProgress;
	if (progress < 0.6) {
		// First phase: grow from 8% to 68% (0-60% of duration, quicker than before)
		const growthProgress = progress / 0.6;
		const easedProgress = 1 - Math.pow(1 - growthProgress, 3);
		radiusProgress = CONFIG.GROWTH_START_RADIUS + easedProgress * (0.68 - CONFIG.GROWTH_START_RADIUS);
	} else {
		// Second phase: shrink from 68% to random target (60-100% of duration)
		const shrinkProgress = (progress - 0.6) / 0.4;
		const easedShrink = shrinkProgress * shrinkProgress; // Ease in for shrinking
		const shrinkAmount = 0.68 - window._shrinkTarget;
		radiusProgress = 0.68 - easedShrink * shrinkAmount; // From 68% to 40-60%
	}

	const baseThreshold = maxParticleDistance * radiusProgress;

	// Organic growth with sine waves for virus-like asymmetry
	const time = elapsed * 0.001;

	let activeCount = 0;
	for (let i = 0; i < list.length; i++) {
		const p = list[i];

		const directionalGrowth =
			Math.sin(p.angle * 3 + time * 0.5) * 0.15 +
			Math.sin(p.angle * 5 - time * 0.8) * 0.1 +
			Math.sin(p.angle * 7 + time * 1.2) * 0.08 +
			Math.sin(time * 2.0 + p.angle) * 0.12;

		const threshold = baseThreshold * (1 + directionalGrowth + p.growthOffset);
		p.active = p.distFromCenter <= threshold;
		if (p.active) activeCount++;
	}

	activeParticleRatio = activeCount / list.length;
}

// ============================================================================
// OUTBREAK SYSTEM
// ============================================================================
function updateOutbreaks() {
	const now = Date.now();
	const elapsed = now - startTime;

	// Spawn with increasing frequency but with variation
	const spawnThreshold = isMobile ? 0.15 : 0.1;

	if (now >= nextOutbreakTime && activeParticleRatio > spawnThreshold) {
		// Create "losing" periods where spawning is suppressed
		const losingWave = Math.sin(elapsed * 0.00015) * 0.5 + 0.5;
		const isLosingPeriod = losingWave < 0.3;

		// Random chance to skip spawning during losing periods
		const shouldSpawn = !isLosingPeriod || Math.random() < 0.25;

		if (shouldSpawn) {
			const angle = Math.random() * Math.PI * 2;

			// More varied spawn distances - sometimes close, sometimes far
			let distance;
			if (Math.random() < 0.3) {
				// 30% chance: spawn close to center
				distance = (0.08 + Math.random() * 0.15) * Math.min(w, h);
			} else if (Math.random() < 0.5) {
				// 35% chance: spawn medium distance
				distance = (0.2 + Math.random() * 0.2) * Math.min(w, h);
			} else {
				// 35% chance: spawn far out
				distance = (0.35 + Math.random() * 0.2) * Math.min(w, h);
			}

			// Randomize initial virus size - increases over time
			const timeProgress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);
			const sizeBoost = timeProgress * 4; // Up to +4 pixels over time
			const initialRadius = isMobile
				? 5 + Math.random() * 3 + sizeBoost // 5-12 pixels
				: 6 + Math.random() * 4 + sizeBoost; // 6-14 pixels

			// Health increases over time - much higher to allow reaching 70% screen coverage
			const healthBoost = timeProgress * 200; // Up to +200 health
			const initialHealth = 200 + healthBoost; // 200-400 health

			outbreaks.push({
				x: centerX + Math.cos(angle) * distance,
				y: centerY + Math.sin(angle) * distance,
				vx: 0,
				vy: 0,
				radius: initialRadius,
				frame: 0,
				health: initialHealth,
				maxHealth: initialHealth,
				threatened: false,
				everTouched: false,
			});
		}

		// More varied spawn intervals
		const spawnMin = isMobile
			? CONFIG.OUTBREAK_SPAWN_MIN_MOBILE
			: CONFIG.OUTBREAK_SPAWN_MIN;
		const spawnMax = isMobile
			? CONFIG.OUTBREAK_SPAWN_MAX_MOBILE
			: CONFIG.OUTBREAK_SPAWN_MAX;
		const baseInterval = spawnMin - activeParticleRatio * (spawnMin - spawnMax);

		// Add randomness: 50% to 150% of base interval
		const variationFactor = 0.5 + Math.random() * 1.0;
		const spawnInterval = baseInterval * variationFactor;

		nextOutbreakTime = now + spawnInterval;
	}

	// Update outbreaks
	outbreaks = outbreaks.filter((o) => {
		o.frame++;

		const dx = cursorX - o.x;
		const dy = cursorY - o.y;
		const distToCursor = Math.sqrt(dx * dx + dy * dy);

		// Instant dissolution when passing directly through center
		if (distToCursor < CONFIG.OUTBREAK_DISSOLVE_RADIUS) {
			return false; // Remove immediately
		}

		// SYNERGY: Check if anomaly or maxed virus is nearby
		// VULNERABILITY: Marked targets lose support bonuses
		let hasAnomalySupport = false;
		let hasMaxedVirusSupport = false;
		const isVulnerable =
			(disruptionTarget === o || disruptionSecondaryTarget === o) &&
			disruptionIntensity > 0.3;

		if (!isVulnerable) {
			for (let i = 0; i < anomalies.length; i++) {
				const a = anomalies[i];
				const adx = a.x - o.x;
				const ady = a.y - o.y;
				const aDist = Math.sqrt(adx * adx + ady * ady);
				if (aDist < CONFIG.SYNERGY_RANGE) {
					hasAnomalySupport = true;
					break;
				}
			}
			// Maxed viruses also provide support to nearby viruses
			if (!hasAnomalySupport) {
				for (let i = 0; i < outbreaks.length; i++) {
					const other = outbreaks[i];
					if (other === o || !other.maxed) continue;
					const odx = other.x - o.x;
					const ody = other.y - o.y;
					const oDist = Math.sqrt(odx * odx + ody * ody);
					if (oDist < CONFIG.SYNERGY_RANGE * 0.8) {
						hasMaxedVirusSupport = true;
						break;
					}
				}
			}
		}

		// Damage system - only when cursor is actually inside the virus
		// Apply protection from either anomaly or maxed virus support (unless vulnerable)
		let damageReduction = 1.0;
		if (hasAnomalySupport) {
			damageReduction = CONFIG.SYNERGY_PROTECTION;
		} else if (hasMaxedVirusSupport) {
			damageReduction = 0.7; // 30% less damage from maxed virus support
		}

		if (distToCursor < o.radius) {
			// Mark as touched
			o.everTouched = true;

			// Damage based on how deep the cursor penetrates
			const penetration = 1.0 - distToCursor / o.radius;
			let baseDamage;
			if (penetration > 0.7) {
				// Deep in the virus (center area)
				baseDamage = isManual ? 3.5 : 1.2;
			} else if (penetration > 0.4) {
				// Mid area
				baseDamage = isManual ? 1.8 : 0.8;
			} else {
				// Edge area
				baseDamage = isManual ? 0.8 : 0.4;
			}

			// Disruption mode: damage boost when hunting targets
			let disruptionBonus = 1.0;
			if (disruptionIntensity > 0.3) {
				disruptionBonus = 1.0 + disruptionIntensity * 2.0; // Up to 3x damage
				// Extra bonus if this is the actual target
				if (disruptionTarget === o) {
					disruptionBonus *= 1.5; // 4.5x damage to primary target
				} else if (disruptionSecondaryTarget === o) {
					disruptionBonus *= 1.3; // 3.9x damage to secondary target
				}

				// Collision damage: bonus if two marked viruses are close
				if (
					disruptionSecondaryTarget &&
					(disruptionTarget === o || disruptionSecondaryTarget === o)
				) {
					const otherTarget =
						disruptionTarget === o
							? disruptionSecondaryTarget
							: disruptionTarget;
					const cdx = otherTarget.x - o.x;
					const cdy = otherTarget.y - o.y;
					const collisionDist = Math.sqrt(cdx * cdx + cdy * cdy);

					if (collisionDist < 150) {
						const collisionBonus = 1.0 + ((150 - collisionDist) / 150) * 0.5; // Up to +50% more damage
						disruptionBonus *= collisionBonus;
					}
				}
			}

			o.health -= baseDamage * damageReduction * disruptionBonus;
		}

		if (o.health <= 0) return false;

		// Threat detection
		o.threatened = distToCursor < o.radius * 1.5;

		// Regeneration when safe - boosted by support (blocked when vulnerable)
		if (!isVulnerable) {
			let regenRate = 0.5;
			if (hasAnomalySupport) {
				regenRate = 0.5 * CONFIG.SYNERGY_REGEN_BOOST;
			} else if (hasMaxedVirusSupport) {
				regenRate = 0.5 * 2.0; // 2x regen from maxed virus support
			}
			if (!o.threatened && o.health < o.maxHealth && o.frame % 5 === 0) {
				o.health = Math.min(o.maxHealth, o.health + regenRate);
			}
		}

		// Disruption wave - scatters viruses and creates new formations
		let disruptX = 0;
		let disruptY = 0;

		// Special mechanics if this virus is the marked target
		if (disruptionTarget === o && disruptionIntensity > 0.3) {
			// Pull marked target toward cursor (gravity well effect)
			const tdx = cursorX - o.x;
			const tdy = cursorY - o.y;
			const tDist = Math.sqrt(tdx * tdx + tdy * tdy);

			if (tDist > 50) {
				const pullStrength = disruptionIntensity * 4.0;
				disruptX += (tdx / tDist) * pullStrength;
				disruptY += (tdy / tDist) * pullStrength;
			}

			// Damage over time when marked (weakening effect)
			if (o.frame % 10 === 0) {
				const weakenDamage = disruptionIntensity * 1.0;
				o.health -= weakenDamage;
			}
		} else if (disruptionSecondaryTarget === o && disruptionIntensity > 0.3) {
			// Pull secondary target toward primary target (virus collision)
			const tdx = disruptionTarget.x - o.x;
			const tdy = disruptionTarget.y - o.y;
			const tDist = Math.sqrt(tdx * tdx + tdy * tdy);

			if (tDist > 60) {
				const pullStrength = disruptionIntensity * 5.0; // Strong pull
				disruptX += (tdx / tDist) * pullStrength;
				disruptY += (tdy / tDist) * pullStrength;
			}

			// Damage over time when marked as secondary
			if (o.frame % 10 === 0) {
				const weakenDamage = disruptionIntensity * 0.8;
				o.health -= weakenDamage;
			}

			// Collision damage when viruses get very close
			const collisionDist = tDist;
			if (collisionDist < 100) {
				const impactForce = (100 - collisionDist) / 100;
				if (o.frame % 8 === 0) {
					const collisionDamage = impactForce * disruptionIntensity * 1.5;
					o.health -= collisionDamage;
					// Also damage the primary target
					if (disruptionTarget) {
						disruptionTarget.health -= collisionDamage * 0.6;
					}
				}
			}
		} else if (disruptionIntensity > 0) {
			// Regular disruption wave for non-targets
			const ddx = o.x - disruptionCenterX;
			const ddy = o.y - disruptionCenterY;
			const dDist = Math.sqrt(ddx * ddx + ddy * ddy);
			const waveRadius = disruptionIntensity * 400;

			// Push viruses outward from disruption center
			if (dDist < waveRadius && dDist > 10) {
				const waveFront =
					Math.abs(dDist - waveRadius * 0.7) / (waveRadius * 0.3);
				const pushStrength =
					(1.0 - Math.min(waveFront, 1.0)) * 8.0 * disruptionIntensity;
				disruptX = (ddx / dDist) * pushStrength;
				disruptY = (ddy / dDist) * pushStrength;

				// Add rotational component for more interesting reorganization
				const tangentX = -ddy / dDist;
				const tangentY = ddx / dDist;
				const spinDirection =
					(Math.random() > 0.5 ? 1 : -1) * (o.x > centerX ? 1 : -1);
				disruptX += tangentX * pushStrength * 0.4 * spinDirection;
				disruptY += tangentY * pushStrength * 0.4 * spinDirection;
			}
		}

		// Virus-to-virus attraction - they cluster together (weaker during disruption)
		let attractX = 0;
		let attractY = 0;
		const attractionMultiplier = 1.0 - disruptionIntensity * 0.7; // Reduced during disruption
		for (let j = 0; j < outbreaks.length; j++) {
			if (outbreaks[j] === o) continue;
			const other = outbreaks[j];

			const odx = other.x - o.x;
			const ody = other.y - o.y;
			const oDist = Math.sqrt(odx * odx + ody * ody);

			// Gentle attraction to other viruses within range
			if (oDist < 400 && oDist > 50) {
				const attractionStrength =
					((o.radius + other.radius) / 280) * 0.15 * attractionMultiplier;
				const falloff = 1.0 - Math.min(oDist / 400, 1.0);
				attractX += (odx / oDist) * attractionStrength * falloff;
				attractY += (ody / oDist) * attractionStrength * falloff;
			}
		}

		o.vx = (o.vx + attractX + disruptX) * 0.85;
		o.vy = (o.vy + attractY + disruptY) * 0.85;
		o.x += o.vx;
		o.y += o.vy;

		// Organic growth morphing (subtle, continuous)
		const morphVariation =
			Math.sin(o.frame * 0.03) * 0.06 +
			Math.sin(o.frame * 0.07) * 0.05 +
			Math.cos(o.frame * 0.02) * 0.04;

		// Growth rate increases with game progress
		const elapsed = Date.now() - startTime;
		const timeProgress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);
		const growthSpeedBoost = 1.0 + timeProgress * 0.4; // Up to 40% faster growth

		const maxRadius = isMobile
			? CONFIG.OUTBREAK_MAX_RADIUS_MOBILE
			: CONFIG.OUTBREAK_MAX_RADIUS;
		const baseGrowthRate = isMobile
			? CONFIG.OUTBREAK_GROWTH_RATE_MOBILE
			: CONFIG.OUTBREAK_GROWTH_RATE;

		// Only slow down growth after being touched, otherwise grow freely
		const sizeSlowdown = o.everTouched
			? Math.max(0.25, 1.0 - o.radius / maxRadius)
			: 1.0;
		const healthFactor = (o.health / o.maxHealth) * 0.5 + 0.5;

		// SYNERGY: Growth boost from support
		let synergyGrowthBoost = 1.0;
		if (hasAnomalySupport) {
			synergyGrowthBoost = CONFIG.SYNERGY_GROWTH_BOOST;
		} else if (hasMaxedVirusSupport) {
			synergyGrowthBoost = 1.4; // 40% faster growth from maxed virus support
		}
		const growthRate =
			baseGrowthRate *
			(1.0 + morphVariation) *
			sizeSlowdown *
			healthFactor *
			growthSpeedBoost *
			synergyGrowthBoost;

		o.radius += growthRate;

		// Cap size at max only after touched
		if (o.everTouched && o.radius > maxRadius) {
			o.radius = maxRadius;
		}

		// Shrink when damaged
		if (o.health < 30 && o.frame % 3 === 0) {
			o.radius = Math.max(10, o.radius - 0.2);
		}

		// Viruses at max size become support entities - stronger synergy effects
		if (o.radius >= maxRadius && !o.maxed) {
			o.maxed = true;
		}

		// Keep viruses alive - only remove when killed
		return true;
	});
}

// ============================================================================
// ANOMALY SYSTEM
// ============================================================================
function updateAnomalies() {
	const now = Date.now();
	const elapsed = now - startTime;

	// Spawn anomalies
	if (now >= nextAnomalyTime && activeParticleRatio > 0.2) {
		const angle = Math.random() * Math.PI * 2;
		const distance = (0.2 + Math.random() * 0.3) * Math.min(w, h);

		anomalies.push({
			x: centerX + Math.cos(angle) * distance,
			y: centerY + Math.sin(angle) * distance,
			orbitCenterX: centerX + Math.cos(angle) * distance,
			orbitCenterY: centerY + Math.sin(angle) * distance,
			orbitAngle: Math.random() * Math.PI * 2,
			orbitRadius: CONFIG.ANOMALY_ORBIT_RADIUS,
			vortexRadius: CONFIG.ANOMALY_VORTEX_RADIUS,
			vortexStrength: CONFIG.ANOMALY_VORTEX_STRENGTH,
			driftTargetX: null,
			driftTargetY: null,
			isDrifting: false,
			driftTimer: 0,
			orbitTimer: 2000 + Math.random() * 3000,
			health: 60,
			maxHealth: 60,
			frame: 0,
			age: 0,
		});

		const spawnMin = isMobile
			? CONFIG.ANOMALY_SPAWN_MIN_MOBILE
			: CONFIG.ANOMALY_SPAWN_MIN;
		const spawnMax = isMobile
			? CONFIG.ANOMALY_SPAWN_MAX_MOBILE
			: CONFIG.ANOMALY_SPAWN_MAX;
		const spawnInterval = spawnMin + Math.random() * (spawnMax - spawnMin);
		nextAnomalyTime = now + spawnInterval;
	}

	// Update anomalies
	anomalies = anomalies.filter((a) => {
		a.frame++;
		a.age += 16.67;
		a.orbitTimer -= 16.67; // Assume ~60fps
		a.driftTimer -= 16.67;

		// Anomalies grow stronger over time
		const ageInSeconds = a.age / 1000;
		const growthProgress = Math.min(ageInSeconds / 60, 1.5); // Grows for 60 seconds, up to 2.5x

		// Vortex radius grows
		a.vortexRadius = CONFIG.ANOMALY_VORTEX_RADIUS * (1.0 + growthProgress);

		// Vortex strength increases
		a.vortexStrength =
			CONFIG.ANOMALY_VORTEX_STRENGTH * (1.0 + growthProgress * 0.8);

		// Orbit radius expands
		a.orbitRadius = CONFIG.ANOMALY_ORBIT_RADIUS * (1.0 + growthProgress * 0.5);

		// Health increases
		if (a.health === a.maxHealth) {
			const healthBoost = growthProgress * 40;
			a.maxHealth = 60 + healthBoost;
			a.health = a.maxHealth;
		}

		// Check if in orbit or drift mode
		if (!a.isDrifting && a.orbitTimer <= 0) {
			// Start drifting to new location
			a.isDrifting = true;
			a.driftTimer = 1500 + Math.random() * 1500; // Drift for 1.5-3 seconds

			// Find drift target - prefer maxed viruses, then any virus
			let targetX, targetY;
			if (outbreaks.length > 0 && Math.random() < 0.7) {
				// 70% chance: drift toward a virus (prefer maxed ones)
				const maxedViruses = outbreaks.filter((v) => v.maxed);
				let targetVirus;
				if (maxedViruses.length > 0 && Math.random() < 0.8) {
					// 80% chance to target maxed virus if available
					targetVirus =
						maxedViruses[Math.floor(Math.random() * maxedViruses.length)];
				} else {
					targetVirus = outbreaks[Math.floor(Math.random() * outbreaks.length)];
				}
				const offsetAngle = Math.random() * Math.PI * 2;
				const offsetDist = 50 + Math.random() * 100;
				targetX = targetVirus.x + Math.cos(offsetAngle) * offsetDist;
				targetY = targetVirus.y + Math.sin(offsetAngle) * offsetDist;
			} else {
				// 30% chance: drift to random location
				const angle = Math.random() * Math.PI * 2;
				const distance = (0.15 + Math.random() * 0.35) * Math.min(w, h);
				targetX = centerX + Math.cos(angle) * distance;
				targetY = centerY + Math.sin(angle) * distance;
			}

			a.driftTargetX = targetX;
			a.driftTargetY = targetY;
		}

		if (a.isDrifting && a.driftTimer <= 0) {
			// Stop drifting, start orbiting at current location
			a.isDrifting = false;
			a.orbitCenterX = a.x;
			a.orbitCenterY = a.y;
			a.orbitAngle = Math.random() * Math.PI * 2;
			a.orbitTimer = 2000 + Math.random() * 3000;
		}

		// Check if near a virus for synergy
		let nearVirus = false;
		for (let j = 0; j < outbreaks.length; j++) {
			const v = outbreaks[j];
			const vdx = v.x - a.x;
			const vdy = v.y - a.y;
			const vDist = Math.sqrt(vdx * vdx + vdy * vdy);
			if (vDist < CONFIG.SYNERGY_RANGE) {
				nearVirus = true;
				break;
			}
		}

		// Disruption wave affects anomalies
		let anomalyPullX = 0;
		let anomalyPullY = 0;

		// Special mechanics if this anomaly is the marked target
		if (disruptionTarget === a && disruptionIntensity > 0.3) {
			// Pull marked anomaly toward cursor
			const tdx = cursorX - a.x;
			const tdy = cursorY - a.y;
			const tDist = Math.sqrt(tdx * tdx + tdy * tdy);

			if (tDist > 40) {
				const pullStrength = disruptionIntensity * 5.0;
				anomalyPullX = (tdx / tDist) * pullStrength;
				anomalyPullY = (tdy / tDist) * pullStrength;
			}

			// Damage over time when marked
			if (a.frame % 10 === 0) {
				const weakenDamage = disruptionIntensity * 1.0;
				a.health -= weakenDamage;
			}
		} else if (disruptionIntensity > 0.3) {
			// Regular disruption wave - shifts orbit centers
			const ddx = a.orbitCenterX - disruptionCenterX;
			const ddy = a.orbitCenterY - disruptionCenterY;
			const dDist = Math.sqrt(ddx * ddx + ddy * ddy);
			const waveRadius = disruptionIntensity * 450;

			if (dDist < waveRadius) {
				const pushStrength =
					(1.0 - Math.min(dDist / waveRadius, 1.0)) * 6.0 * disruptionIntensity;
				// Shift orbit center
				a.orbitCenterX += (ddx / dDist) * pushStrength;
				a.orbitCenterY += (ddy / dDist) * pushStrength;

				// If drifting, also shift the target
				if (a.isDrifting) {
					const tdx = a.driftTargetX - disruptionCenterX;
					const tdy = a.driftTargetY - disruptionCenterY;
					const tDist = Math.sqrt(tdx * tdx + tdy * tdy);
					if (tDist < waveRadius && tDist > 10) {
						a.driftTargetX += (tdx / tDist) * pushStrength * 0.5;
						a.driftTargetY += (tdy / tDist) * pushStrength * 0.5;
					}
				}
			}
		}

		// Update position
		if (a.isDrifting) {
			// Drift smoothly toward target (pulled by disruption if marked)
			const dx = a.driftTargetX - a.x + anomalyPullX;
			const dy = a.driftTargetY - a.y + anomalyPullY;
			a.x += dx * CONFIG.ANOMALY_DRIFT_SPEED * 0.016;
			a.y += dy * CONFIG.ANOMALY_DRIFT_SPEED * 0.016;
		} else {
			// Orbit around center point (pulled by disruption if marked)
			const orbitSpeed = nearVirus
				? CONFIG.ANOMALY_ORBIT_SPEED * 0.5
				: CONFIG.ANOMALY_ORBIT_SPEED;
			a.orbitAngle += orbitSpeed;
			const orbitX = a.orbitCenterX + Math.cos(a.orbitAngle) * a.orbitRadius;
			const orbitY = a.orbitCenterY + Math.sin(a.orbitAngle) * a.orbitRadius;
			a.x = orbitX + anomalyPullX * 0.3;
			a.y = orbitY + anomalyPullY * 0.3;
		}

		// Damage from cursor
		const dx = cursorX - a.x;
		const dy = cursorY - a.y;
		const distToCursor = Math.sqrt(dx * dx + dy * dy);

		// Instant dissolution when passing directly through center
		if (distToCursor < CONFIG.ANOMALY_DISSOLVE_RADIUS) {
			return false; // Remove immediately
		}

		if (distToCursor < 40) {
			const damage = isManual ? 2.0 : 1.0;

			// Disruption mode damage boost
			let disruptionBonus = 1.0;
			if (disruptionIntensity > 0.3) {
				disruptionBonus = 1.0 + disruptionIntensity * 2.0; // Up to 3x damage
				if (disruptionTarget === a) {
					disruptionBonus *= 1.5; // 4.5x damage to marked anomaly
				}
			}

			a.health -= damage * disruptionBonus;
		}

		return a.health > 0 && a.frame < 18000; // Live for max 5 minutes
	});
}

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
	isMobile =
		window.innerWidth <= 768 ||
		window.matchMedia("(orientation: portrait)").matches;

	const containerId = isMobile ? "container-mobile" : "container";
	container = document.getElementById(containerId);
	if (!container) return;

	canvas = document.createElement("canvas");
	ctx = canvas.getContext("2d", { alpha: false });

	const vw = window.innerWidth;
	const vh = window.innerHeight;

	if (isMobile) {
		w = canvas.width = vw;
		h = canvas.height = 600;
	} else {
		w = canvas.width = vw;
		h = canvas.height = vh;
	}

	centerX = w * 0.5;
	centerY = h * 0.5;

	const spacing = isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP;
	let marginH, marginV;
	if (isMobile) {
		marginH = marginV = w * 0.05;
	} else {
		marginH = Math.min(vw, vh) * 0.15;
		marginV = Math.min(vw, vh) * 0.05;
	}

	const gridWidth = w - marginH * 2;
	const gridHeight = h - marginV * 2;
	const cols = Math.floor(gridWidth / spacing);
	const rows = Math.floor(gridHeight / spacing);

	const offsetX = (w - cols * spacing) / 2;
	const offsetY = (h - rows * spacing) / 2;

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const x = offsetX + col * spacing;
			const y = offsetY + row * spacing;
			list.push(new Particle(x, y, centerX, centerY));
		}
	}

	maxParticleDistance = Math.max(...list.map((p) => p.distFromCenter));

	cursorX = targetX = centerX;
	cursorY = targetY = centerY;

	// Random variations for each run
	pathRadiusVariation = 0.6 + Math.random() * 0.7; // 0.6 to 1.3 - wider range for more coverage
	pathSpeedVariation = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
	pathStartOffset = Math.random() * Math.PI * 2; // Random starting position on circle
	wobblePhaseX = Math.random() * 100;
	wobblePhaseY = Math.random() * 100;

	startTime = Date.now();
	lastFrameTime = startTime;

	// Randomize first virus spawn time - later to let player build up field first
	const firstSpawnDelay = isMobile
		? 15000 + Math.random() * 10000 // 15-25 seconds
		: 12000 + Math.random() * 10000; // 12-22 seconds
	nextOutbreakTime = startTime + firstSpawnDelay;

	// Randomize first anomaly spawn time
	const firstAnomalyDelay = isMobile
		? 20000 + Math.random() * 15000 // 20-35 seconds
		: 10000 + Math.random() * 8000; // 10-18 seconds
	nextAnomalyTime = startTime + firstAnomalyDelay;

	// Randomize first disruption time
	const firstDisruptionDelay = 20000 + Math.random() * 15000; // 20-35 seconds
	nextDisruptionTime = startTime + firstDisruptionDelay;

	const handleInput = (clientX, clientY) => {
		if (manualTimeout) clearTimeout(manualTimeout);

		const bounds = canvas.getBoundingClientRect();
		targetX = (clientX - bounds.left) * (w / bounds.width);
		targetY = (clientY - bounds.top) * (h / bounds.height);

		if (!isManual) {
			cursorVx = 0;
			cursorVy = 0;
		}
		isManual = true;

		manualTimeout = setTimeout(() => {
			isManual = false;
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

	// Debug menu toggle (press 'D' key)
	document.addEventListener("keydown", (e) => {
		if (e.key === "d" || e.key === "D") {
			debugEnabled = !debugEnabled;
			if (debugEnabled && !debugElement) {
				createDebugMenu();
			}
			if (debugElement) {
				debugElement.style.display = debugEnabled ? "block" : "none";
			}
		}
	});
}

// ============================================================================
// DEBUG MENU
// ============================================================================
function createDebugMenu() {
	debugElement = document.createElement("div");
	debugElement.style.position = "fixed";
	debugElement.style.top = "10px";
	debugElement.style.right = "10px";
	debugElement.style.background = "rgba(0, 0, 0, 0.8)";
	debugElement.style.color = "#0f0";
	debugElement.style.padding = "10px";
	debugElement.style.fontFamily = "monospace";
	debugElement.style.fontSize = "12px";
	debugElement.style.zIndex = "9999";
	debugElement.style.border = "1px solid #0f0";
	debugElement.style.minWidth = "250px";
	debugElement.style.pointerEvents = "none";
	document.body.appendChild(debugElement);
}

function updateDebugMenu() {
	if (!debugEnabled || !debugElement) return;

	const elapsed = Date.now() - startTime;
	const minutes = Math.floor(elapsed / 60000);
	const seconds = Math.floor((elapsed % 60000) / 1000);

	// Find largest black hole
	let largestBlackHole = null;
	let largestPullRadius = 0;
	const screenDiagonal = Math.sqrt(w * w + h * h);

	for (let i = 0; i < outbreaks.length; i++) {
		const o = outbreaks[i];
		if (o.frame < 360) continue;

		const pullAge = o.frame - 360;
		const initialProgress = Math.min(pullAge / 1200, 1.0);
		const continuousGrowth = Math.min(pullAge / 3600, 1.5);
		const baseMultiplier =
			CONFIG.OUTBREAK_PULL_RADIUS_MIN +
			(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
				initialProgress;
		const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.5;
		const pullRadius = o.radius * pullRadiusMultiplier;

		if (pullRadius > largestPullRadius) {
			largestPullRadius = pullRadius;
			largestBlackHole = o;
		}
	}

	const coverage = largestBlackHole
		? ((largestPullRadius / screenDiagonal) * 100).toFixed(1)
		: "0.0";
	const disruptionReady = largestBlackHole && largestPullRadius >= screenDiagonal * 0.7;

	let debugText = `<div style="margin-bottom: 8px; color: #fff; font-weight: bold;">DEBUG MENU (Press D to toggle)</div>`;
	debugText += `Time: ${minutes}:${seconds.toString().padStart(2, "0")}<br>`;
	debugText += `Particles: ${(activeParticleRatio * 100).toFixed(1)}%<br>`;
	debugText += `Viruses: ${outbreaks.length}<br>`;
	debugText += `Anomalies: ${anomalies.length}<br>`;
	debugText += `<br>`;
	debugText += `<div style="color: ${disruptionReady ? "#0f0" : "#f00"};">Disruption: ${disruptionReady ? "READY" : "NOT READY"}</div>`;
	debugText += `Max BH Coverage: ${coverage}% (need 70%)<br>`;

	if (largestBlackHole) {
		debugText += `<br>`;
		debugText += `<div style="color: #ff0;">Largest Black Hole:</div>`;
		debugText += `Health: ${Math.floor(largestBlackHole.health)}/${largestBlackHole.maxHealth}<br>`;
		debugText += `Radius: ${Math.floor(largestBlackHole.radius)}px<br>`;
		debugText += `Pull Radius: ${Math.floor(largestPullRadius)}px<br>`;
		debugText += `Age: ${Math.floor((largestBlackHole.frame - 360) / 60)}s<br>`;
	}

	if (disruptionActive) {
		debugText += `<br>`;
		debugText += `<div style="color: #f0f;">Disruption Active: ${(disruptionIntensity * 100).toFixed(0)}%</div>`;
	}

	debugElement.innerHTML = debugText;
}

// ============================================================================
// MAIN ANIMATION LOOP
// ============================================================================
function step() {
	const now = Date.now();
	const deltaTime = (now - lastFrameTime) * 0.001;
	lastFrameTime = now;

	if (frameToggle) {
		updateGrowth();
		updateOutbreaks();
		updateAnomalies();
	}

	updateCursor(deltaTime);

	const elapsed = now - startTime;
	const spiralProgress = Math.min(elapsed * CONFIG.SPIRAL_TIGHTENING_RATE, 1);
	const spiralStrength = CONFIG.SPIRAL_STRENGTH_BASE + spiralProgress * 0.4;

	if ((frameToggle = !frameToggle)) {
		// PHYSICS FRAME
		for (let i = 0; i < list.length; i++) {
			list[i].update(
				cursorX,
				cursorY,
				radiusMultiplier,
				spiralStrength,
				outbreaks,
				anomalies,
				cursorVx,
				cursorVy,
			);
		}
	} else {
		// RENDER FRAME
		if (!imageData || imageData.width !== w || imageData.height !== h) {
			imageData = ctx.createImageData(w, h);
			imageDataBuffer = imageData.data;
		}
		const data = imageDataBuffer;

		for (let i = 0; i < data.length; i += 4) {
			data[i] = data[i + 1] = data[i + 2] = 0;
			data[i + 3] = 255;
		}

		const baseColor = CONFIG.COLOR;
		for (let i = 0; i < list.length; i++) {
			const p = list[i];
			if (!p.active) continue;

			const px = Math.floor(p.x);
			const py = Math.floor(p.y);
			if (px < 0 || px >= w || py < 0 || py >= h) continue;

			// Black holes reduce visibility of particles
			let visibility = 1.0;
			for (let j = 0; j < outbreaks.length; j++) {
				const o = outbreaks[j];
				if (o.frame < 360) continue; // Only pull phase

				const dx = p.x - o.x;
				const dy = p.y - o.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				// Calculate pull radius
				const pullAge = o.frame - 360;
				const initialProgress = Math.min(pullAge / 1200, 1.0);
				const continuousGrowth = Math.min(pullAge / 3600, 1.5);
				const baseMultiplier =
					CONFIG.OUTBREAK_PULL_RADIUS_MIN +
					(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
						initialProgress;
				const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.5;
				const pullRadius = o.radius * pullRadiusMultiplier;

				if (dist < pullRadius) {
					// Create ring of darkness - darkest at 60% radius, then recovers toward center
					const fadeProgress = 1.0 - dist / pullRadius;

					let dimming;
					if (fadeProgress < 0.6) {
						// Outer area: gradually darken from 20% to 50%
						dimming = 0.2 + (fadeProgress / 0.6) * 0.3; // From 20% darker to 50% darker
					} else {
						// Inner area: recover visibility toward center but cap at 80%
						const recovery = (fadeProgress - 0.6) / 0.4; // 0 to 1 as we approach center
						dimming = 0.5 - recovery * 0.3; // Recovers from 50% to 20% darker (80% visible at center)
					}

					visibility = Math.min(visibility, 1.0 - dimming);
				}
			}

			const idx = (px + py * w) * 4;
			const color = baseColor * visibility;
			data[idx] = data[idx + 1] = data[idx + 2] = color;
			data[idx + 3] = 255;
		}

		ctx.putImageData(imageData, 0, 0);
	}

	updateDebugMenu();
	requestAnimationFrame(step);
}

init();
step();
