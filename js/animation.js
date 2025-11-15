"use strict";

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
	// Particle grid
	SPACING_MOBILE: 5.0,
	SPACING_DESKTOP: 8.0,
	COLOR: 220,

	// Particle physics
	PARTICLE_DRAG: 0.92,
	PARTICLE_EASE: 0.12, // Gentler spring-back to reduce snapping
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
	GROWTH_START_RADIUS: 0.05, // Start slightly smaller than original (was 0.08)

	// Virus outbreaks - desktop spawns faster to match cursor advantage
	OUTBREAK_SPAWN_MIN: 35000, // 35 seconds when losing (desktop) - more breathing room
	OUTBREAK_SPAWN_MAX: 18000, // 18 seconds when winning (desktop)
	OUTBREAK_SPAWN_MIN_MOBILE: 40000, // 40 seconds when losing (mobile)
	OUTBREAK_SPAWN_MAX_MOBILE: 22000, // 22 seconds when winning (mobile)
	OUTBREAK_GROWTH_RATE: 0.35, // Slower growth to keep playable space
	OUTBREAK_GROWTH_RATE_MOBILE: 0.35,
	OUTBREAK_MAX_RADIUS: 140,
	OUTBREAK_MAX_RADIUS_MOBILE: 120,
	OUTBREAK_KILL_RADIUS: 50,
	OUTBREAK_DAMAGE_RADIUS: 100,
	OUTBREAK_DISSOLVE_RADIUS: 25,
	OUTBREAK_PULL_RADIUS_MIN: 0.5, // Start pulling at 50% of virus size
	OUTBREAK_PULL_RADIUS_MAX: 2.5, // Original pull radius for beautiful visuals

	// Anomalies
	ANOMALY_SPAWN_MIN: 8000, // Spawn more frequently (was 12000)
	ANOMALY_SPAWN_MAX: 15000, // (was 20000)
	ANOMALY_SPAWN_MIN_MOBILE: 18000, // (was 25000)
	ANOMALY_SPAWN_MAX_MOBILE: 30000, // (was 40000)
	ANOMALY_ORBIT_RADIUS: 40,
	ANOMALY_ORBIT_SPEED: 0.02,
	ANOMALY_DRIFT_SPEED: 0.3,
	ANOMALY_VORTEX_RADIUS: 60,
	ANOMALY_VORTEX_STRENGTH: 0.8,
	ANOMALY_DISSOLVE_RADIUS: 20,

	// Energy Stations
	STATION_SPAWN_MIN: 40000, // Spawn less frequently (was 30000)
	STATION_SPAWN_MAX: 75000, // (was 60000)
	STATION_DRIFT_SPEED: 0.15,
	STATION_CAPTURE_RADIUS: 35,
	STATION_LIFETIME: 75000, // 75 seconds before despawn

	// Synergy between anomalies and viruses
	SYNERGY_RANGE: 100, // Distance for synergy effects
	SYNERGY_VORTEX_BOOST: 1.6, // Anomaly vortex becomes much stronger near virus
	SYNERGY_GROWTH_BOOST: 1.8, // Virus grows faster near anomaly
	SYNERGY_REGEN_BOOST: 3.0, // Virus regenerates faster near anomaly
	SYNERGY_PROTECTION: 0.5, // Virus takes less damage near anomaly

	// Shock wave system - affects particles only
	SHOCK_WAVE_COOLDOWN: 45000, // 45 seconds between shock waves
	SHOCK_WAVE_COOLDOWN_MOBILE: 35000, // 35 seconds on mobile
	SHOCK_WAVE_EXPANSION_SPEED: 12.0, // Wave expansion speed
	SHOCK_WAVE_LIFETIME: 2500, // Wave lasts 2.5 seconds
	SHOCK_WAVE_THICKNESS: 60, // Thickness of the wave ring
	SHOCK_WAVE_PARTICLE_DISABLE_DURATION: 4000, // Particles stay dark for 4 seconds after hit
};

// ============================================================================
// STATE
// ============================================================================
let container, canvas, ctx;
let list = [];
let initialParticleCount = 0; // Track initial grid size to prevent over-spawning
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
let transitionBlend = 0; // 0 = manual, 1 = automatic
let transitionStartTime = 0;

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

// Energy Stations
let stations = [];
let nextStationTime = 0;

// Active buffs
let cursorBuffs = {
	shieldActive: false,
	shieldEndTime: 0,
	damageBoostActive: false,
	damageBoostEndTime: 0,
	blackHoleKillBoostActive: false,
	blackHoleKillBoostEndTime: 0,
};

// Shock wave state (disabled - cursor spawns particles instead)
let shockWaves = [];
let nextShockWaveTime = 0;

// Cursor particle spawning
let lastCursorSpawnTime = 0;
let cursorDelay = 0; // Random delay before cursor becomes active (10-13 seconds)

// Animation state
let startTime;
let lastFrameTime;
let frameToggle = true;
let maxParticleDistance = 0;
let activeParticleRatio = 0;

// Reusable image buffer
let imageData = null;
let imageDataBuffer = null;

// Debug panel (activated with '?' key)
let debugPanel = null;

// Screen size balancing
let screenSizeMultiplier = 1.0;

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

		// Shock wave effect
		this.shockDisabledUntil = 0;

		// Consumption tracking - marked for permanent removal by black holes
		this.consumed = false;

		// Smooth fade for grow/shrink effect
		this.fadeAlpha = 0.0; // 0 = invisible, 1 = fully visible
	}

	// Lightweight cursor repulsion for render frames (prevents trails when cursor moves fast)
	applyCursorRepulsion(cursorX, cursorY, radiusMult) {
		if (!this.active) return;

		// Check if cursor is active yet (random 10-13 second delay at start)
		const now = Date.now();
		const cursorFadeInDuration = 2000;
		const timeSinceStart = now - startTime;
		const cursorActive = timeSinceStart >= cursorDelay;
		if (!cursorActive) return; // Skip repulsion during delay

		// Smooth fade-in for cursor radius (prevents splash)
		let cursorFadeIn = 1.0;
		if (timeSinceStart < cursorDelay + cursorFadeInDuration) {
			const fadeProgress = Math.max(0, timeSinceStart - cursorDelay) / cursorFadeInDuration;
			cursorFadeIn = fadeProgress * fadeProgress; // Ease-in
		}

		const dx = cursorX - this.x;
		const dy = cursorY - this.y;
		const distSq = dx * dx + dy * dy;

		// Calculate buff multipliers (same as full update)
		let buffRadiusMultiplier = 1.0;
		let buffForceMultiplier = 1.0;
		const manualReduction = isManual ? 0.3 : 1.0;

		if (cursorBuffs.shieldActive) {
			buffRadiusMultiplier = 1.0 + (0.8 * manualReduction);
		}
		if (cursorBuffs.damageBoostActive) {
			buffRadiusMultiplier = Math.max(buffRadiusMultiplier, 1.0 + (1.0 * manualReduction));
		}
		if (cursorBuffs.blackHoleKillBoostActive) {
			buffRadiusMultiplier = 1.0 + (1.5 * manualReduction);
		}

		const dynamicRadiusSq =
			CONFIG.REPULSION_RADIUS *
			CONFIG.REPULSION_RADIUS *
			radiusMult *
			radiusMult *
			buffRadiusMultiplier *
			buffRadiusMultiplier *
			cursorFadeIn * // Apply fade-in to radius
			cursorFadeIn;

		// Apply repulsion force only (no spiral, no anticipation)
		if (distSq < dynamicRadiusSq) {
			const safeDist = Math.max(distSq, 1);
			const baseForce =
				(-dynamicRadiusSq / safeDist) * CONFIG.REPULSION_STRENGTH * buffForceMultiplier;
			const force = baseForce * this.nervousness * 0.5; // Half strength to avoid double-force
			const angle = Math.atan2(dy, dx);

			this.vx += force * Math.cos(angle);
			this.vy += force * Math.sin(angle);
		}

		// Apply velocity and drag
		this.x += this.vx;
		this.y += this.vy;
		this.vx *= CONFIG.PARTICLE_DRAG;
		this.vy *= CONFIG.PARTICLE_DRAG;
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

		const now = Date.now();

		// Check if cursor is active yet (random 10-13 second delay at start)
		const cursorFadeInDuration = 2000; // 2 seconds to fade in
		const timeSinceStart = now - startTime;
		const cursorActive = timeSinceStart >= cursorDelay;

		// Smooth fade-in for cursor radius (prevents splash)
		let cursorFadeIn = 1.0;
		if (timeSinceStart < cursorDelay + cursorFadeInDuration) {
			const fadeProgress = Math.max(0, timeSinceStart - cursorDelay) / cursorFadeInDuration;
			cursorFadeIn = fadeProgress * fadeProgress; // Ease-in
		}

		const dx = cursorX - this.x;
		const dy = cursorY - this.y;
		const distSq = dx * dx + dy * dy;
		const dist = Math.sqrt(distSq);

		// Pulsating pull-push effect for cursor buffs
		let buffRadiusMultiplier = 1.0;
		let buffForceMultiplier = 1.0;
		let hasPulsatingBuff = false;
		let pulseStrength = 0;

		// During manual control, reduce buff intensity for smoother control
		const manualReduction = isManual ? 0.3 : 1.0; // 30% strength when manual

		// Shield buff - pulsating green shield
		if (cursorBuffs.shieldActive) {
			hasPulsatingBuff = true;
			const pulse = Math.sin(now * 0.008) * 0.5 + 0.5; // 0 to 1
			pulseStrength = pulse * 12.0 * manualReduction;
			buffRadiusMultiplier = 1.0 + (0.8 * manualReduction); // 1.8 auto, 1.24 manual
		}

		// Damage boost - faster aggressive pulsating
		if (cursorBuffs.damageBoostActive) {
			hasPulsatingBuff = true;
			const pulse = Math.sin(now * 0.014) * 0.5 + 0.5; // 0 to 1, faster
			pulseStrength = Math.max(pulseStrength, pulse * 15.0 * manualReduction);
			buffRadiusMultiplier = Math.max(buffRadiusMultiplier, 1.0 + (1.0 * manualReduction)); // 2.0 auto, 1.3 manual
		}

		// Empowered (black hole kill) - MASSIVE dramatic pulsating (but toned down in manual)
		if (cursorBuffs.blackHoleKillBoostActive) {
			hasPulsatingBuff = true;
			const pulse = Math.sin(now * 0.018) * 0.5 + 0.5; // 0 to 1, fastest
			pulseStrength = pulse * 25.0 * manualReduction; // 25 auto, 7.5 manual
			buffRadiusMultiplier = 1.0 + (1.5 * manualReduction); // 2.5 auto, 1.45 manual
		}

		const dynamicRadiusSq =
			CONFIG.REPULSION_RADIUS *
			CONFIG.REPULSION_RADIUS *
			radiusMult *
			radiusMult *
			buffRadiusMultiplier *
			buffRadiusMultiplier *
			cursorFadeIn * // Apply fade-in to radius
			cursorFadeIn;

		// Cursor repulsion with spiral (only when cursor is active)
		if (cursorActive && distSq < dynamicRadiusSq) {
			const safeDist = Math.max(distSq, 1);
			const baseForce =
				(-dynamicRadiusSq / safeDist) * CONFIG.REPULSION_STRENGTH * buffForceMultiplier;
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

		// Pulsating wave effect for cursor buffs - simple symmetric effect (only when cursor is active)
		if (cursorActive && hasPulsatingBuff) {
			const particleSpacing = isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP;
			const waveDistance = particleSpacing * 4;
			const waveRadius = Math.sqrt(dynamicRadiusSq) + waveDistance;
			const waveThickness = particleSpacing * 6;

			const distFromWaveCenter = Math.abs(dist - waveRadius);
			if (distFromWaveCenter < waveThickness) {
				const angle = Math.atan2(dy, dx);
				const normalizedPulse = (pulseStrength) * 2 - 1; // -1 to +1
				const proximityFactor = 1.0 - (distFromWaveCenter / waveThickness);
				const waveForce = normalizedPulse * proximityFactor * 8.0;

				this.vx += waveForce * Math.cos(angle);
				this.vy += waveForce * Math.sin(angle);
			}
		}

		// Outbreak forces with organic morphing
		for (let i = 0; i < outbreaks.length; i++) {
			const o = outbreaks[i];
			const odx = this.x - o.x;
			const ody = this.y - o.y;
			const oDistSq = odx * odx + ody * ody;
			const oDist = Math.sqrt(oDistSq);

			// Subtle organic growth variation (reduced for smoother feel)
			const morphPulse =
				Math.sin(o.frame * 0.05) * 0.03 +
				Math.sin(o.frame * 0.02 + this.angle * 2) * 0.02 +
				1.0;

			// Asymmetric tentacle-like directional variations (reduced)
			const angleToParticle = Math.atan2(ody, odx);
			const tentacleVariation =
				Math.sin(angleToParticle * 3 + o.frame * 0.03) * 0.05 +
				Math.cos(angleToParticle * 5 - o.frame * 0.04) * 0.04;

			const organicRadius = o.radius * morphPulse * (1.0 + tentacleVariation);
			const currentRadiusSq = organicRadius ** 2;

			if (o.frame < 240) {
				// Push phase - growing organism expanding (240 frames = 4 seconds, shorter for more playable time)
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
				const pullAge = o.frame - 240;

				// Very slow progression - takes 30 seconds to reach initial full power
				const initialProgress = Math.min(pullAge / 1800, 1.0);

				// Then continues growing much more slowly over 90 seconds total
				const continuousGrowth = Math.min(pullAge / 5400, 1.2); // Up to 1.2x over 90 seconds

				// Pull radius grows from 50% to 250%, then up to ~400% over 90 seconds
				const baseMultiplier =
					CONFIG.OUTBREAK_PULL_RADIUS_MIN +
					(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
						initialProgress;
				const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.67; // Reaches ~4x at 90 seconds
				const pullRadius = organicRadius * pullRadiusMultiplier;
				const pullRadiusSq = pullRadius * pullRadius;

				if (oDistSq < pullRadiusSq) {
					// No continuous consumption - black holes only remove particles when defeated
					// Very slow strength ramp-up, then continues growing
					let pullStrength = Math.min(pullAge / 1200, 1.0) * 1.2; // Takes 20 seconds to reach base strength
					pullStrength *= 1.0 + continuousGrowth * 0.3; // Continues growing stronger more slowly

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

		// Energy stations - create geometric grid patterns
		// Only apply forces if stations exist and this is an active particle
		if (stations.length > 0 && this.active) {
			for (let i = 0; i < stations.length; i++) {
				const s = stations[i];
				const sdx = this.x - s.x;
				const sdy = this.y - s.y;
				const sDistSq = sdx * sdx + sdy * sdy;
				const sDist = Math.sqrt(sDistSq);

				// Compact grid pattern for clean geometric aesthetic
				const age = Date.now() - s.spawnTime;
				const gridRadius = 35; // Fixed small size - looks clean in the particle battle

				// Early exit if too far
				if (sDist > gridRadius * 1.2) continue;

				// Snap particles to grid positions for blocky effect
				const gridSpacing = isMobile ? CONFIG.SPACING_MOBILE * 2 : CONFIG.SPACING_DESKTOP * 2;

				// Calculate target grid position relative to station
				const localX = sdx;
				const localY = sdy;
				const gridX = Math.round(localX / gridSpacing) * gridSpacing;
				const gridY = Math.round(localY / gridSpacing) * gridSpacing;
				const targetX = s.x + gridX;
				const targetY = s.y + gridY;

				// Distance to nearest grid point
				const gridDx = targetX - this.x;
				const gridDy = targetY - this.y;
				const gridDistSq = gridDx * gridDx + gridDy * gridDy;
				const gridDist = Math.sqrt(gridDistSq);

				// Only snap if within station radius
				const targetDist = Math.sqrt(gridX * gridX + gridY * gridY);
				if (targetDist < gridRadius && gridDist < gridSpacing * 0.6) {
					// Pull toward grid point - creates structured pattern
					const snapStrength = (1.0 - gridDist / (gridSpacing * 0.6)) * 2.5;

					this.vx += gridDx * snapStrength * 0.15;
					this.vy += gridDy * snapStrength * 0.15;
				}

				// Create animated geometric patterns based on station age
				const patternTime = age * 0.002; // Slow animation

				// Concentric square pulses
				const squareLevel = Math.floor(sDist / (gridSpacing * 2));
				const squarePulse = Math.sin(patternTime - squareLevel * 0.5) * 0.5 + 0.5;

				// Add subtle pulsing force to create wave effect through the grid
				if (squarePulse > 0.6 && sDist > gridSpacing * 2) {
					const pulseStrength = (squarePulse - 0.6) * 2.5;
					const angle = Math.atan2(sdy, sdx);
					this.vx += Math.cos(angle) * pulseStrength * 0.3;
					this.vy += Math.sin(angle) * pulseStrength * 0.3;
				}

				// Station ripple waves - static rotating ring formation
				for (let r = 0; r < s.ripples.length; r++) {
					const ripple = s.ripples[r];
					const rippleDist = Math.sqrt(sDistSq);

					// Narrow ring for static formation
					const waveThickness = 40; // Thin ring to keep particles in formation
					const distFromWave = Math.abs(rippleDist - ripple.radius);

					if (distFromWave < waveThickness) {
						const proximityFactor = 1.0 - (distFromWave / waveThickness);

						// Only apply orbital force - particles rotate in place without being pulled in
						const tangentialAngle = Math.atan2(-sdy, -sdx) + Math.PI / 2; // Perpendicular for clockwise orbit
						const orbitalForce = 6.0 * proximityFactor * ripple.alpha;

						// Apply only orbital force to maintain static ring
						this.vx += orbitalForce * Math.cos(tangentialAngle);
						this.vy += orbitalForce * Math.sin(tangentialAngle);
					}
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

				// Energy station vortex boost
				const now = Date.now();
				if (a.vortexBoostEndTime && now < a.vortexBoostEndTime) {
					vortexStrength *= 1.5; // 50% stronger vortex
				}

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

		// Apply spring-back force to return to home position
		this.x += this.vx + (this.ox - this.x) * CONFIG.PARTICLE_EASE;
		this.y += this.vy + (this.oy - this.y) * CONFIG.PARTICLE_EASE;
	}
}

// ============================================================================
// PARTICLE SPAWNING
// ============================================================================
/**
 * Spawn new particles dynamically at a given location
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} count - Number of particles to spawn
 * @param {number} spreadRadius - Radius to spread particles around the point
 * @param {number} burstVelocity - Initial outward velocity (optional)
 */
function spawnParticles(x, y, count, spreadRadius = 0, burstVelocity = 0) {
	// Cap spawning at initial particle count
	const maxToSpawn = initialParticleCount > 0 ? Math.max(0, initialParticleCount - list.length) : count;
	const actualCount = Math.min(count, maxToSpawn);

	for (let i = 0; i < actualCount; i++) {
		// Random position within spread radius
		const angle = Math.random() * Math.PI * 2;
		const distance = Math.random() * spreadRadius;
		const px = x + Math.cos(angle) * distance;
		const py = y + Math.sin(angle) * distance;

		// Create particle with spawn position as home
		const particle = new Particle(px, py, centerX, centerY);

		// Set active state to match current growth phase
		particle.active = true;
		particle.fadeAlpha = 0.0; // Spawned particles fade in gradually (prevents pop-in)

		// Optional burst velocity
		if (burstVelocity > 0) {
			particle.vx = Math.cos(angle) * burstVelocity;
			particle.vy = Math.sin(angle) * burstVelocity;
		}

		list.push(particle);
	}
}

// ============================================================================
// CURSOR SYSTEM
// ============================================================================
function updateCursor(deltaTime) {
	const elapsed = Date.now() - startTime;
	const now = Date.now();
	const speedProgress = Math.min(elapsed / CONFIG.CURSOR_SPEED_DURATION, 1);

	// Delay cursor entry for random 10-13 seconds - let particles grow first
	const cursorActive = elapsed >= cursorDelay;

	// Check if any black hole is large enough to affect 70% of screen
	const screenDiagonal = Math.sqrt(w * w + h * h);
	const requiredCoverage = screenDiagonal * 0.7;
	let hasLargeBlackHole = false;

	for (let i = 0; i < outbreaks.length; i++) {
		const o = outbreaks[i];
		if (o.frame < 240) continue; // Only pull phase

		const pullAge = o.frame - 240;
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
	if (disruptionIntensity > 0.3) {
		const slowdownFactor = 0.6 - disruptionIntensity * 0.2; // Down to 0.4x speed (60% slower)
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
	if (cursorBuffs.blackHoleKillBoostActive && !isManual) {
		// During transition, blend the speed boost in gradually
		const speedBoostMultiplier = transitionBlend < 1.0 ? (1.0 + transitionBlend) : 2.0;
		speed *= speedBoostMultiplier; // 1x manual -> 2x fully auto
	}

	// Radius scales with active particles - much smaller in late game for precision
	let particleScaling;
	if (activeParticleRatio < 0.4) {
		// Early game: grows slightly - smaller on mobile for better control
		const maxScaling = isMobile ? 0.15 : 0.3; // Reduced from 0.25 for mobile
		particleScaling = 1.0 + (activeParticleRatio / 0.4) * maxScaling;
	} else {
		// Late game: shrinks significantly for more precision
		const maxScaling = isMobile ? 0.15 : 0.3; // Reduced from 0.25 for mobile
		const shrinkFactor = (activeParticleRatio - 0.4) / 0.6; // 0 to 1 as we go from 40% to 100%
		particleScaling = 1.0 + maxScaling - shrinkFactor * 0.6; // Shrink from 1.15-1.3 to 0.55-0.7
	}

	// Visual feedback during disruption - cursor grows when charged
	if (disruptionIntensity > 0) {
		particleScaling *= 1.0 + disruptionIntensity * 0.6; // Up to 60% larger when hunting
	}

	// Dynamic radius pulsing - less dramatic on mobile, more movement-focused
	const basePulseMagnitude = isMobile
		? activeParticleRatio > 0.7
			? 0.12 // Reduced from 0.15
			: 0.06 // Reduced from 0.08
		: activeParticleRatio > 0.7
			? 0.4
			: 0.18; // Dramatic pulses on desktop
	const pulseMagnitude =
		disruptionIntensity > 0.3
			? basePulseMagnitude * 2.5 // Much stronger pulse when charged
			: basePulseMagnitude;
	const pulseSpeed = disruptionIntensity > 0.3 ? 0.004 : 0.0012; // Slower, more noticeable pulse
	const radiusPulse =
		Math.sin(elapsed * pulseSpeed) * pulseMagnitude +
		Math.sin(elapsed * pulseSpeed * 1.875) * (pulseMagnitude * 0.66) +
		Math.sin(elapsed * pulseSpeed * 0.5) * (pulseMagnitude * 0.4); // Extra slow wave for more variation

	// Update transition blend for smooth manual->auto transition
	if (!isManual && transitionBlend < 1.0) {
		const transitionDuration = 2500; // 2.5 seconds to fully transition back
		const elapsed = Date.now() - transitionStartTime;
		transitionBlend = Math.min(elapsed / transitionDuration, 1.0);
	} else if (isManual) {
		transitionBlend = 0; // Full manual control
	}

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
			// Normal mode: very subtle attraction only in early game
			const timeProgress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);

			// Only attract in early game, and much weaker
			if (timeProgress < 0.3) {
				for (let i = 0; i < outbreaks.length; i++) {
					const o = outbreaks[i];
					const dx = o.x - cursorX;
					const dy = o.y - cursorY;
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

		targetX = baseTargetX + pullX;
		targetY = baseTargetY + pullY;

		const targetRadius = particleScaling * (1.0 + radiusPulse);
		radiusMultiplier += (targetRadius - radiusMultiplier) * 0.1;

		// Smooth following with occasional hesitations - more pronounced in late game
		const hesitation = Math.sin(elapsed * 0.0012) * 0.5 + 0.5;
		const lateGameHesitation = activeParticleRatio > 0.7;
		const damping =
			hesitation < 0.2 ? (lateGameHesitation ? 0.97 : 0.95) : 0.88;

		// During transition, reduce movement influence to let cursor gradually resume auto path
		const transitionFactor = transitionBlend; // 0 = stay where manual left it, 1 = full auto
		const movementStrength = 0.1 + transitionFactor * 0.1; // 0.1 -> 0.2

		cursorVx = (targetX - cursorX) * movementStrength;
		cursorVy = (targetY - cursorY) * movementStrength;
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

		// Energy station shield buff
		if (cursorBuffs.shieldActive) {
			anomalyShieldStrength = Math.max(anomalyShieldStrength, 0.5); // 50% gravity reduction
		}

		for (let i = 0; i < outbreaks.length; i++) {
			const o = outbreaks[i];
			if (o.frame < 240) continue; // Only pull phase

			const dx = o.x - cursorX;
			const dy = o.y - cursorY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Calculate pull radius (same as particle system)
			const pullAge = o.frame - 240;
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

		// Only move cursor after delay
		if (cursorActive) {
			cursorX += cursorVx;
			cursorY += cursorVy;
		}
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

		// Energy station shield buff
		if (cursorBuffs.shieldActive) {
			anomalyShieldStrength = Math.max(anomalyShieldStrength, 0.5); // 50% gravity reduction
		}

		for (let i = 0; i < outbreaks.length; i++) {
			const o = outbreaks[i];
			if (o.frame < 240) continue; // Only pull phase

			const dx = o.x - cursorX;
			const dy = o.y - cursorY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Calculate pull radius (same as particle system)
			const pullAge = o.frame - 240;
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

		// Only move cursor after delay
		if (cursorActive) {
			cursorX += cursorVx;
			cursorY += cursorVy;
		}

		const targetRadius = particleScaling * (1.0 + radiusPulse);
		radiusMultiplier += (targetRadius - radiusMultiplier) * 0.1;
	}

	// Cursor no longer spawns particles - only energy stations heal the field
}

// ============================================================================
// GROWTH SYSTEM
// ============================================================================
function updateGrowth() {
	const elapsed = Date.now() - startTime;
	const time = elapsed * 0.001;
	const spacing = isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP;
	const fadeDistance = spacing * 3; // 3 particle spacings for smooth fade

	let activeCount = 0;
	const progress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);

	let radiusProgress;
	if (progress < 0.6) {
		// First phase: grow from start to 68% (0-60% of duration)
		const growthProgress = progress / 0.6;
		const easedProgress = 1 - Math.pow(1 - growthProgress, 3);
		radiusProgress =
			CONFIG.GROWTH_START_RADIUS +
			easedProgress * (0.68 - CONFIG.GROWTH_START_RADIUS);
	} else {
		// Second phase: very subtle breathing effect (67-69% range)
		const fluctuatePhase = (elapsed - CONFIG.GROWTH_DURATION * 0.6) * 0.0001; // Much slower
		const wave = Math.sin(fluctuatePhase) * 0.5 + 0.5; // 0 to 1
		radiusProgress = 0.67 + wave * 0.02; // Subtle 2% fluctuation instead of 15%
	}

	const baseThreshold = maxParticleDistance * radiusProgress;

	// Blend between blocky (early game) and smooth (late game) edges
	// Early game: blocky "hacker" aesthetic, Late game: smooth organic fade
	const smoothBlend = Math.min(progress * 2.0, 1.0); // 0 at start, 1.0 at 50% progress

	// Organic growth with sine waves for virus-like asymmetry (reduced slightly)
	for (let i = 0; i < list.length; i++) {
		const p = list[i];

		const directionalGrowth =
			Math.sin(p.angle * 3 + time * 0.5) * 0.12 +
			Math.sin(p.angle * 5 - time * 0.8) * 0.08 +
			Math.sin(p.angle * 7 + time * 1.2) * 0.06 +
			Math.sin(time * 2.0 + p.angle) * 0.09;

		const threshold = baseThreshold * (1 + directionalGrowth + p.growthOffset);

		// Calculate how far particle is from threshold (positive = inside, negative = outside)
		const distanceFromThreshold = threshold - p.distFromCenter;

		// Blend between blocky and smooth based on game progress
		if (smoothBlend < 0.1) {
			// Early game: Pure blocky (binary on/off)
			if (distanceFromThreshold > 0) {
				p.fadeAlpha = 1.0;
				p.active = true;
			} else {
				p.fadeAlpha = 0.0;
				p.active = false;
			}
		} else {
			// Transition to smooth fade
			const effectiveFadeDistance = fadeDistance * smoothBlend; // Shrink fade zone when blocky

			if (distanceFromThreshold > effectiveFadeDistance) {
				// Well inside - fully visible
				p.fadeAlpha = 1.0;
				p.active = true;
			} else if (distanceFromThreshold < -effectiveFadeDistance) {
				// Well outside - invisible
				p.fadeAlpha = 0.0;
				p.active = false;
			} else {
				// In fade zone - smoothly transition
				p.active = true; // Keep active during fade
				// Smooth ease curve: 0 at -fadeDistance, 1 at +fadeDistance
				const fadeProgress = (distanceFromThreshold + effectiveFadeDistance) / (effectiveFadeDistance * 2);
				// Ease-in-out for smoother transition
				p.fadeAlpha = fadeProgress * fadeProgress * (3.0 - 2.0 * fadeProgress);
			}
		}

		if (p.fadeAlpha > 0.1) activeCount++; // Count if mostly visible
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
			const baseHealth = 200 + healthBoost; // 200-400 health
			const initialHealth = baseHealth * screenSizeMultiplier; // Scale with screen size

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

			// Scale damage down with more particles - cursor is much stronger with more particles
			// At 0% particles: 100% damage, at 100% particles: 40% damage
			const particleDamageMultiplier = 1.0 - activeParticleRatio * 0.6;
			baseDamage *= particleDamageMultiplier;

			// Energy station damage boost
			let stationBonus = cursorBuffs.damageBoostActive ? 1.25 : 1.0;

			// Black hole kill boost - massive damage increase!
			if (cursorBuffs.blackHoleKillBoostActive) {
				stationBonus *= 2.5; // 2.5x damage multiplier
			}

			// Disruption mode: DRAMATIC damage boost for comebacks
			let disruptionBonus = 1.0;
			if (disruptionIntensity > 0.3) {
				// Base disruption damage scales with how desperate the situation is
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const desperation = Math.max(1.0, 1.0 + blackHoleDominance * 5.0); // 1x to 6x based on dominance

				disruptionBonus = desperation * (1.0 + disruptionIntensity * 2.0); // Up to 18x when desperate

				// Extra bonus if this is the actual target - MASSIVE damage!
				if (disruptionTarget === o) {
					disruptionBonus *= 1.5; // Up to 27x damage to primary target when desperate
				} else if (disruptionSecondaryTarget === o) {
					disruptionBonus *= 1.3; // Up to 23.4x damage to secondary target
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

			o.health -= baseDamage * damageReduction * disruptionBonus * stationBonus;
		}

		if (o.health <= 0) {
			// Black hole destroyed! Grant temporary boost
			if (o.frame >= 240) {
				const now = Date.now();
				cursorBuffs.blackHoleKillBoostActive = true;
				cursorBuffs.blackHoleKillBoostEndTime = now + 8000; // 8 seconds

				// ONE-TIME particle consumption from the black ring area
				// Remove shocked particles in the dark ring (50-70% of pull radius)
				const pullAge = o.frame - 240;
				const initialProgress = Math.min(pullAge / 1800, 1.0);
				const continuousGrowth = Math.min(pullAge / 5400, 1.2);
				const baseMultiplier = CONFIG.OUTBREAK_PULL_RADIUS_MIN + (CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) * initialProgress;
				const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.67;

				// Calculate organic radius with morphing
				const morphPulse = Math.sin(o.frame * 0.03) * 0.08 + Math.sin(o.frame * 0.05) * 0.03 + Math.sin(o.frame * 0.02) * 0.02 + 1.0;
				const organicRadius = o.radius * morphPulse;
				const pullRadius = organicRadius * pullRadiusMultiplier;

				// Black ring area: 50% to 70% of pull radius (where darkness is strongest)
				const blackRingInner = pullRadius * 0.5;
				const blackRingOuter = pullRadius * 0.7;
				const blackRingInnerSq = blackRingInner * blackRingInner;
				const blackRingOuterSq = blackRingOuter * blackRingOuter;

				// Remove shocked particles in the black ring
				for (let i = list.length - 1; i >= 0; i--) {
					const p = list[i];
					const dx = p.x - o.x;
					const dy = p.y - o.y;
					const distSq = dx * dx + dy * dy;

					// Check if particle is in black ring AND currently shocked
					if (distSq > blackRingInnerSq && distSq < blackRingOuterSq && p.shockDisabledUntil > now) {
						p.consumed = true;
					}
				}
			}
			return false;
		}

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

			// Energy station regen boost
			const now = Date.now();
			if (o.regenBoostEndTime && now < o.regenBoostEndTime) {
				regenRate *= 2.5; // 2.5x regen from station capture
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
				// Pull strength scales with black hole dominance
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const pullPower = Math.max(1.0, 1.0 + blackHoleDominance * 2.0); // 1x to 3x stronger
				const pullStrength = disruptionIntensity * 4.0 * pullPower;
				disruptX += (tdx / tDist) * pullStrength;
				disruptY += (tdy / tDist) * pullStrength;
			}

			// Damage over time when marked (weakening effect)
			if (o.frame % 10 === 0) {
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const desperation = Math.max(1.0, 1.0 + blackHoleDominance * 3.0);
				const weakenDamage = disruptionIntensity * 1.0 * desperation;
				o.health -= weakenDamage;
			}
		} else if (disruptionSecondaryTarget === o && disruptionIntensity > 0.3) {
			// Pull secondary target toward primary target (virus collision)
			const tdx = disruptionTarget.x - o.x;
			const tdy = disruptionTarget.y - o.y;
			const tDist = Math.sqrt(tdx * tdx + tdy * tdy);

			if (tDist > 60) {
				// Pull strength scales with black hole dominance
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const pullPower = Math.max(1.0, 1.0 + blackHoleDominance * 2.0); // 1x to 3x stronger
				const pullStrength = disruptionIntensity * 5.0 * pullPower; // Strong pull
				disruptX += (tdx / tDist) * pullStrength;
				disruptY += (tdy / tDist) * pullStrength;
			}

			// Damage over time when marked as secondary
			if (o.frame % 10 === 0) {
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const desperation = Math.max(1.0, 1.0 + blackHoleDominance * 3.0);
				const weakenDamage = disruptionIntensity * 0.8 * desperation;
				o.health -= weakenDamage;
			}

			// Collision damage when viruses get very close
			const collisionDist = tDist;
			if (collisionDist < 100) {
				const impactForce = (100 - collisionDist) / 100;
				if (o.frame % 8 === 0) {
					const blackHoleDominance = 1.0 - activeParticleRatio;
					const desperation = Math.max(1.0, 1.0 + blackHoleDominance * 3.0);
					const collisionDamage =
						impactForce * disruptionIntensity * 1.5 * desperation;
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

		// Organic growth morphing (reduced for smoother feel)
		const morphVariation =
			Math.sin(o.frame * 0.03) * 0.04 +
			Math.sin(o.frame * 0.07) * 0.03 +
			Math.cos(o.frame * 0.02) * 0.02;

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

		// SHOCK WAVE: Disabled - cursor spawns particles instead
		// if (o.frame >= 240) {
		// 	const pullAge = o.frame - 240;
		// 	const initialProgress = Math.min(pullAge / 1800, 1.0);
		//
		// 	// Only trigger if black hole is large enough (>50% through initial growth)
		// 	if (initialProgress > 0.5) {
		// 		const now = Date.now();
		// 		const cooldown = isMobile
		// 			? CONFIG.SHOCK_WAVE_COOLDOWN_MOBILE
		// 			: CONFIG.SHOCK_WAVE_COOLDOWN;
		//
		// 		// Check if we can trigger a shock wave
		// 		if (now >= nextShockWaveTime) {
		// 			// Trigger shock wave from this black hole
		// 			shockWaves.push({
		// 				x: o.x,
		// 				y: o.y,
		// 				radius: 0,
		// 				spawnTime: now,
		// 			});
		// 			nextShockWaveTime = now + cooldown;
		// 		}
		// 	}
		// }

		// Keep viruses alive - only remove when killed
		return true;
	});
}

// ============================================================================
// SHOCK WAVE SYSTEM
// ============================================================================
function updateShockWaves() {
	const now = Date.now();

	// Update all active shock waves
	shockWaves = shockWaves.filter(sw => {
		const age = now - sw.spawnTime;

		// Store previous radius to detect newly hit particles
		const prevRadius = sw.radius;
		sw.radius += CONFIG.SHOCK_WAVE_EXPANSION_SPEED;

		// Spawn particles at the wave edge (creates visible expanding ring effect)
		// Only spawn every ~50px of radius growth to avoid performance issues
		// Only spawn if below initial particle count
		if ((!sw.lastSpawnRadius || sw.radius - sw.lastSpawnRadius > 50) && list.length < initialParticleCount) {
			const spacing = isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP;
			const particleCount = Math.floor(15 / spacing); // Fewer particles than energy stations
			const maxToSpawn = Math.max(0, initialParticleCount - list.length);
			const circleRadius = sw.radius + CONFIG.SHOCK_WAVE_THICKNESS / 2; // Middle of wave

			// Spawn particles in a ring pattern
			for (let i = 0; i < Math.min(particleCount, maxToSpawn); i++) {
				const angle = (i / particleCount) * Math.PI * 2;
				const px = sw.x + Math.cos(angle) * circleRadius;
				const py = sw.y + Math.sin(angle) * circleRadius;
				const particle = new Particle(px, py, centerX, centerY);
				particle.active = true;
				// Give slight outward velocity
				particle.vx = Math.cos(angle) * 1.5;
				particle.vy = Math.sin(angle) * 1.5;
				list.push(particle);
			}

			sw.lastSpawnRadius = sw.radius;
		}

		// Disable particles hit by the expanding wave
		const innerRadius = prevRadius;
		const outerRadius = sw.radius + CONFIG.SHOCK_WAVE_THICKNESS;

		for (let i = 0; i < list.length; i++) {
			const p = list[i];
			if (!p.active) continue;

			// Skip if particle is already disabled by a shock wave
			if (p.shockDisabledUntil > now) continue;

			const dx = p.x - sw.x;
			const dy = p.y - sw.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Check if particle is within the expanding wave ring
			if (dist >= innerRadius && dist < outerRadius) {
				// Disable this particle
				p.shockDisabledUntil = now + CONFIG.SHOCK_WAVE_PARTICLE_DISABLE_DURATION;
			}
		}

		// Remove wave after lifetime
		return age < CONFIG.SHOCK_WAVE_LIFETIME;
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
				// Pull strength scales with black hole dominance
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const pullPower = Math.max(1.0, 1.0 + blackHoleDominance * 2.0); // 1x to 3x stronger
				const pullStrength = disruptionIntensity * 5.0 * pullPower;
				anomalyPullX = (tdx / tDist) * pullStrength;
				anomalyPullY = (tdy / tDist) * pullStrength;
			}

			// Damage over time when marked
			if (a.frame % 10 === 0) {
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const desperation = Math.max(1.0, 1.0 + blackHoleDominance * 3.0);
				const weakenDamage = disruptionIntensity * 1.0 * desperation;
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
			let damage = isManual ? 2.0 : 1.0;

			// Scale damage down with more particles - cursor is much stronger with more particles
			const particleDamageMultiplier = 1.0 - activeParticleRatio * 0.6;
			damage *= particleDamageMultiplier;

			// Energy station damage boost
			let stationBonus = cursorBuffs.damageBoostActive ? 1.25 : 1.0;

			// Black hole kill boost - massive damage increase!
			if (cursorBuffs.blackHoleKillBoostActive) {
				stationBonus *= 2.5; // 2.5x damage multiplier
			}

			// Disruption mode damage boost - DRAMATIC for comebacks
			let disruptionBonus = 1.0;
			if (disruptionIntensity > 0.3) {
				// Base disruption damage scales with how desperate the situation is
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const desperation = Math.max(1.0, 1.0 + blackHoleDominance * 5.0); // 1x to 6x based on dominance

				disruptionBonus = desperation * (1.0 + disruptionIntensity * 2.0); // Up to 18x when desperate
				if (disruptionTarget === a) {
					disruptionBonus *= 1.5; // Up to 27x damage to marked anomaly when desperate
				}
			}

			a.health -= damage * disruptionBonus * stationBonus;
		}

		return a.health > 0 && a.frame < 18000; // Live for max 5 minutes
	});
}

// ============================================================================
// ENERGY STATION SYSTEM
// ============================================================================
function updateStations() {
	const now = Date.now();
	const elapsed = now - startTime;

	// Spawn stations rarely (max 2 at a time for performance)
	if (
		now >= nextStationTime &&
		activeParticleRatio > 0.25 &&
		stations.length < 2
	) {
		let stationX, stationY;

		// Find active black holes that are consuming particles
		const consumingBlackHoles = outbreaks.filter(o => {
			const pullAge = o.frame - 240;
			return o.frame >= 240 && pullAge > 1200; // In pull phase and consuming
		});

		// 60% chance to spawn inside a black hole if any exist
		if (consumingBlackHoles.length > 0 && Math.random() < 0.6) {
			// Pick a random consuming black hole
			const targetBlackHole = consumingBlackHoles[Math.floor(Math.random() * consumingBlackHoles.length)];

			// Spawn near the center of the black hole (within 40% of radius)
			const spawnAngle = Math.random() * Math.PI * 2;
			const spawnDist = Math.random() * targetBlackHole.radius * 0.4;

			stationX = targetBlackHole.x + Math.cos(spawnAngle) * spawnDist;
			stationY = targetBlackHole.y + Math.sin(spawnAngle) * spawnDist;
		} else {
			// Normal spawn: random position around center
			const angle = Math.random() * Math.PI * 2;
			const distance = (0.25 + Math.random() * 0.25) * Math.min(w, h);

			stationX = centerX + Math.cos(angle) * distance;
			stationY = centerY + Math.sin(angle) * distance;
		}

		// Random drift direction
		const driftAngle = Math.random() * Math.PI * 2;

		stations.push({
			x: stationX,
			y: stationY,
			driftAngle: driftAngle,
			frame: 0,
			spawnTime: now,
			captured: false,
			ripples: [], // Active ripple waves
			nextRippleTime: now + 3000, // First ripple after 3 seconds
		});

		const spawnInterval =
			CONFIG.STATION_SPAWN_MIN +
			Math.random() * (CONFIG.STATION_SPAWN_MAX - CONFIG.STATION_SPAWN_MIN);
		nextStationTime = now + spawnInterval;
	}

	// Update stations
	stations = stations.filter((s) => {
		s.frame++;
		const age = now - s.spawnTime;

		// Despawn if too old
		if (age > CONFIG.STATION_LIFETIME) return false;

		// Drift slowly
		s.x += Math.cos(s.driftAngle) * CONFIG.STATION_DRIFT_SPEED;
		s.y += Math.sin(s.driftAngle) * CONFIG.STATION_DRIFT_SPEED;

		// Bounce off edges
		if (s.x < 50 || s.x > w - 50) {
			s.driftAngle = Math.PI - s.driftAngle;
		}
		if (s.y < 50 || s.y > h - 50) {
			s.driftAngle = -s.driftAngle;
		}

		// Static ring formation - no expansion or fading
		// Only create one ring per station at a fixed radius
		if (s.ripples.length === 0) {
			s.ripples.push({
				radius: 80, // Fixed radius for static formation
				alpha: 1.0, // Always visible
				birthTime: now,
				lastParticleSpawn: 0,
			});
		}

		// Update the single static ring
		const ripple = s.ripples[0];

		// Spawn particles more frequently to help rebuild field
		// Only spawn if below initial particle count (don't over-populate)
		if ((!ripple.lastParticleSpawn || now - ripple.lastParticleSpawn > 800) && list.length < initialParticleCount) {
			const spacing = isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP;
			// Spawn more particles for better field regeneration
			const baseParticles = isMobile ? 10 : 8;
			const particleCount = Math.floor(baseParticles / spacing);
			const maxToSpawn = Math.max(0, initialParticleCount - list.length);

			// Spawn particles at the ring radius so they join the rotation naturally
			for (let i = 0; i < Math.min(particleCount, maxToSpawn); i++) {
				const angle = (Math.random() * Math.PI * 2);
				const px = s.x + Math.cos(angle) * ripple.radius;
				const py = s.y + Math.sin(angle) * ripple.radius;
				const particle = new Particle(px, py, centerX, centerY);
				particle.active = true;
				particle.fadeAlpha = 0.0; // Fade in gradually
				// Give slight tangential velocity to join the rotation
				particle.vx = -Math.sin(angle) * 2.0; // Tangential velocity
				particle.vy = Math.cos(angle) * 2.0;
				list.push(particle);
			}

			ripple.lastParticleSpawn = now;
		}

		// Check cursor capture - only when manually controlled
		if (isManual) {
			const dxCursor = cursorX - s.x;
			const dyCursor = cursorY - s.y;
			const distCursor = Math.sqrt(dxCursor * dxCursor + dyCursor * dyCursor);

			if (distCursor < CONFIG.STATION_CAPTURE_RADIUS) {
				// Cursor captures station - just remove it, no buffs
				return false; // Remove station
			}
		}

		// Check virus capture
		for (let i = 0; i < outbreaks.length; i++) {
			const v = outbreaks[i];
			const dx = v.x - s.x;
			const dy = v.y - s.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist < CONFIG.STATION_CAPTURE_RADIUS + v.radius * 0.5) {
				// Virus captures station - apply regen boost
				v.regenBoostEndTime = now + 15000; // 15 seconds of boosted regen

				// VISUAL FEEDBACK: Spawn particle stream from station to virus
				// Only spawn if below initial particle count
				if (list.length < initialParticleCount) {
					const angle = Math.atan2(-dy, -dx); // Toward virus
					const particleCount = 20; // More particles for bigger entity
					const maxToSpawn = Math.max(0, initialParticleCount - list.length);
					for (let i = 0; i < Math.min(particleCount, maxToSpawn); i++) {
						const progress = i / particleCount; // 0 to 1
						const px = s.x - dx * progress;
						const py = s.y - dy * progress;
						const particle = new Particle(px, py, centerX, centerY);
						particle.active = true;
						// Velocity toward virus
						particle.vx = Math.cos(angle) * 5.0;
						particle.vy = Math.sin(angle) * 5.0;
						list.push(particle);
					}
				}

				return false; // Remove station
			}
		}

		// Check anomaly capture
		for (let i = 0; i < anomalies.length; i++) {
			const a = anomalies[i];
			const dx = a.x - s.x;
			const dy = a.y - s.y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist < CONFIG.STATION_CAPTURE_RADIUS) {
				// Anomaly captures station - apply vortex boost
				a.vortexBoostEndTime = now + 12000; // 12 seconds of boosted vortex

				// VISUAL FEEDBACK: Spawn spiral particle stream from station to anomaly
				// Only spawn if below initial particle count
				if (list.length < initialParticleCount) {
					const particleCount = 18;
					const maxToSpawn = Math.max(0, initialParticleCount - list.length);
					for (let i = 0; i < Math.min(particleCount, maxToSpawn); i++) {
						const progress = i / particleCount; // 0 to 1
						const spiralOffset = progress * Math.PI * 2; // One full rotation
						const px = s.x - dx * progress + Math.cos(spiralOffset) * 15;
						const py = s.y - dy * progress + Math.sin(spiralOffset) * 15;
						const particle = new Particle(px, py, centerX, centerY);
						particle.active = true;
						// Velocity toward anomaly with spiral
						const angle = Math.atan2(-dy, -dx);
						particle.vx = Math.cos(angle) * 4.5;
						particle.vy = Math.sin(angle) * 4.5;
						list.push(particle);
					}
				}

				return false; // Remove station
			}
		}

		return true; // Keep station
	});

	// Update cursor buffs expiration
	if (cursorBuffs.shieldActive && now > cursorBuffs.shieldEndTime) {
		cursorBuffs.shieldActive = false;
	}
	if (cursorBuffs.damageBoostActive && now > cursorBuffs.damageBoostEndTime) {
		cursorBuffs.damageBoostActive = false;
	}
	if (
		cursorBuffs.blackHoleKillBoostActive &&
		now > cursorBuffs.blackHoleKillBoostEndTime
	) {
		cursorBuffs.blackHoleKillBoostActive = false;
	}
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

	// Calculate screen size balancing multiplier
	// Base: 1920x1080 = 1.0, larger screens get higher multiplier for enemies
	const baseScreenArea = 1920 * 1080;
	const currentScreenArea = w * h;
	screenSizeMultiplier = Math.sqrt(currentScreenArea / baseScreenArea);
	// Cap between 0.7 and 1.5 for reasonable scaling
	screenSizeMultiplier = Math.max(0.7, Math.min(1.5, screenSizeMultiplier));

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

	initialParticleCount = list.length; // Store initial count to prevent over-spawning
	maxParticleDistance = Math.max(...list.map((p) => p.distFromCenter));

	// Start cursor at center (hidden during spawn)
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

	// Randomize cursor delay - 10 to 13 seconds before cursor becomes active
	cursorDelay = 10000 + Math.random() * 3000; // 10-13 seconds

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

	// Randomize first station spawn time
	const firstStationDelay = 40000 + Math.random() * 20000; // 40-60 seconds
	nextStationTime = startTime + firstStationDelay;

	const handleInput = (clientX, clientY) => {
		if (manualTimeout) clearTimeout(manualTimeout);

		const bounds = canvas.getBoundingClientRect();
		targetX = (clientX - bounds.left) * (w / bounds.width);
		targetY = (clientY - bounds.top) * (h / bounds.height);

		if (!isManual) {
			// Switching from auto to manual
			transitionBlend = 0; // Full manual
		}
		isManual = true;

		manualTimeout = setTimeout(() => {
			// Start smooth transition back to automatic
			isManual = false;
			transitionStartTime = Date.now();
		}, CONFIG.MANUAL_TIMEOUT);
	};

	if (isMobile) {
		// Touch events for actual mobile devices
		canvas.addEventListener(
			"touchstart",
			(e) => {
				// Check if touch is on debug icon - let it through
				const target = e.target;
				const debugIcon = document.getElementById('debug-icon');
				if (debugIcon && (target === debugIcon || debugIcon.contains(target))) {
					return; // Let the debug icon handle its own touch events
				}

				e.preventDefault();
				if (e.touches.length > 0) {
					handleInput(e.touches[0].clientX, e.touches[0].clientY);
				}
			},
			{ passive: false },
		);
		canvas.addEventListener(
			"touchmove",
			(e) => {
				// Check if touch is on debug icon - let it through
				const target = e.target;
				const debugIcon = document.getElementById('debug-icon');
				if (debugIcon && (target === debugIcon || debugIcon.contains(target))) {
					return; // Let the debug icon handle its own touch events
				}

				e.preventDefault();
				if (e.touches.length > 0) {
					handleInput(e.touches[0].clientX, e.touches[0].clientY);
				}
			},
			{ passive: false },
		);
		// Also support mouse for testing in responsive mode
		canvas.addEventListener("mousemove", (e) => {
			handleInput(e.clientX, e.clientY);
		});
	} else {
		document.addEventListener("mousemove", (e) => {
			handleInput(e.clientX, e.clientY);
		});
	}

	container.appendChild(canvas);

	// Initialize debug panel (activated with '?' key)
	if (typeof DebugPanel !== 'undefined') {
		debugPanel = new DebugPanel();
	}
}

// ============================================================================
// DEBUG PANEL
// ============================================================================
function updateDebugPanel() {
	if (!debugPanel) return;

	const now = Date.now();
	const elapsed = now - startTime;
	const minutes = Math.floor(elapsed / 60000);
	const seconds = Math.floor((elapsed % 60000) / 1000);

	// Calculate growth phase
	const growthRatio = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1.0);
	let growthPhase;
	if (growthRatio < 0.6) {
		growthPhase = `Expanding (${(growthRatio * 100).toFixed(0)}%)`;
	} else {
		growthPhase = `Fluctuating (${(growthRatio * 100).toFixed(0)}%)`;
	}

	// Find largest black hole
	let largestBlackHole = null;
	let largestPullRadius = 0;
	const screenDiagonal = Math.sqrt(w * w + h * h);

	for (let i = 0; i < outbreaks.length; i++) {
		const o = outbreaks[i];
		if (o.frame < 240) continue;

		const pullAge = o.frame - 240;
		const initialProgress = Math.min(pullAge / 1800, 1.0);
		const continuousGrowth = Math.min(pullAge / 5400, 1.2);
		const baseMultiplier =
			CONFIG.OUTBREAK_PULL_RADIUS_MIN +
			(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
				initialProgress;
		const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.67; // Reaches ~4x at 90 seconds
		const pullRadius = o.radius * pullRadiusMultiplier;

		if (pullRadius > largestPullRadius) {
			largestPullRadius = pullRadius;
			largestBlackHole = o;
		}
	}

	// Collect cursor buffs
	const buffs = [];
	if (cursorBuffs.shieldActive) {
		const remaining = Math.ceil((cursorBuffs.shieldEndTime - now) / 1000);
		buffs.push(`Shield (${remaining}s)`);
	}
	if (cursorBuffs.damageBoostActive) {
		const remaining = Math.ceil((cursorBuffs.damageBoostEndTime - now) / 1000);
		buffs.push(`Damage Boost (${remaining}s)`);
	}
	if (cursorBuffs.blackHoleKillBoostActive) {
		const remaining = Math.ceil((cursorBuffs.blackHoleKillBoostEndTime - now) / 1000);
		buffs.push(`⚡ EMPOWERED (${remaining}s)`);
	}

	// Prepare debug data
	const debugData = {
		time: {
			elapsed: `${minutes}:${seconds.toString().padStart(2, "0")}`,
		},
		particles: {
			active: list.filter(p => p.active).length,
			total: list.length,
			percentage: (activeParticleRatio * 100).toFixed(1),
			spacing: isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP,
			growthPhase: growthPhase,
		},
		cursor: {
			x: Math.floor(cursorX),
			y: Math.floor(cursorY),
			vx: cursorVx.toFixed(2),
			vy: cursorVy.toFixed(2),
			speed: Math.sqrt(cursorVx * cursorVx + cursorVy * cursorVy).toFixed(2),
			radius: Math.floor(CONFIG.REPULSION_RADIUS * radiusMultiplier),
			radiusMultiplier: radiusMultiplier.toFixed(2),
			damageMultiplier: (1.0 - activeParticleRatio * 0.6).toFixed(2),
			mode: isManual ? 'Manual' : 'Auto',
			buffs: buffs,
		},
		viruses: {
			count: outbreaks.length,
			nextSpawn: nextOutbreakTime > now ? `${Math.ceil((nextOutbreakTime - now) / 1000)}s` : 'Ready',
			largest: largestBlackHole ? {
				health: Math.floor(largestBlackHole.health),
				maxHealth: largestBlackHole.maxHealth,
				healthPercent: ((largestBlackHole.health / largestBlackHole.maxHealth) * 100).toFixed(0),
				radius: Math.floor(largestBlackHole.radius),
				frame: largestBlackHole.frame,
				phase: largestBlackHole.frame < 240 ? 'PUSH' : 'PULL',
				pullRadius: Math.floor(largestPullRadius),
				pullForce: (largestPullRadius / largestBlackHole.radius).toFixed(1),
				regenActive: largestBlackHole.regenBoostEndTime && now < largestBlackHole.regenBoostEndTime,
			} : null,
		},
		anomalies: {
			count: anomalies.length,
			vortexRadius: anomalies.length > 0 ? Math.floor(anomalies[0].vortexRadius || CONFIG.ANOMALY_VORTEX_RADIUS) : 0,
			vortexStrength: anomalies.length > 0 ? (anomalies[0].vortexStrength || CONFIG.ANOMALY_VORTEX_STRENGTH).toFixed(2) : 0,
		},
		stations: {
			count: stations.length,
			nextSpawn: nextStationTime > now ? `${Math.ceil((nextStationTime - now) / 1000)}s` : 'Ready',
			list: stations.map(s => {
				const age = now - s.spawnTime;
				return {
					x: Math.floor(s.x),
					y: Math.floor(s.y),
					age: Math.floor(age / 1000),
					lifetime: Math.floor(CONFIG.STATION_LIFETIME / 1000),
					agePercent: ((age / CONFIG.STATION_LIFETIME) * 100).toFixed(0),
					rippleCount: s.ripples ? s.ripples.length : 0,
					rippleInterval: Math.floor(3000 - (age / CONFIG.STATION_LIFETIME) * 2700),
				};
			}),
		},
		performance: {
			fps: Math.round(1000 / (now - lastFrameTime)),
			canvasWidth: w,
			canvasHeight: h,
			screenMultiplier: screenSizeMultiplier.toFixed(2),
			isMobile: isMobile,
		},
		gameState: {
			disruption: {
				available: largestBlackHole && largestPullRadius >= screenDiagonal * 0.7,
				cooldownRemaining: nextDisruptionTime > now ? Math.ceil((nextDisruptionTime - now) / 1000) : 0,
				coverage: largestBlackHole ? ((largestPullRadius / screenDiagonal) * 100).toFixed(1) : '0.0',
				power: disruptionActive ? (disruptionIntensity * 4).toFixed(1) : '0.0',
			},
		},
	};

	debugPanel.update(debugData);
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
		updateStations();
		// Shock waves disabled - cursor spawns particles instead
		// updateShockWaves();
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

		// Remove consumed particles (permanently deleted by black holes)
		list = list.filter(p => !p.consumed);
	} else {
		// RENDER FRAME
		// Apply cursor repulsion on render frames too to prevent trails when moving fast
		for (let i = 0; i < list.length; i++) {
			list[i].applyCursorRepulsion(cursorX, cursorY, radiusMultiplier);
		}

		// Create fresh ImageData each frame (faster than clearing)
		imageData = ctx.createImageData(w, h);
		const data = imageData.data;

		const baseColor = CONFIG.COLOR;
		for (let i = 0; i < list.length; i++) {
			const p = list[i];
			if (!p.active || p.fadeAlpha < 0.01) continue; // Skip if invisible

			const px = Math.floor(p.x);
			const py = Math.floor(p.y);
			if (px < 0 || px >= w || py < 0 || py >= h) continue;

			// Start with fade alpha (smooth grow/shrink)
			let fadeVisibility = p.fadeAlpha;
			let blackHoleDimming = 1.0; // Separate from fade

			// Black holes reduce visibility of particles
			for (let j = 0; j < outbreaks.length; j++) {
				const o = outbreaks[j];
				if (o.frame < 240) continue; // Only pull phase

				const dx = p.x - o.x;
				const dy = p.y - o.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				// Calculate pull radius (must match particle physics calculations)
				const pullAge = o.frame - 240;
				const initialProgress = Math.min(pullAge / 1800, 1.0);
				const continuousGrowth = Math.min(pullAge / 5400, 1.2);
				const baseMultiplier =
					CONFIG.OUTBREAK_PULL_RADIUS_MIN +
					(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
						initialProgress;
				const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.67;

				// Calculate organic radius with morphing (match particle physics)
				const morphPulse = Math.sin(o.frame * 0.03) * 0.08 + Math.sin(o.frame * 0.05) * 0.03 + Math.sin(o.frame * 0.02) * 0.02 + 1.0;
				const organicRadius = o.radius * morphPulse;
				const pullRadius = organicRadius * pullRadiusMultiplier;

				if (dist < pullRadius) {
					// Original ring of darkness effect - grey gradient → black ring → visible center with particles
					const fadeProgress = 1.0 - dist / pullRadius;

					let dimming;
					if (fadeProgress < 0.6) {
						// Outer area: gradually darken with smooth gradient (grey)
						dimming = fadeProgress * 0.5; // 0% to 30% darkening
					} else {
						// Inner area: black ring that recovers toward center
						const recovery = (fadeProgress - 0.6) / 0.4;
						dimming = 0.3 + recovery * 0.4; // Peak at 70% dark, then lighter
					}

					blackHoleDimming = Math.min(blackHoleDimming, 1.0 - dimming);
				}
			}

			const idx = (px + py * w) * 4;
			// Combine fade (alpha) with black hole dimming (darkening)
			const color = baseColor * blackHoleDimming;
			data[idx] = data[idx + 1] = data[idx + 2] = color;
			data[idx + 3] = Math.floor(255 * fadeVisibility); // Fade affects alpha channel
		}

		ctx.putImageData(imageData, 0, 0);

		// Shock waves affect particles only - no visual markers drawn on canvas
		// The expanding wave disables particles it touches (see updateShockWaves function)

		// Cursor buffs now only visible through particle behavior (no canvas drawing)
		// Energy stations now only visible through particle ring/burst effects (no visual marker)
	}

	updateDebugPanel();
	requestAnimationFrame(step);
}

// ============================================================================
// RESIZE HANDLER
// ============================================================================
let resizeTimeout = null;
let lastWidth = 0;
let lastHeight = 0;

function handleResize() {
	const currentWidth = window.innerWidth;
	const currentHeight = window.innerHeight;

	// Only resize if dimensions changed significantly
	// On mobile, ignore height changes (URL bar showing/hiding) - only resize on width change or rotation
	const widthDiff = Math.abs(currentWidth - lastWidth);
	const heightDiff = Math.abs(currentHeight - lastHeight);

	const isMobileDevice = window.innerWidth <= 768 || window.matchMedia("(orientation: portrait)").matches;

	if (isMobileDevice) {
		// Mobile: only resize if width changed significantly (rotation/zoom)
		if (widthDiff < 100) {
			return;
		}
	} else {
		// Desktop: resize if either dimension changed significantly
		if (widthDiff < 50 && heightDiff < 50) {
			return;
		}
	}

	lastWidth = currentWidth;
	lastHeight = currentHeight;

	// Clear old canvas
	if (canvas && canvas.parentNode) {
		canvas.parentNode.removeChild(canvas);
	}

	// Reset state
	list = [];
	outbreaks = [];
	anomalies = [];
	stations = [];
	shockWaves = [];
	cursorVx = 0;
	cursorVy = 0;
	radiusMultiplier = 1.0;
	pathTime = 0;
	disruptionActive = false;
	disruptionIntensity = 0;
	nextShockWaveTime = 0;

	// Reinitialize
	init();

	// Append new canvas
	if (canvas && container) {
		container.appendChild(canvas);
	}
}

// ============================================================================
// DEBUG SPAWN FUNCTIONS
// ============================================================================
window.debugSpawnVirus = function() {
	// Try to spawn away from cursor to avoid instant dissolution
	let x, y, attempts = 0;
	const safeDistance = 150; // Stay at least 150px from cursor

	do {
		const angle = Math.random() * Math.PI * 2;
		const distance = Math.random() * Math.min(w, h) * 0.4;
		x = centerX + Math.cos(angle) * distance;
		y = centerY + Math.sin(angle) * distance;

		const dx = cursorX - x;
		const dy = cursorY - y;
		const distToCursor = Math.sqrt(dx * dx + dy * dy);

		if (distToCursor > safeDistance || attempts > 10) break;
		attempts++;
	} while (true);

	const baseHealth = Math.floor(
		CONFIG.OUTBREAK_HEALTH_MIN +
		Math.random() * (CONFIG.OUTBREAK_HEALTH_MAX - CONFIG.OUTBREAK_HEALTH_MIN)
	);
	const scaledHealth = baseHealth * screenSizeMultiplier;

	outbreaks.push({
		x: x,
		y: y,
		radius: 0,
		maxRadius: isMobile ? CONFIG.OUTBREAK_MAX_RADIUS_MOBILE : CONFIG.OUTBREAK_MAX_RADIUS,
		health: scaledHealth,
		maxHealth: scaledHealth,
		frame: 0,
		maxed: false,
	});
	console.log('Spawned virus at', x.toFixed(0), y.toFixed(0), 'distance from cursor:', Math.sqrt((cursorX-x)*(cursorX-x)+(cursorY-y)*(cursorY-y)).toFixed(0));
};

window.debugSpawnAnomaly = function() {
	// Try to spawn away from cursor
	let orbitCenterX, orbitCenterY, attempts = 0;
	const safeDistance = 150;

	do {
		const angle = Math.random() * Math.PI * 2;
		const orbitDistance = (0.2 + Math.random() * 0.2) * Math.min(w, h);
		orbitCenterX = centerX + Math.cos(angle) * orbitDistance;
		orbitCenterY = centerY + Math.sin(angle) * orbitDistance;

		const dx = cursorX - orbitCenterX;
		const dy = cursorY - orbitCenterY;
		const distToCursor = Math.sqrt(dx * dx + dy * dy);

		if (distToCursor > safeDistance || attempts > 10) break;
		attempts++;
	} while (true);

	anomalies.push({
		x: orbitCenterX,
		y: orbitCenterY,
		orbitCenterX: orbitCenterX,
		orbitCenterY: orbitCenterY,
		angle: Math.random() * Math.PI * 2,
		orbitRadius: 40 + Math.random() * 40,
		orbitSpeed: 0.01 + Math.random() * 0.01,
		driftTargetX: centerX,
		driftTargetY: centerY,
		frame: 0,
		health: 100,
		vortexRadius: CONFIG.ANOMALY_VORTEX_RADIUS,
		vortexStrength: CONFIG.ANOMALY_VORTEX_STRENGTH,
	});
	console.log('Spawned anomaly at', orbitCenterX.toFixed(0), orbitCenterY.toFixed(0));
};

window.debugSpawnStation = function() {
	// Debug mode: no limit on stations (normal gameplay limits to 2 for performance)
	// Try to spawn away from cursor for easier testing
	let x, y, attempts = 0;
	const safeDistance = 100; // Stations can be closer since they're meant to be collected

	do {
		const angle = Math.random() * Math.PI * 2;
		const distance = (0.25 + Math.random() * 0.25) * Math.min(w, h);
		x = centerX + Math.cos(angle) * distance;
		y = centerY + Math.sin(angle) * distance;

		const dx = cursorX - x;
		const dy = cursorY - y;
		const distToCursor = Math.sqrt(dx * dx + dy * dy);

		if (distToCursor > safeDistance || attempts > 10) break;
		attempts++;
	} while (true);

	const driftAngle = Math.random() * Math.PI * 2;

	stations.push({
		x: x,
		y: y,
		driftAngle: driftAngle,
		frame: 0,
		spawnTime: Date.now(),
		captured: false,
		ripples: [],
		nextRippleTime: Date.now() + 3000,
	});
	console.log('Spawned station at', x.toFixed(0), y.toFixed(0));
};

window.addEventListener("resize", () => {
	// Debounce: wait 300ms after resize stops before reinitializing
	if (resizeTimeout) {
		clearTimeout(resizeTimeout);
	}
	resizeTimeout = setTimeout(handleResize, 300);
});

init();
lastWidth = window.innerWidth;
lastHeight = window.innerHeight;
step();
