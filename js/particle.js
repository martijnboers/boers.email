"use strict";

import { CONFIG } from './config.js';

export class Particle {
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
        this.recycledUntil = 0;
	}

	update(state) {
        const {
            cursorX, cursorY, radiusMultiplier, spiralStrength, outbreaks,
            anomalies, cursorVx, cursorVy, isManual, cursorBuffs, isMobile,
            activeParticleRatio
        } = state;

		if (!this.active) return;

		const dx = cursorX - this.x;
		const dy = cursorY - this.y;
		const distSq = dx * dx + dy * dy;
		const dist = Math.sqrt(distSq);

		// Pulsating pull-push effect for cursor buffs
		let buffRadiusMultiplier = 1.0;
		let buffForceMultiplier = 1.0;
		let hasPulsatingBuff = false;
		let pulseStrength = 0;
		const now = Date.now();

		// During manual control, reduce buff intensity for smoother control
		const manualReduction = isManual ? 0.3 : 1.0; // 30% strength when manual

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
			radiusMultiplier *
			radiusMultiplier *
			buffRadiusMultiplier *
			buffRadiusMultiplier;

		// V-Shaped Hull Displacement
        const cursorSpeed = Math.sqrt(cursorVx * cursorVx + cursorVy * cursorVy);
        if (cursorSpeed > 0.5 && distSq < dynamicRadiusSq * 1.5) {
            const cursorDirX = cursorVx / cursorSpeed;
            const cursorDirY = cursorVy / cursorSpeed;

            // Transform particle to cursor's local coordinate system
            const localX = -dx * cursorDirX - dy * cursorDirY;
            const localY = -dx * cursorDirY + dy * cursorDirX;

            // Define V-shape angle based on speed (wider at low speed, narrower at high speed)
            const coneAngle = Math.PI / 2.5 - Math.min(cursorSpeed / 10, 1) * (Math.PI / 4);
            const tanAngle = Math.tan(coneAngle);

            // Check if particle is within the V-shape in front of the cursor
            if (localX > 0 && localX < Math.sqrt(dynamicRadiusSq) && Math.abs(localY) < localX * tanAngle) {
                // Determine which side of the V to push from
                const pushDirX = localY > 0 ? -cursorDirY : cursorDirY;
                const pushDirY = localY > 0 ? cursorDirX : -cursorDirX;

                const force = (1.0 - (localX / Math.sqrt(dynamicRadiusSq))) * cursorSpeed * 0.8;
                
                this.vx += pushDirX * force;
                this.vy += pushDirY * force;
            }
        }

		// Standard repulsion and spiral (acts as a base)
		if (distSq < dynamicRadiusSq) {
			const safeDist = Math.max(distSq, 1);
			const baseForce =
				(-dynamicRadiusSq / safeDist) * CONFIG.REPULSION_STRENGTH * buffForceMultiplier * 0.5; // Reduced strength
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

		// Pulsating wave effect for cursor buffs - simple symmetric effect
		if (hasPulsatingBuff) {
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

				// Very slow progression - takes 30 seconds to reach initial full power
				const initialProgress = Math.min(pullAge / 1800, 1.0);

				// Then continues growing much more slowly over 90 seconds total
				const continuousGrowth = Math.min(pullAge / 5400, 1.2); // Up to 1.2x over 90 seconds

				// Pull radius grows from 50% to 200%, then up to 320% over 90 seconds
				const baseMultiplier =
					CONFIG.OUTBREAK_PULL_RADIUS_MIN +
					(CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) *
						initialProgress;
				const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.67; // Reaches ~4x at 90 seconds
				const pullRadius = organicRadius * pullRadiusMultiplier;
				const pullRadiusSq = pullRadius * pullRadius;

				if (oDistSq < pullRadiusSq) {
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
        
        // Glyph capture stream
        for (const glyph of state.glyphs) {
            if (glyph.isCapturing && glyph.captureTarget) {
                const tdx = glyph.captureTarget.x - this.x;
                const tdy = glyph.captureTarget.y - this.y;
                if (tdx * tdx + tdy * tdy < 150 * 150) {
                    this.vx += tdx * 0.03;
                    this.vy += tdy * 0.03;
                }
            }
        }

		this.vx *= CONFIG.PARTICLE_DRAG;
		this.vy *= CONFIG.PARTICLE_DRAG;
		this.x += this.vx + (this.ox - this.x) * CONFIG.PARTICLE_EASE;
		this.y += this.vy + (this.oy - this.y) * CONFIG.PARTICLE_EASE;
	}
}

export function updateGrowth(state) {
    const { startTime, list, maxParticleDistance } = state;
	const elapsed = Date.now() - startTime;
	const progress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);

	let radiusProgress;
	if (progress < 0.6) {
		// First phase: grow from 8% to 68% (0-60% of duration, quicker than before)
		const growthProgress = progress / 0.6;
		const easedProgress = 1 - Math.pow(1 - growthProgress, 3);
		radiusProgress =
			CONFIG.GROWTH_START_RADIUS +
			easedProgress * (0.68 - CONFIG.GROWTH_START_RADIUS);
	} else {
		// Second phase: fluctuate between 55% and 70%
		const fluctuatePhase = (elapsed - CONFIG.GROWTH_DURATION * 0.6) * 0.0003; // Slow oscillation
		const wave = Math.sin(fluctuatePhase) * 0.5 + 0.5; // 0 to 1
		radiusProgress = 0.55 + wave * 0.15; // Fluctuate between 55% and 70%
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

	state.activeParticleRatio = activeCount / list.length;
}