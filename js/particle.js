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
            cursorX, cursorY, radiusMultiplier, spiralStrength, outbreaks,
            anomalies, cursorVx, cursorVy, isManual, cursorBuffs, isMobile,
            activeParticleRatio, stations
        } = state;

		if (!this.active) return;

		const dx = cursorX - this.x;
		const dy = cursorY - this.y;
		const distSq = dx * dx + dy * dy;
		const dist = Math.sqrt(distSq);

		let buffRadiusMultiplier = 1.0;
		let buffForceMultiplier = 1.0;
		let hasPulsatingBuff = false;
		let pulseStrength = 0;
		const now = Date.now();
		const manualReduction = isManual ? 0.3 : 1.0;

		if (cursorBuffs.shieldActive) {
			hasPulsatingBuff = true;
			const pulse = Math.sin(now * 0.008) * 0.5 + 0.5;
			pulseStrength = pulse * 12.0 * manualReduction;
			buffRadiusMultiplier = 1.0 + (0.8 * manualReduction);
		}

		if (cursorBuffs.damageBoostActive) {
			hasPulsatingBuff = true;
			const pulse = Math.sin(now * 0.014) * 0.5 + 0.5;
			pulseStrength = Math.max(pulseStrength, pulse * 15.0 * manualReduction);
			buffRadiusMultiplier = Math.max(buffRadiusMultiplier, 1.0 + (1.0 * manualReduction));
		}

		if (cursorBuffs.blackHoleKillBoostActive) {
			hasPulsatingBuff = true;
			const pulse = Math.sin(now * 0.018) * 0.5 + 0.5;
			pulseStrength = pulse * 25.0 * manualReduction;
			buffRadiusMultiplier = 1.0 + (1.5 * manualReduction);
		}

		const dynamicRadiusSq = CONFIG.REPULSION_RADIUS ** 2 * radiusMultiplier ** 2 * buffRadiusMultiplier ** 2;

		const awarenessRadiusSq = (this.awareness + Math.sqrt(dynamicRadiusSq)) ** 2;
		if (distSq < awarenessRadiusSq && distSq > dynamicRadiusSq) {
			const cursorSpeed = Math.sqrt(cursorVx * cursorVx + cursorVy * cursorVy);
			if (cursorSpeed > 1.5) {
				const cursorDirX = cursorVx / cursorSpeed;
				const cursorDirY = cursorVy / cursorSpeed;
				const toParticleX = -dx / dist;
				const toParticleY = -dy / dist;
				const alignmentDot = cursorDirX * toParticleX + cursorDirY * toParticleY;

				if (alignmentDot > 0.4) {
					const anticipationForce = alignmentDot * 0.2 * this.nervousness * buffForceMultiplier;
					this.vx -= anticipationForce * cursorDirX;
					this.vy -= anticipationForce * cursorDirY;
				}
			}
		}

		if (distSq < dynamicRadiusSq) {
			const safeDist = Math.max(distSq, 1);
			const baseForce = (-dynamicRadiusSq / safeDist) * CONFIG.REPULSION_STRENGTH * buffForceMultiplier;
			const force = baseForce * this.nervousness;
			const angle = Math.atan2(dy, dx);

			this.vx += force * Math.cos(angle);
			this.vy += force * Math.sin(angle);

			const tangentialAngle = angle + Math.PI / 2;
			const spiralForce = (force * spiralStrength * dist) / Math.sqrt(dynamicRadiusSq);
			this.vx += spiralForce * Math.cos(tangentialAngle);
			this.vy += spiralForce * Math.sin(tangentialAngle);
		}

		if (hasPulsatingBuff) {
			const particleSpacing = isMobile ? CONFIG.SPACING_MOBILE : CONFIG.SPACING_DESKTOP;
			const waveDistance = particleSpacing * 4;
			const waveRadius = Math.sqrt(dynamicRadiusSq) + waveDistance;
			const waveThickness = particleSpacing * 6;
			const distFromWaveCenter = Math.abs(dist - waveRadius);

			if (distFromWaveCenter < waveThickness) {
				const angle = Math.atan2(dy, dx);
				const normalizedPulse = (pulseStrength) * 2 - 1;
				const proximityFactor = 1.0 - (distFromWaveCenter / waveThickness);
				const waveForce = normalizedPulse * proximityFactor * 8.0;
				this.vx += waveForce * Math.cos(angle);
				this.vy += waveForce * Math.sin(angle);
			}
		}

		for (const o of outbreaks) {
			const odx = this.x - o.x;
			const ody = this.y - o.y;
			const oDistSq = odx * odx + ody * ody;
			const morphPulse = Math.sin(o.frame * 0.05) * 0.05 + Math.sin(o.frame * 0.02 + this.angle * 2) * 0.04 + 1.0;
			const angleToParticle = Math.atan2(ody, odx);
			const tentacleVariation = Math.sin(angleToParticle * 3 + o.frame * 0.03) * 0.08 + Math.cos(angleToParticle * 5 - o.frame * 0.04) * 0.06;
			const organicRadius = o.radius * morphPulse * (1.0 + tentacleVariation);
			const currentRadiusSq = organicRadius ** 2;

			if (o.frame < 360) {
				const edgeThickness = 18;
				const innerRadiusSq = Math.max(0, organicRadius - edgeThickness) ** 2;
				if (oDistSq < currentRadiusSq && oDistSq > innerRadiusSq) {
					const oDist = Math.sqrt(oDistSq);
					const edgePos = (oDist - (organicRadius - edgeThickness)) / edgeThickness;
					const force = (1.0 - edgePos) * 2.0;
					const angle = Math.atan2(ody, odx);
					this.vx += force * Math.cos(angle);
					this.vy += force * Math.sin(angle);
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
					const angle = Math.atan2(ody, odx);
					this.vx -= blackHoleForce * Math.cos(angle);
					this.vy -= blackHoleForce * Math.sin(angle);
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
		
						for (const v of outbreaks) {
							if (Math.sqrt((v.x - a.x) ** 2 + (v.y - a.y) ** 2) < CONFIG.SYNERGY_RANGE) {
								vortexStrength *= v.maxed ? CONFIG.SYNERGY_VORTEX_BOOST * 1.4 : CONFIG.SYNERGY_VORTEX_BOOST;
								break;
							}
						}
		
						const angleToAnomaly = Math.atan2(ady, adx);
						this.vx -= (vortexStrength * 0.3) * Math.cos(angleToAnomaly);
						this.vy -= (vortexStrength * 0.3) * Math.sin(angleToAnomaly);
		
						const tangentialAngle = angleToAnomaly + Math.PI / 2;
						this.vx += (vortexStrength * 1.2) * Math.cos(tangentialAngle);
						this.vy += (vortexStrength * 1.2) * Math.sin(tangentialAngle);
					}
				}
		this.vx *= CONFIG.PARTICLE_DRAG;
		this.vy *= CONFIG.PARTICLE_DRAG;
		this.x += this.vx + (this.ox - this.x) * CONFIG.PARTICLE_EASE;
		this.y += this.vy + (this.oy - this.y) * CONFIG.PARTICLE_EASE;
	}
}
