"use strict";

import { CONFIG } from './config.js';

export function updateOutbreaks(state) {
    const {
        isMobile, activeParticleRatio, centerX, centerY, w, h, screenSizeMultiplier,
        cursorX, cursorY, disruptionTarget, disruptionSecondaryTarget, disruptionIntensity,
        disruptionCenterX, disruptionCenterY, anomalies, cursorBuffs, isManual
    } = state;

	const now = Date.now();
	const elapsed = now - state.startTime;

	const spawnThreshold = isMobile ? 0.15 : 0.1;

	if (now >= state.nextOutbreakTime && activeParticleRatio > spawnThreshold) {
		const losingWave = Math.sin(elapsed * 0.00015) * 0.5 + 0.5;
		const isLosingPeriod = losingWave < 0.3;
		const shouldSpawn = !isLosingPeriod || Math.random() < 0.25;

		if (shouldSpawn) {
			const angle = Math.random() * Math.PI * 2;
			let distance;
			if (Math.random() < 0.3) distance = (0.08 + Math.random() * 0.15) * Math.min(w, h);
			else if (Math.random() < 0.5) distance = (0.2 + Math.random() * 0.2) * Math.min(w, h);
			else distance = (0.35 + Math.random() * 0.2) * Math.min(w, h);

			const timeProgress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);
			const sizeBoost = timeProgress * 4;
			const initialRadius = isMobile ? 5 + Math.random() * 3 + sizeBoost : 6 + Math.random() * 4 + sizeBoost;
			const healthBoost = timeProgress * 200;
			const baseHealth = 200 + healthBoost;
			const initialHealth = baseHealth * screenSizeMultiplier;

			state.outbreaks.push({
				x: centerX + Math.cos(angle) * distance,
				y: centerY + Math.sin(angle) * distance,
				vx: 0, vy: 0, radius: initialRadius, frame: 0,
				health: initialHealth, maxHealth: initialHealth,
				threatened: false, everTouched: false,
			});
		}

		const spawnMin = isMobile ? CONFIG.OUTBREAK_SPAWN_MIN_MOBILE : CONFIG.OUTBREAK_SPAWN_MIN;
		const spawnMax = isMobile ? CONFIG.OUTBREAK_SPAWN_MAX_MOBILE : CONFIG.OUTBREAK_SPAWN_MAX;
		const baseInterval = spawnMin - activeParticleRatio * (spawnMin - spawnMax);
		const variationFactor = 0.5 + Math.random() * 1.0;
		state.nextOutbreakTime = now + (baseInterval * variationFactor);
	}

	state.outbreaks = state.outbreaks.filter((o) => {
		o.frame++;
		const distToCursor = Math.sqrt((cursorX - o.x) ** 2 + (cursorY - o.y) ** 2);
		if (distToCursor < CONFIG.OUTBREAK_DISSOLVE_RADIUS) return false;

		let hasAnomalySupport = false;
		let hasMaxedVirusSupport = false;
		const isVulnerable = (disruptionTarget === o || disruptionSecondaryTarget === o) && disruptionIntensity > 0.3;

		if (!isVulnerable) {
			for (const a of anomalies) {
				if (Math.sqrt((a.x - o.x) ** 2 + (a.y - o.y) ** 2) < CONFIG.SYNERGY_RANGE) {
					hasAnomalySupport = true;
					break;
				}
			}
			if (!hasAnomalySupport) {
				for (const other of state.outbreaks) {
					if (other !== o && other.maxed && Math.sqrt((other.x - o.x) ** 2 + (other.y - o.y) ** 2) < CONFIG.SYNERGY_RANGE * 0.8) {
						hasMaxedVirusSupport = true;
						break;
					}
				}
			}
		}

		let damageReduction = 1.0;
		if (hasAnomalySupport) damageReduction = CONFIG.SYNERGY_PROTECTION;
		else if (hasMaxedVirusSupport) damageReduction = 0.7;

		if (distToCursor < o.radius) {
			o.everTouched = true;
			const penetration = 1.0 - distToCursor / o.radius;
			let baseDamage;
			if (penetration > 0.7) baseDamage = isManual ? 3.5 : 1.2;
			else if (penetration > 0.4) baseDamage = isManual ? 1.8 : 0.8;
			else baseDamage = isManual ? 0.8 : 0.4;

			baseDamage *= (1.0 - activeParticleRatio * 0.6);
			let stationBonus = cursorBuffs.damageBoostActive ? 1.25 : 1.0;
			if (cursorBuffs.blackHoleKillBoostActive) stationBonus *= 2.5;

			let disruptionBonus = 1.0;
			if (disruptionIntensity > 0.3) {
				const blackHoleDominance = 1.0 - activeParticleRatio;
				const desperation = Math.max(1.0, 1.0 + blackHoleDominance * 3.0);
				disruptionBonus = desperation * (1.0 + disruptionIntensity * 2.0);
				if (disruptionTarget === o) disruptionBonus *= 1.5;
				else if (disruptionSecondaryTarget === o) disruptionBonus *= 1.3;

				if (disruptionSecondaryTarget && (disruptionTarget === o || disruptionSecondaryTarget === o)) {
					const otherTarget = disruptionTarget === o ? disruptionSecondaryTarget : disruptionTarget;
					const collisionDist = Math.sqrt((otherTarget.x - o.x) ** 2 + (otherTarget.y - o.y) ** 2);
					if (collisionDist < 150) {
						disruptionBonus *= 1.0 + ((150 - collisionDist) / 150) * 0.5;
					}
				}
			}
			o.health -= baseDamage * damageReduction * disruptionBonus * stationBonus;
		}

		if (o.health <= 0) {
			if (o.frame >= 360) {
				cursorBuffs.blackHoleKillBoostActive = true;
				cursorBuffs.blackHoleKillBoostEndTime = now + 8000;
			}
			return false;
		}

		o.threatened = distToCursor < o.radius * 1.5;

		if (!isVulnerable) {
			let regenRate = 0.5;
			if (hasAnomalySupport) regenRate = 0.5 * CONFIG.SYNERGY_REGEN_BOOST;
			else if (hasMaxedVirusSupport) regenRate = 0.5 * 2.0;
			if (o.regenBoostEndTime && now < o.regenBoostEndTime) regenRate *= 2.5;
			if (!o.threatened && o.health < o.maxHealth && o.frame % 5 === 0) {
				o.health = Math.min(o.maxHealth, o.health + regenRate);
			}
		}

		let disruptX = 0, disruptY = 0;
		if (disruptionTarget === o && disruptionIntensity > 0.3) {
			const tdx = cursorX - o.x, tdy = cursorY - o.y, tDist = Math.sqrt(tdx*tdx+tdy*tdy);
			if (tDist > 50) {
				const pullPower = Math.max(1.0, 1.0 + (1.0 - activeParticleRatio) * 2.0);
				const pullStrength = disruptionIntensity * 4.0 * pullPower;
				disruptX += (tdx / tDist) * pullStrength;
				disruptY += (tdy / tDist) * pullStrength;
			}
			if (o.frame % 10 === 0) o.health -= disruptionIntensity * 1.0 * Math.max(1.0, 1.0 + (1.0 - activeParticleRatio) * 3.0);
		} else if (disruptionSecondaryTarget === o && disruptionIntensity > 0.3) {
			const tdx = disruptionTarget.x - o.x, tdy = disruptionTarget.y - o.y, tDist = Math.sqrt(tdx*tdx+tdy*tdy);
			if (tDist > 60) {
				const pullPower = Math.max(1.0, 1.0 + (1.0 - activeParticleRatio) * 2.0);
				const pullStrength = disruptionIntensity * 5.0 * pullPower;
				disruptX += (tdx / tDist) * pullStrength;
				disruptY += (tdy / tDist) * pullStrength;
			}
			if (o.frame % 10 === 0) o.health -= disruptionIntensity * 0.8 * Math.max(1.0, 1.0 + (1.0 - activeParticleRatio) * 3.0);
			if (tDist < 100 && o.frame % 8 === 0) {
				const impactForce = (100 - tDist) / 100;
				const collisionDamage = impactForce * disruptionIntensity * 1.5 * Math.max(1.0, 1.0 + (1.0 - activeParticleRatio) * 3.0);
				o.health -= collisionDamage;
				if (disruptionTarget) disruptionTarget.health -= collisionDamage * 0.6;
			}
		} else if (disruptionIntensity > 0) {
			const ddx = o.x - disruptionCenterX, ddy = o.y - disruptionCenterY, dDist = Math.sqrt(ddx*ddx+ddy*ddy);
			const waveRadius = disruptionIntensity * 400;
			if (dDist < waveRadius && dDist > 10) {
				const pushStrength = (1.0 - Math.min(Math.abs(dDist - waveRadius * 0.7) / (waveRadius * 0.3), 1.0)) * 8.0 * disruptionIntensity;
				disruptX = (ddx / dDist) * pushStrength;
				disruptY = (ddy / dDist) * pushStrength;
			}
		}

		let attractX = 0, attractY = 0;
		const attractionMultiplier = 1.0 - disruptionIntensity * 0.7;
		for (const other of state.outbreaks) {
			if (other === o) continue;
			const odx = other.x - o.x, ody = other.y - o.y, oDist = Math.sqrt(odx*odx+ody*ody);
			if (oDist < 400 && oDist > 50) {
				const attractionStrength = ((o.radius + other.radius) / 280) * 0.15 * attractionMultiplier;
				const falloff = 1.0 - Math.min(oDist / 400, 1.0);
				attractX += (odx / oDist) * attractionStrength * falloff;
				attractY += (ody / oDist) * attractionStrength * falloff;
			}
		}

		o.vx = (o.vx + attractX + disruptX) * 0.85;
		o.vy = (o.vy + attractY + disruptY) * 0.85;
		o.x += o.vx;
		o.y += o.vy;

		const timeProgress = Math.min(elapsed / CONFIG.GROWTH_DURATION, 1);
		const growthSpeedBoost = 1.0 + timeProgress * 0.4;
		const maxRadius = isMobile ? CONFIG.OUTBREAK_MAX_RADIUS_MOBILE : CONFIG.OUTBREAK_MAX_RADIUS;
		const baseGrowthRate = isMobile ? CONFIG.OUTBREAK_GROWTH_RATE_MOBILE : CONFIG.OUTBREAK_GROWTH_RATE;
		const sizeSlowdown = o.everTouched ? Math.max(0.25, 1.0 - o.radius / maxRadius) : 1.0;
		const healthFactor = (o.health / o.maxHealth) * 0.5 + 0.5;
		let synergyGrowthBoost = 1.0;
		if (hasAnomalySupport) synergyGrowthBoost = CONFIG.SYNERGY_GROWTH_BOOST;
		else if (hasMaxedVirusSupport) synergyGrowthBoost = 1.4;
		const growthRate = baseGrowthRate * (1.0 + Math.sin(o.frame * 0.03) * 0.06) * sizeSlowdown * healthFactor * growthSpeedBoost * synergyGrowthBoost;
		o.radius += growthRate;
		if (o.everTouched && o.radius > maxRadius) o.radius = maxRadius;
		if (o.health < 30 && o.frame % 3 === 0) o.radius = Math.max(10, o.radius - 0.2);
		if (o.radius >= maxRadius && !o.maxed) o.maxed = true;

		return true;
	});
}

export function updateAnomalies(state) {
    const { isMobile, activeParticleRatio, centerX, centerY, w, h, outbreaks, cursorX, cursorY, disruptionTarget, disruptionIntensity, disruptionCenterX, disruptionCenterY, cursorBuffs, isManual } = state;
	const now = Date.now();

	if (now >= state.nextAnomalyTime && activeParticleRatio > 0.2) {
		const angle = Math.random() * Math.PI * 2;
		const distance = (0.2 + Math.random() * 0.3) * Math.min(w, h);
		state.anomalies.push({
			x: centerX + Math.cos(angle) * distance, y: centerY + Math.sin(angle) * distance,
			orbitCenterX: centerX + Math.cos(angle) * distance, orbitCenterY: centerY + Math.sin(angle) * distance,
			orbitAngle: Math.random() * Math.PI * 2, orbitRadius: CONFIG.ANOMALY_ORBIT_RADIUS,
			vortexRadius: CONFIG.ANOMALY_VORTEX_RADIUS, vortexStrength: CONFIG.ANOMALY_VORTEX_STRENGTH,
			isDrifting: false, driftTimer: 0, orbitTimer: 2000 + Math.random() * 3000,
			health: 60, maxHealth: 60, frame: 0, age: 0,
		});
		const spawnMin = isMobile ? CONFIG.ANOMALY_SPAWN_MIN_MOBILE : CONFIG.ANOMALY_SPAWN_MIN;
		const spawnMax = isMobile ? CONFIG.ANOMALY_SPAWN_MAX_MOBILE : CONFIG.ANOMALY_SPAWN_MAX;
		state.nextAnomalyTime = now + (spawnMin + Math.random() * (spawnMax - spawnMin));
	}

	state.anomalies = state.anomalies.filter((a) => {
		a.frame++; a.age += 16.67; a.orbitTimer -= 16.67; a.driftTimer -= 16.67;
		const growthProgress = Math.min((a.age / 1000) / 60, 1.5);
		a.vortexRadius = CONFIG.ANOMALY_VORTEX_RADIUS * (1.0 + growthProgress);
		a.vortexStrength = CONFIG.ANOMALY_VORTEX_STRENGTH * (1.0 + growthProgress * 0.8);
		a.orbitRadius = CONFIG.ANOMALY_ORBIT_RADIUS * (1.0 + growthProgress * 0.5);
		if (a.health === a.maxHealth) a.maxHealth = a.health = 60 + growthProgress * 40;

		if (!a.isDrifting && a.orbitTimer <= 0) {
			a.isDrifting = true;
			a.driftTimer = 1500 + Math.random() * 1500;
			let targetX, targetY;
			if (outbreaks.length > 0 && Math.random() < 0.7) {
				const targetVirus = outbreaks[Math.floor(Math.random() * outbreaks.length)];
				const offsetAngle = Math.random() * Math.PI * 2;
				const offsetDist = 150 + Math.random() * 100; // Increased offset
				targetX = targetVirus.x + Math.cos(offsetAngle) * offsetDist;
				targetY = targetVirus.y + Math.sin(offsetAngle) * offsetDist;
			} else {
				const angle = Math.random() * Math.PI * 2;
				const distance = (0.15 + Math.random() * 0.35) * Math.min(w, h);
				targetX = centerX + Math.cos(angle) * distance;
				targetY = centerY + Math.sin(angle) * distance;
			}
			a.driftTargetX = targetX; a.driftTargetY = targetY;
		}

		if (a.isDrifting && a.driftTimer <= 0) {
			a.isDrifting = false;
			a.orbitCenterX = a.x; a.orbitCenterY = a.y;
			a.orbitAngle = Math.random() * Math.PI * 2;
			a.orbitTimer = 2000 + Math.random() * 3000;
		}

		let nearVirus = false;
		for (const v of outbreaks) {
			if (Math.sqrt((v.x - a.x) ** 2 + (v.y - a.y) ** 2) < CONFIG.SYNERGY_RANGE) {
				nearVirus = true;
				break;
			}
		}

		let anomalyPullX = 0, anomalyPullY = 0;
		if (disruptionTarget === a && disruptionIntensity > 0.3) {
			const tdx = cursorX - a.x, tdy = cursorY - a.y, tDist = Math.sqrt(tdx*tdx+tdy*tdy);
			if (tDist > 40) {
				const pullPower = Math.max(1.0, 1.0 + (1.0 - activeParticleRatio) * 2.0);
				anomalyPullX = (tdx / tDist) * disruptionIntensity * 5.0 * pullPower;
				anomalyPullY = (tdy / tDist) * disruptionIntensity * 5.0 * pullPower;
			}
			if (a.frame % 10 === 0) a.health -= disruptionIntensity * 1.0 * Math.max(1.0, 1.0 + (1.0 - activeParticleRatio) * 3.0);
		}

		if (a.isDrifting) {
			const dx = a.driftTargetX - a.x + anomalyPullX;
			const dy = a.driftTargetY - a.y + anomalyPullY;
			a.x += dx * CONFIG.ANOMALY_DRIFT_SPEED * 0.01; // Slower drift
			a.y += dy * CONFIG.ANOMALY_DRIFT_SPEED * 0.01; // Slower drift
		} else {
			a.orbitAngle += nearVirus ? CONFIG.ANOMALY_ORBIT_SPEED * 0.5 : CONFIG.ANOMALY_ORBIT_SPEED;
			a.x = a.orbitCenterX + Math.cos(a.orbitAngle) * a.orbitRadius + anomalyPullX * 0.3;
			a.y = a.orbitCenterY + Math.sin(a.orbitAngle) * a.orbitRadius + anomalyPullY * 0.3;
		}

		if (a.vortexBoostEndTime && now < a.vortexBoostEndTime) {
            a.vortexStrength *= 1.5;
        }

		const distToCursor = Math.sqrt((cursorX - a.x) ** 2 + (cursorY - a.y) ** 2);
		if (distToCursor < CONFIG.ANOMALY_DISSOLVE_RADIUS) return false;

		if (distToCursor < 40) {
			let damage = isManual ? 2.0 : 1.0;
			damage *= (1.0 - activeParticleRatio * 0.6);
			let stationBonus = cursorBuffs.damageBoostActive ? 1.25 : 1.0;
			if (cursorBuffs.blackHoleKillBoostActive) stationBonus *= 2.5;
			let disruptionBonus = 1.0;
			if (disruptionIntensity > 0.3) {
				const desperation = Math.max(1.0, 1.0 + (1.0 - activeParticleRatio) * 3.0);
				disruptionBonus = desperation * (1.0 + disruptionIntensity * 2.0);
				if (disruptionTarget === a) disruptionBonus *= 1.5;
			}
			a.health -= damage * disruptionBonus * stationBonus;
		}

		return a.health > 0 && a.frame < 18000;
	});
}

export function updateStations(state) {
    const { w, h, outbreaks, anomalies, cursorBuffs, isManual, cursorX, cursorY, activeParticleRatio } = state;
	const now = Date.now();

	if (state.stations.length === 0 && now >= state.nextStationTime) {
		const angle = Math.random() * Math.PI * 2;
		const distance = (0.25 + Math.random() * 0.25) * Math.min(w, h);
		state.stations.push({
			x: state.centerX + Math.cos(angle) * distance, y: state.centerY + Math.sin(angle) * distance,
			vx: Math.cos(angle) * CONFIG.STATION_DRIFT_SPEED,
            vy: Math.sin(angle) * CONFIG.STATION_DRIFT_SPEED,
            spawnTime: now,
            isCapturing: false,
            captureTarget: null,
            captureTime: 0,
		});
	}

	state.stations = state.stations.filter((s) => {
		if (now - s.spawnTime > CONFIG.STATION_LIFETIME && !s.isCapturing) {
            state.nextStationTime = now + CONFIG.STATION_SPAWN_MIN + Math.random() * (CONFIG.STATION_SPAWN_MAX - CONFIG.STATION_SPAWN_MIN);
            return false;
        }

        if (s.isCapturing) {
            s.captureTime -= 16.67;
            if (s.captureTime <= 0) {
                if (s.captureTarget) {
                    if (outbreaks.includes(s.captureTarget)) s.captureTarget.regenBoostEndTime = now + 15000;
                    else if (anomalies.includes(s.captureTarget)) s.captureTarget.vortexBoostEndTime = now + 12000;
                }
                state.nextStationTime = now + CONFIG.STATION_SPAWN_MIN + Math.random() * (CONFIG.STATION_SPAWN_MAX - CONFIG.STATION_SPAWN_MIN);
                return false;
            }
        } else {
            s.x += s.vx;
            s.y += s.vy;
            if (s.x < 50 || s.x > w - 50) s.vx *= -1;
            if (s.y < 50 || s.y > h - 50) s.vy *= -1;

            // Gentle gravity
            for (const entity of [...outbreaks, ...anomalies]) {
                const dx = entity.x - s.x;
                const dy = entity.y - s.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < 300 * 300) {
                    const dist = Math.sqrt(distSq);
                    const force = (1 - dist / 300) * 0.05; // Very weak pull
                    s.vx += (dx / dist) * force;
                    s.vy += (dy / dist) * force;
                }
            }

            // Capture check
            for (const entity of [...outbreaks, ...anomalies]) {
                const dx = entity.x - s.x;
                const dy = entity.y - s.y;
                if (dx * dx + dy * dy < (CONFIG.STATION_CAPTURE_RADIUS + (entity.radius || 20)) ** 2) {
                    s.isCapturing = true;
                    s.captureTarget = entity;
                    s.captureTime = 1000;
                    break;
                }
            }
        }
		return true;
	});

	if (cursorBuffs.shieldActive && now > cursorBuffs.shieldEndTime) cursorBuffs.shieldActive = false;
	if (cursorBuffs.damageBoostActive && now > cursorBuffs.damageBoostEndTime) cursorBuffs.damageBoostActive = false;
	if (cursorBuffs.blackHoleKillBoostActive && now > cursorBuffs.blackHoleKillBoostEndTime) cursorBuffs.blackHoleKillBoostActive = false;
}