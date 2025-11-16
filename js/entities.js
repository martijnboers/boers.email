"use strict";

import { CONFIG } from './config.js';

export function updateOutbreaks(state) {
    const {
        isMobile, activeParticleRatio, centerX, centerY, w, h, screenSizeMultiplier,
        cursorX, cursorY, disruptionTarget, disruptionSecondaryTarget, disruptionIntensity,
        disruptionCenterX, disruptionCenterY, anomalies, cursorBuffs, radiusMultiplier
    } = state;

	const now = Date.now();
	const elapsed = now - state.startTime;

	// Spawn with increasing frequency but with variation
	const spawnThreshold = isMobile ? 0.15 : 0.1;

	if (now >= state.nextOutbreakTime && activeParticleRatio > spawnThreshold) {
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

			state.outbreaks.push({
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

		state.nextOutbreakTime = now + spawnInterval;
	}

	// Update outbreaks
	state.outbreaks = state.outbreaks.filter((o) => {
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
				for (let i = 0; i < state.outbreaks.length; i++) {
					const other = state.outbreaks[i];
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
				baseDamage = state.isManual ? 3.5 : 1.2;
			} else if (penetration > 0.4) {
				// Mid area
				baseDamage = state.isManual ? 1.8 : 0.8;
			} else {
				// Edge area
				baseDamage = state.isManual ? 0.8 : 0.4;
			}

            baseDamage *= radiusMultiplier;

			// Scale damage down with more particles - cursor is much stronger with more particles
			// At 0% particles: 100% damage, at 100% particles: 40% damage
			const particleDamageMultiplier = 1.0 - activeParticleRatio * 0.6;
			baseDamage *= particleDamageMultiplier;

			// Black hole kill boost - massive damage increase!
			let stationBonus = 1.0;
			if (cursorBuffs.blackHoleKillBoostActive) {
				stationBonus *= 2.5; // 2.5x damage multiplier
			}

			// Disruption mode: damage boost when hunting targets
			let disruptionBonus = 1.0;
			if (disruptionIntensity > 0.3) {
				// Base disruption damage scales with how desperate the situation is
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const desperation = Math.max(1.0, 1.0 + blackHoleDominance * 3.0); // 1x to 4x based on dominance

				disruptionBonus = desperation * (1.0 + disruptionIntensity * 2.0); // Up to 12x when desperate

				// Extra bonus if this is the actual target
				if (disruptionTarget === o) {
					disruptionBonus *= 1.5; // Up to 18x damage to primary target when desperate
				} else if (disruptionSecondaryTarget === o) {
					disruptionBonus *= 1.3; // Up to 15.6x damage to secondary target
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
			if (o.frame >= 360) {
				const now = Date.now();
				cursorBuffs.blackHoleKillBoostActive = true;
				cursorBuffs.blackHoleKillBoostEndTime = now + 8000; // 8 seconds
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
		for (let j = 0; j < state.outbreaks.length; j++) {
			if (state.outbreaks[j] === o) continue;
			const other = state.outbreaks[j];

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
		const elapsed = Date.now() - state.startTime;
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

export function updateAnomalies(state) {
    const {
        isMobile, activeParticleRatio, centerX, centerY, w, h, outbreaks,
        cursorX, cursorY, disruptionTarget, disruptionIntensity, disruptionCenterX,
        disruptionCenterY, cursorBuffs, radiusMultiplier
    } = state;

	const now = Date.now();

	// Spawn anomalies
	if (now >= state.nextAnomalyTime && activeParticleRatio > 0.2) {
		const angle = Math.random() * Math.PI * 2;
		const distance = (0.2 + Math.random() * 0.3) * Math.min(w, h);

		state.anomalies.push({
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
		state.nextAnomalyTime = now + spawnInterval;
	}

	// Update anomalies
	state.anomalies = state.anomalies.filter((a) => {
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

        if (a.vortexBoostEndTime && now < a.vortexBoostEndTime) {
            a.vortexStrength *= 1.5;
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
			let damage = state.isManual ? 2.0 : 1.0;

            damage *= radiusMultiplier;

			// Scale damage down with more particles - cursor is much stronger with more particles
			const particleDamageMultiplier = 1.0 - activeParticleRatio * 0.6;
			damage *= particleDamageMultiplier;

			// Black hole kill boost - massive damage increase!
			let stationBonus = 1.0;
			if (cursorBuffs.blackHoleKillBoostActive) {
				stationBonus *= 2.5; // 2.5x damage multiplier
			}

			// Disruption mode damage boost
			let disruptionBonus = 1.0;
			if (disruptionIntensity > 0.3) {
				// Base disruption damage scales with how desperate the situation is
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const desperation = Math.max(1.0, 1.0 + blackHoleDominance * 3.0); // 1x to 4x based on dominance

				disruptionBonus = desperation * (1.0 + disruptionIntensity * 2.0); // Up to 12x when desperate
				if (disruptionTarget === a) {
					disruptionBonus *= 1.5; // Up to 18x damage to marked anomaly when desperate
				}
			}

			a.health -= damage * disruptionBonus * stationBonus;
		}

		                                return a.health > 0 && a.frame < 18000; // Live for max 5 minutes

		                        	});

		                        }

		                        

		                        export function updateGlyphs(state) {

		                        

		                            const { w, h, outbreaks, anomalies, activeParticleRatio } = state;

		                        

		                            const now = Date.now();

		                        

		                        

		                        

		                                // Spawn new glyph

		                        

		                        

		                        

		                                if (state.glyphs.length === 0 && now >= state.nextGlyphSpawnTime && activeParticleRatio > 0.2) {

		                        

		                        

		                        

		                                    let spawnX, spawnY;

		                        

		                        

		                        

		                                    let isSafe = false;

		                        

		                        

		                        

		                                    const maxAttempts = 10;

		                        

		                        

		                        

		                                    let attempts = 0;

		                        

		                        

		                        

		                            

		                        

		                        

		                        

		                                    while (!isSafe && attempts < maxAttempts) {

		                        

		                        

		                        

		                                        attempts++;

		                        

		                        

		                        

		                                        isSafe = true;

		                        

		                        

		                        

		                                        spawnX = w * 0.2 + Math.random() * w * 0.6;

		                        

		                        

		                        

		                                        spawnY = h * 0.2 + Math.random() * h * 0.6;

		                        

		                        

		                        

		                            

		                        

		                        

		                        

		                                        for (const o of outbreaks) {

		                        

		                        

		                        

		                                            const dx = o.x - spawnX;

		                        

		                        

		                        

		                                            const dy = o.y - spawnY;

		                        

		                        

		                        

		                                            const distSq = dx * dx + dy * dy;

		                        

		                        

		                        

		                                            const safeDist = o.radius + CONFIG.GLYPH_CAPTURE_RADIUS + 50; // 50px buffer

		                        

		                        

		                        

		                            

		                        

		                        

		                        

		                                            if (distSq < safeDist * safeDist) {

		                        

		                        

		                        

		                                                isSafe = false;

		                        

		                        

		                        

		                                                break; // Unsafe, try new coordinates

		                        

		                        

		                        

		                                            }

		                        

		                        

		                        

		                                        }

		                        

		                        

		                        

		                                    }

		                        

		                        

		                        

		                            

		                        

		                        

		                        

		                                    if (isSafe) {

		                        

		                        

		                        

		                                        state.glyphs.push({

		                        

		                        

		                        

		                                            x: spawnX,

		                        

		                        

		                        

		                                            y: spawnY,

		                        

		                        

		                        

		                                            spawnTime: now,

		                        

		                        

		                        

		                                            isCapturing: false,

		                        

		                        

		                        

		                                            captureTarget: null,

		                        

		                        

		                        

		                                            captureTime: 0,

		                        

		                        

		                        

		                                        });

		                        

		                        

		                        

		                                    } else {

		                        

		                        

		                        

		                                        // If no safe spot found after max attempts, just delay the next spawn

		                        

		                        

		                        

		                                        state.nextGlyphSpawnTime = now + 5000; // Try again in 5 seconds

		                        

		                        

		                        

		                                    }

		                        

		                        

		                        

		                                }

		                        

		                        

		                        

		                            state.glyphs = state.glyphs.filter(glyph => {

		                        

		                                const age = now - glyph.spawnTime;

		                        

		                                if (age > CONFIG.GLYPH_LIFETIME && !glyph.isCapturing) {

		                        

		                                    state.nextGlyphSpawnTime = now + CONFIG.GLYPH_SPAWN_MIN + Math.random() * (CONFIG.GLYPH_SPAWN_MAX - CONFIG.GLYPH_SPAWN_MIN);

		                        

		                                    return false; // Despawn if too old

		                        

		                                }

		                        

		                        

		                        

		                                if (glyph.isCapturing) {

		                        

		                                    glyph.captureTime -= 16.67;

		                        

		                                    if (glyph.captureTime <= 0) {

		                        

		                                        if (glyph.captureTarget) {

		                        

		                                            if (outbreaks.includes(glyph.captureTarget)) {

		                        

		                                                glyph.captureTarget.regenBoostEndTime = Date.now() + 15000;

		                        

		                                            } else if (anomalies.includes(glyph.captureTarget)) {

		                        

		                                                glyph.captureTarget.vortexBoostEndTime = Date.now() + 12000;

		                        

		                                            }

		                        

		                                        }

		                        

		                                        state.nextGlyphSpawnTime = now + CONFIG.GLYPH_SPAWN_MIN + Math.random() * (CONFIG.GLYPH_SPAWN_MAX - CONFIG.GLYPH_SPAWN_MIN);

		                        

		                                        return false;

		                        

		                                    }

		                        

		                                    return true;

		                        

		                                }

		                        

		                        

		                        

		                                // Check for capture by viruses

		                        

		                                for (const v of outbreaks) {

		                        

		                                    const dx = v.x - glyph.x;

		                        

		                                    const dy = v.y - glyph.y;

		                        

		                                    if (dx * dx + dy * dy < (CONFIG.GLYPH_CAPTURE_RADIUS + v.radius) ** 2) {

		                        

		                                        glyph.isCapturing = true;

		                        

		                                        glyph.captureTarget = v;

		                        

		                                        glyph.captureTime = 1000;

		                        

		                                        return true;

		                        

		                                    }

		                        

		                                }

		                        

		                        

		                        

		                                // Check for capture by anomalies

		                        

		                                for (const a of anomalies) {

		                        

		                                    const dx = a.x - glyph.x;

		                        

		                                    const dy = a.y - glyph.y;

		                        

		                                    if (dx * dx + dy * dy < CONFIG.GLYPH_CAPTURE_RADIUS ** 2) {

		                        

		                                        glyph.isCapturing = true;

		                        

		                                        glyph.captureTarget = a;

		                        

		                                        glyph.captureTime = 1000;

		                        

		                                        return true;

		                        

		                                    }

		                        

		                                }

		                        

		                        

		                        

		                                return true;

		                        

		                            });

		                        

		                        }

		        

		
