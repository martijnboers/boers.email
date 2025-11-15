// ============================================================================
// DEBUG PANEL - Activated with '?' key
// ============================================================================

class DebugPanel {
	constructor() {
		this.enabled = false;
		this.element = null;
		this.iconElement = null;
		this.setupKeyListener();
		this.createIcon();
	}

	setupKeyListener() {
		document.addEventListener("keydown", (e) => {
			if (e.key === "?" || (e.shiftKey && e.key === "/")) {
				this.toggle();
			}
		});
	}

	createIcon() {
		this.iconElement = document.createElement("div");
		this.iconElement.id = "debug-icon";
		this.iconElement.innerHTML = "?";

		// Check if mobile
		const isMobile = window.innerWidth <= 768 || window.matchMedia("(orientation: portrait)").matches;
		console.log('Debug icon - isMobile:', isMobile, 'width:', window.innerWidth);

		// Desktop: fixed to viewport (right corner), Mobile: absolute in content box (left corner)
		if (isMobile) {
			this.iconElement.style.position = 'absolute';
			this.iconElement.style.bottom = '20px';
			this.iconElement.style.left = '20px';
		} else {
			this.iconElement.style.position = 'fixed';
			this.iconElement.style.bottom = '30px';
			this.iconElement.style.right = '30px';
		}

		this.iconElement.style.width = '32px';
		this.iconElement.style.height = '32px';
		this.iconElement.style.background = 'rgba(0, 0, 0, 0.4)';
		this.iconElement.style.color = 'rgba(255, 255, 255, 0.3)';
		this.iconElement.style.border = '1px solid rgba(255, 255, 255, 0.15)';
		this.iconElement.style.borderRadius = '50%';
		this.iconElement.style.display = 'flex';
		this.iconElement.style.alignItems = 'center';
		this.iconElement.style.justifyContent = 'center';
		this.iconElement.style.fontFamily = "'JetBrains Mono', monospace";
		this.iconElement.style.fontSize = '16px';
		this.iconElement.style.fontWeight = '500';
		this.iconElement.style.cursor = 'pointer';
		this.iconElement.style.zIndex = '9999';
		this.iconElement.style.transition = 'all 0.2s ease';
		this.iconElement.style.backdropFilter = 'blur(4px)';
		this.iconElement.style.webkitBackdropFilter = 'blur(4px)';

		// Hover effect
		this.iconElement.addEventListener("mouseenter", () => {
			this.iconElement.style.background = "rgba(0, 0, 0, 0.6)";
			this.iconElement.style.color = "rgba(255, 255, 255, 0.6)";
			this.iconElement.style.borderColor = "rgba(255, 255, 255, 0.3)";
		});

		this.iconElement.addEventListener("mouseleave", () => {
			this.iconElement.style.background = "rgba(0, 0, 0, 0.4)";
			this.iconElement.style.color = "rgba(255, 255, 255, 0.3)";
			this.iconElement.style.borderColor = "rgba(255, 255, 255, 0.15)";
		});

		this.iconElement.addEventListener("click", () => {
			this.toggle();
		});

		// Desktop: append to body (fixed), Mobile: append to header (absolute within content)
		if (isMobile) {
			const headerInfo = document.querySelector('header .info');
			if (headerInfo) {
				headerInfo.style.position = 'relative';
				headerInfo.appendChild(this.iconElement);
				console.log('Debug icon appended to header .info');
			} else {
				document.body.appendChild(this.iconElement);
				console.log('Debug icon appended to body (fallback)');
			}
		} else {
			// Desktop: append directly to body for fixed positioning
			document.body.appendChild(this.iconElement);
			console.log('Debug icon appended to body (desktop)');
		}
	}

	toggle() {
		this.enabled = !this.enabled;
		if (this.enabled && !this.element) {
			this.create();
		}
		if (this.element) {
			this.element.style.display = this.enabled ? "block" : "none";
		}
		// Update icon appearance when panel is open
		if (this.iconElement) {
			if (this.enabled) {
				this.iconElement.style.background = "rgba(0, 0, 0, 0.7)";
				this.iconElement.style.color = "rgba(255, 255, 255, 0.8)";
				this.iconElement.style.borderColor = "rgba(255, 255, 255, 0.4)";
			} else {
				this.iconElement.style.background = "rgba(0, 0, 0, 0.4)";
				this.iconElement.style.color = "rgba(255, 255, 255, 0.3)";
				this.iconElement.style.borderColor = "rgba(255, 255, 255, 0.15)";
			}
		}
	}

	create() {
		this.element = document.createElement("div");
		this.element.id = "debug-panel";
		this.element.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			background: rgba(0, 0, 0, 0.92);
			color: #fff;
			padding: 20px;
			font-family: 'JetBrains Mono', monospace;
			font-size: 12px;
			line-height: 1.6;
			border: 1px solid rgba(255, 255, 255, 0.3);
			border-radius: 4px;
			max-width: 400px;
			max-height: 90vh;
			overflow-y: auto;
			z-index: 9999;
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
		`;

		// Create static header with close button
		const header = document.createElement("div");
		header.style.cssText = "margin-bottom: 16px; border-bottom: 2px solid #fff; padding-bottom: 8px; position: relative;";
		header.innerHTML = `
			<strong style="font-size: 14px;">DEBUG PANEL</strong>
			<button id="close-debug-btn" style="
				position: absolute;
				top: -5px;
				right: -5px;
				background: transparent;
				border: none;
				color: rgba(255, 255, 255, 0.5);
				font-size: 28px;
				cursor: pointer;
				padding: 5px;
				width: 36px;
				height: 36px;
				line-height: 24px;
				font-family: monospace;
				display: flex;
				align-items: center;
				justify-content: center;
			">×</button>
			<div style="font-size: 10px; color: #888; margin-top: 4px;">Press ? to toggle</div>
		`;

		// Create static controls section
		const controls = document.createElement("div");
		controls.style.cssText = "margin-bottom: 16px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;";
		controls.innerHTML = `
			<div style="color: #4CAF50; font-weight: bold; margin-bottom: 8px;">CONTROLS</div>
			<button id="spawn-virus-btn" style="
				background: rgba(255, 50, 50, 0.3);
				border: 1px solid #f44336;
				color: #fff;
				padding: 6px 12px;
				margin: 4px;
				cursor: pointer;
				font-family: 'JetBrains Mono', monospace;
				font-size: 11px;
				border-radius: 3px;
				transition: transform 0.1s ease;
			">+ Virus</button>
			<button id="spawn-anomaly-btn" style="
				background: rgba(156, 39, 176, 0.3);
				border: 1px solid #9C27B0;
				color: #fff;
				padding: 6px 12px;
				margin: 4px;
				cursor: pointer;
				font-family: 'JetBrains Mono', monospace;
				font-size: 11px;
				border-radius: 3px;
				transition: transform 0.1s ease;
			">+ Anomaly</button>
			<button id="spawn-station-btn" style="
				background: rgba(76, 175, 80, 0.3);
				border: 1px solid #4CAF50;
				color: #fff;
				padding: 6px 12px;
				margin: 4px;
				cursor: pointer;
				font-family: 'JetBrains Mono', monospace;
				font-size: 11px;
				border-radius: 3px;
				transition: transform 0.1s ease;
			">+ Station</button>
		`;

		// Create dynamic content container
		this.contentElement = document.createElement("div");
		this.contentElement.id = "debug-content";

		// Append everything
		this.element.appendChild(header);
		this.element.appendChild(controls);
		this.element.appendChild(this.contentElement);
		document.body.appendChild(this.element);

		// Set up button handlers once (they won't be recreated)
		this.setupActionButtons();
	}

	setupActionButtons() {
		// Close button
		const closeBtn = this.element.querySelector('#close-debug-btn');
		if (closeBtn) {
			closeBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.toggle();
			});
			// Hover effect for close button
			closeBtn.addEventListener("mouseenter", () => {
				closeBtn.style.color = "rgba(255, 255, 255, 1.0)";
			});
			closeBtn.addEventListener("mouseleave", () => {
				closeBtn.style.color = "rgba(255, 255, 255, 0.5)";
			});
		} else {
			console.error('Close button not found');
		}

		// Spawn Virus button
		const spawnVirusBtn = this.element.querySelector('#spawn-virus-btn');
		if (spawnVirusBtn) {
			spawnVirusBtn.addEventListener('click', () => {
				if (typeof window.debugSpawnVirus === 'function') {
					window.debugSpawnVirus();
					// Visual feedback
					spawnVirusBtn.style.transform = 'scale(0.95)';
					setTimeout(() => {
						spawnVirusBtn.style.transform = 'scale(1)';
					}, 100);
				} else {
					console.error('debugSpawnVirus function not found');
				}
			});
		} else {
			console.error('Virus button not found');
		}

		// Spawn Anomaly button
		const spawnAnomalyBtn = this.element.querySelector('#spawn-anomaly-btn');
		if (spawnAnomalyBtn) {
			spawnAnomalyBtn.addEventListener('click', () => {
				if (typeof window.debugSpawnAnomaly === 'function') {
					window.debugSpawnAnomaly();
					// Visual feedback
					spawnAnomalyBtn.style.transform = 'scale(0.95)';
					setTimeout(() => {
						spawnAnomalyBtn.style.transform = 'scale(1)';
					}, 100);
				} else {
					console.error('debugSpawnAnomaly function not found');
				}
			});
		} else {
			console.error('Anomaly button not found');
		}

		// Spawn Station button
		const spawnStationBtn = this.element.querySelector('#spawn-station-btn');
		if (spawnStationBtn) {
			spawnStationBtn.addEventListener('click', () => {
				if (typeof window.debugSpawnStation === 'function') {
					window.debugSpawnStation();
					// Visual feedback
					spawnStationBtn.style.transform = 'scale(0.95)';
					setTimeout(() => {
						spawnStationBtn.style.transform = 'scale(1)';
					}, 100);
				} else {
					console.error('debugSpawnStation function not found');
				}
			});
		} else {
			console.error('Station button not found');
		}
	}

	update(debugData) {
		if (!this.enabled || !this.contentElement) return;

		const {
			time,
			particles,
			cursor,
			viruses,
			anomalies,
			stations,
			performance,
			gameState,
		} = debugData;

		// Only update the dynamic content, not the header/buttons
		let html = '';

		// Time Section
		html += this.section("TIME", [
			`Elapsed: ${time.elapsed}`,
			`FPS: ${performance.fps}`,
		]);

		// Particles Section
		html += this.section("PARTICLES", [
			`Active: ${particles.active} / ${particles.total} (${particles.percentage}%)`,
			`Spacing: ${particles.spacing}px`,
			`Growth: ${particles.growthPhase}`,
		]);

		// Cursor Section
		const cursorInfo = [
			`Position: (${cursor.x}, ${cursor.y})`,
			`Velocity: (${cursor.vx}, ${cursor.vy})`,
			`Speed: ${cursor.speed}`,
			`Radius: ${cursor.radius}px (${cursor.radiusMultiplier}x)`,
			`Damage Mult: ${cursor.damageMultiplier}`,
			`Mode: ${cursor.mode}`,
		];
		if (cursor.buffs.length > 0) {
			cursorInfo.push(`<span style="color: #4CAF50;">Buffs: ${cursor.buffs.join(", ")}</span>`);
		}
		html += this.section("CURSOR", cursorInfo);

		// Viruses Section
		if (viruses.count > 0) {
			const virusInfo = [
				`Count: ${viruses.count}`,
				`Next spawn: ${viruses.nextSpawn}`,
			];

			if (viruses.largest) {
				const v = viruses.largest;
				virusInfo.push(`<div style="margin-top: 8px; padding: 8px; background: rgba(255, 0, 0, 0.1); border-left: 2px solid #f44336;">
					<strong style="color: #f44336;">Largest Virus</strong><br>
					Health: ${v.health}/${v.maxHealth} (${v.healthPercent}%)<br>
					Radius: ${v.radius}px<br>
					Frame: ${v.frame} (${v.phase})<br>
					Pull: ${v.pullRadius}px (${v.pullForce}x)<br>
					Regen: ${v.regenActive ? '<span style="color: #ff9800;">ACTIVE</span>' : 'none'}
				</div>`);
			}
			html += this.section("VIRUSES", virusInfo);
		}

		// Anomalies Section
		if (anomalies.count > 0) {
			const anomalyInfo = [
				`Count: ${anomalies.count}`,
				`Vortex Radius: ${anomalies.vortexRadius}px`,
				`Vortex Strength: ${anomalies.vortexStrength}`,
			];
			html += this.section("ANOMALIES", anomalyInfo);
		}

		// Stations Section
		if (stations.count > 0) {
			const stationInfo = [
				`Count: ${stations.count}`,
				`Next spawn: ${stations.nextSpawn}`,
			];

			stations.list.forEach((s, idx) => {
				stationInfo.push(`<div style="margin-top: 8px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-left: 2px solid #fff;">
					<strong>Station ${idx + 1}</strong><br>
					Age: ${s.age}s / ${s.lifetime}s (${s.agePercent}%)<br>
					Position: (${s.x}, ${s.y})<br>
					Active ripples: ${s.rippleCount}<br>
					Ripple interval: ${s.rippleInterval}ms
				</div>`);
			});
			html += this.section("ENERGY STATIONS", stationInfo);
		}

		// Disruption Section
		if (gameState.disruption) {
			const d = gameState.disruption;
			const disruptionInfo = [
				`Available: ${d.available ? '<span style="color: #4CAF50;">YES</span>' : '<span style="color: #f44336;">NO</span>'}`,
				`Cooldown: ${d.cooldownRemaining}s`,
				`Coverage: ${d.coverage}%`,
				`Power: ${d.power}x`,
			];
			html += this.section("DISRUPTION", disruptionInfo);
		}

		// Performance Section
		const perfInfo = [
			`Canvas: ${performance.canvasWidth}x${performance.canvasHeight}`,
			`Screen multiplier: ${performance.screenMultiplier}`,
			`Device: ${performance.isMobile ? 'Mobile' : 'Desktop'}`,
		];
		html += this.section("PERFORMANCE", perfInfo);

		// Only update the dynamic content area, leaving buttons intact
		this.contentElement.innerHTML = html;
	}

	section(title, items) {
		let html = `<div style="margin-bottom: 16px;">
			<div style="color: #4CAF50; font-weight: bold; margin-bottom: 6px;">${title}</div>
		`;

		items.forEach(item => {
			html += `<div style="padding-left: 8px; margin-bottom: 2px;">${item}</div>`;
		});

		html += `</div>`;
		return html;
	}

	destroy() {
		if (this.element) {
			this.element.remove();
			this.element = null;
		}
	}
}

// Export for use in main animation file
if (typeof module !== 'undefined' && module.exports) {
	module.exports = DebugPanel;
}
