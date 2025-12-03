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
		this.growthOffset = Math.random() * 0.15;

		// Organic behavior traits
		this.nervousness = 0.8 + Math.random() * 0.4;
		this.awareness = Math.random() * 40 + 25;
	}

	update(state) {
        const {
            renderCursorX, renderCursorY, radiusMultiplier, spiralStrength, outbreaks,
            anomalies, isMobile, activeParticleRatio, stations,
            buffRadiusMultiplier, buffForceMultiplier, hasPulsatingBuff, pulseStrength,
            cursorSpeed, cursorDirX, cursorDirY, now
        } = state;

		if (!this.active) return;

		const dx = renderCursorX - this.x;
		const dy = renderCursorY - this.y;
		const distSq = dx * dx + dy * dy;

		const dynamicRadiusSq = CONFIG.REPULSION_RADIUS ** 2 * radiusMultiplier ** 2 * buffRadiusMultiplier ** 2;

		// Early exit: if particle is far from cursor and all entities, skip expensive calculations
		const maxInteractionRange = 200;
		const maxInteractionRangeSq = maxInteractionRange * maxInteractionRange;

		let nearSomething = distSq < dynamicRadiusSq * 4;

		if (!nearSomething && outbreaks.length > 0) {
			for (const o of outbreaks) {
				const odx = this.x - o.x;
				const ody = this.y - o.y;
				if (odx * odx + ody * ody < maxInteractionRangeSq) {
					nearSomething = true;
					break;
				}
			}
		}

		if (!nearSomething && anomalies.length > 0) {
			for (const a of anomalies) {
				const adx = this.x - a.x;
				const ady = this.y - a.y;
				if (adx * adx + ady * ady < maxInteractionRangeSq) {
					nearSomething = true;
					break;
				}
			}
		}

		if (!nearSomething) {
			// Far from everything: just apply drag and spring back
			this.vx *= CONFIG.PARTICLE_DRAG;
			this.vy *= CONFIG.PARTICLE_DRAG;
			this.x += this.vx + (this.ox - this.x) * CONFIG.PARTICLE_EASE;
			this.y += this.vy + (this.oy - this.y) * CONFIG.PARTICLE_EASE;
			return;
		}

		// Anticipation: only calculate if cursor is moving fast enough
		if (cursorSpeed > 1.5) {
			const dynamicRadius = Math.sqrt(dynamicRadiusSq);
			const awarenessRadiusSq = (this.awareness + dynamicRadius) ** 2;

			if (distSq < awarenessRadiusSq && distSq > dynamicRadiusSq) {
				const distSqrt = Math.sqrt(distSq);
				const toParticleX = -dx / distSqrt;
				const toParticleY = -dy / distSqrt;
				const alignmentDot = cursorDirX * toParticleX + cursorDirY * toParticleY;

				if (alignmentDot > 0.4) {
					const anticipationForce = alignmentDot * 0.2 * this.nervousness * buffForceMultiplier;
					this.vx -= anticipationForce * cursorDirX;
					this.vy -= anticipationForce * cursorDirY;
				}
			}
		}

		// Main repulsion
		if (distSq < dynamicRadiusSq) {
			const safeDist = Math.max(distSq, 1);
			const baseForce = (-dynamicRadiusSq / safeDist) * CONFIG.REPULSION_STRENGTH * buffForceMultiplier;
			const force = baseForce * this.nervousness;

			// Use normalized vector instead of angle + trig
			const distSqrt = Math.sqrt(distSq);
			const normX = dx / distSqrt;
			const normY = dy / distSqrt;

			this.vx += force * normX;
			this.vy += force * normY;

			// Spiral: perpendicular to normalized direction
			const dynamicRadius = Math.sqrt(dynamicRadiusSq);
			const spiralForce = (force * spiralStrength * distSqrt) / dynamicRadius;
			this.vx -= spiralForce * normY; // Perpendicular
			this.vy += spiralForce * normX;
		}

		if (hasPulsatingBuff) {
			const particleSpacing = isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP;
			const waveDistance = particleSpacing * 4;
			const waveRadius = Math.sqrt(dynamicRadiusSq) + waveDistance;
			const waveRadiusSq = waveRadius * waveRadius;
			const waveThickness = particleSpacing * 6;

			// Use squared distance for initial check
			const distFromWaveSq = Math.abs(distSq - waveRadiusSq);
			const waveThicknessSq = waveThickness * waveThickness;

			if (distFromWaveSq < waveThicknessSq) {
				const distSqrt = Math.sqrt(distSq);
				const normX = dx / distSqrt;
				const normY = dy / distSqrt;
				const normalizedPulse = (pulseStrength) * 2 - 1;
				const proximityFactor = 1.0 - (Math.sqrt(distFromWaveSq) / waveThickness);
				const waveForce = normalizedPulse * proximityFactor * 8.0;
				this.vx += waveForce * normX;
				this.vy += waveForce * normY;
			}
		}

		for (const o of outbreaks) {
			const odx = this.x - o.x;
			const ody = this.y - o.y;
			const oDistSq = odx * odx + ody * ody;

			// Simplified organic variation (removed one trig call)
			const morphPulse = Math.sin(o.frame * 0.05) * 0.05 + 1.0;
			const angleApprox = Math.atan2(ody, odx); // Only one atan2
			const tentacleVariation = Math.sin(angleApprox * 3 + o.frame * 0.03) * 0.08;
			const organicRadius = o.radius * morphPulse * (1.0 + tentacleVariation);
			const currentRadiusSq = organicRadius ** 2;

			if (o.frame < 360) {
				const edgeThickness = 18;
				const innerRadiusSq = Math.max(0, organicRadius - edgeThickness) ** 2;
				if (oDistSq < currentRadiusSq && oDistSq > innerRadiusSq) {
					const oDist = Math.sqrt(oDistSq);
					const edgePos = (oDist - (organicRadius - edgeThickness)) / edgeThickness;
					const force = (1.0 - edgePos) * 2.0;
					// Use normalized vector
					const normX = odx / oDist;
					const normY = ody / oDist;
					this.vx += force * normX;
					this.vy += force * normY;
				}
			} else {
				const pullAge = o.frame - 360;
				const initialProgress = Math.min(pullAge / 1800, 1.0);
				const continuousGrowth = Math.min(pullAge / 5400, 1.2);
				const baseMultiplier = CONFIG.OUTBREAK_PULL_RADIUS_MIN + (CONFIG.OUTBREAK_PULL_RADIUS_MAX - CONFIG.OUTBREAK_PULL_RADIUS_MIN) * initialProgress;
				const pullRadiusMultiplier = baseMultiplier + continuousGrowth * 1.67;
				const pullRadius = organicRadius * pullRadiusMultiplier;
				const pullRadiusSq = pullRadius ** 2;

				if (oDistSq < pullRadiusSq) {
					const oDist = Math.sqrt(oDistSq);
					let pullStrength = Math.min(pullAge / 1200, 1.0) * 1.2;
					pullStrength *= 1.0 + continuousGrowth * 0.3;
					pullStrength *= 1.0 + (1.0 - activeParticleRatio) * 0.8;
					const distanceFactor = 1.0 - Math.min(oDist / pullRadius, 1.0);
					const blackHoleForce = pullStrength * (1.0 + distanceFactor * 1.4);
					// Use normalized vector
					const normX = odx / oDist;
					const normY = ody / oDist;
					this.vx -= blackHoleForce * normX;
					this.vy -= blackHoleForce * normY;
				}
			}
		}

        // "Asteroid" Station Logic
		for (const s of stations) {
            if (s.isCapturing && s.captureTarget) {
                const tdx = s.captureTarget.x - this.x;
                const tdy = s.captureTarget.y - this.y;
                if (tdx * tdx + tdy * tdy < 150 * 150) {
                    this.vx += tdx * 0.03;
                    this.vy += tdy * 0.03;
                }
            } else {
                const dx = this.x - s.x;
                const dy = this.y - s.y;
                const stationDistSq = dx * dx + dy * dy;
                const radius = 25 + Math.sin(this.angle * 5) * 5; // Irregular shape
                const radiusSq = radius * radius;

                if (stationDistSq < radiusSq) {
                    this.vx += (s.x - this.x) * 0.1;
                    this.vy += (s.y - this.y) * 0.1;
                }
            }
        }

		        for (const a of anomalies) {
					const adx = this.x - a.x;
					const ady = this.y - a.y;
					const aDistSq = adx * adx + ady * ady;
					const vortexRadius = a.vortexRadius || CONFIG.ANOMALY_VORTEX_RADIUS;
					const vortexRadiusSq = vortexRadius * vortexRadius;

					if (aDistSq < vortexRadiusSq) {
						const aDist = Math.sqrt(aDistSq);
						const falloff = 1.0 - aDist / vortexRadius;
						let vortexStrength = (a.vortexStrength || CONFIG.ANOMALY_VORTEX_STRENGTH) * falloff;

						if (a.vortexBoostEndTime && now < a.vortexBoostEndTime) {
							vortexStrength *= 1.5;
						}

						// Optimize synergy check: use squared distance to avoid sqrt
						const synergyRangeSq = CONFIG.SYNERGY_RANGE * CONFIG.SYNERGY_RANGE;
						for (const v of outbreaks) {
							const vdx = v.x - a.x;
							const vdy = v.y - a.y;
							if (vdx * vdx + vdy * vdy < synergyRangeSq) {
								vortexStrength *= v.maxed ? CONFIG.SYNERGY_VORTEX_BOOST * 1.4 : CONFIG.SYNERGY_VORTEX_BOOST;
								break;
							}
						}

						// Use normalized vector instead of angle + trig
						const normX = adx / aDist;
						const normY = ady / aDist;
						this.vx -= (vortexStrength * 0.3) * normX;
						this.vy -= (vortexStrength * 0.3) * normY;

						// Perpendicular (tangential) force
						this.vx -= (vortexStrength * 1.2) * normY; // Perpendicular
						this.vy += (vortexStrength * 1.2) * normX;
					}
				}
		this.vx *= CONFIG.PARTICLE_DRAG;
		this.vy *= CONFIG.PARTICLE_DRAG;
		this.x += this.vx + (this.ox - this.x) * CONFIG.PARTICLE_EASE;
		this.y += this.vy + (this.oy - this.y) * CONFIG.PARTICLE_EASE;
	}
}
