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
		this.iconElement.innerHTML = "⚙";

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

		this.iconElement.style.width = '40px';
		this.iconElement.style.height = '40px';
		this.iconElement.style.background = 'rgba(0, 0, 0, 0.4)';
		this.iconElement.style.color = 'rgba(255, 255, 255, 0.3)';
		this.iconElement.style.border = '1px solid rgba(255, 255, 255, 0.15)';
		this.iconElement.style.borderRadius = '50%';
		this.iconElement.style.display = 'flex';
		this.iconElement.style.alignItems = 'center';
		this.iconElement.style.justifyContent = 'center';
		this.iconElement.style.fontFamily = "'JetBrains Mono', monospace";
		this.iconElement.style.fontSize = '20px';
		this.iconElement.style.fontWeight = '400';
		this.iconElement.style.cursor = 'pointer';
		this.iconElement.style.pointerEvents = 'auto';
		this.iconElement.style.zIndex = '9999';
		this.iconElement.style.transition = 'all 0.2s ease';
		this.iconElement.style.backdropFilter = 'blur(4px)';
		this.iconElement.style.webkitBackdropFilter = 'blur(4px)';
		this.iconElement.style.userSelect = 'none';
		this.iconElement.style.webkitUserSelect = 'none';
		this.iconElement.style.touchAction = 'manipulation';
		this.iconElement.style.webkitTapHighlightColor = 'transparent';

		// Hover/touch active effect
		const setActiveState = () => {
			this.iconElement.style.background = "rgba(0, 0, 0, 0.6)";
			this.iconElement.style.color = "rgba(255, 255, 255, 0.6)";
			this.iconElement.style.borderColor = "rgba(255, 255, 255, 0.3)";
		};

		const setInactiveState = () => {
			this.iconElement.style.background = "rgba(0, 0, 0, 0.4)";
			this.iconElement.style.color = "rgba(255, 255, 255, 0.3)";
			this.iconElement.style.borderColor = "rgba(255, 255, 255, 0.15)";
		};

		// Mouse events for desktop
		this.iconElement.addEventListener("mouseenter", setActiveState);
		this.iconElement.addEventListener("mouseleave", setInactiveState);

		// Touch/click handling with proper event management
		let touchUsed = false;

		// Touch events for mobile (with debugging and click prevention)
		this.iconElement.addEventListener("touchstart", (e) => {
			console.log('DEBUG: touchstart fired on icon');
			touchUsed = true;
			e.preventDefault();
			e.stopPropagation();
			setActiveState();
		}, { passive: false });

		this.iconElement.addEventListener("touchend", (e) => {
			console.log('DEBUG: touchend fired on icon');
			e.preventDefault();
			e.stopPropagation();
			setInactiveState();
			this.toggle();
		}, { passive: false });

		// Click event for desktop (prevent on touch devices)
		this.iconElement.addEventListener("click", (e) => {
			console.log('DEBUG: click fired on icon, touchUsed:', touchUsed);
			// Prevent click if touch was used (avoids double-firing)
			if (touchUsed) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			e.stopPropagation();
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
		// Update icon appearance when panel is open (rotate cog wheel)
		if (this.iconElement) {
			if (this.enabled) {
				this.iconElement.style.background = "rgba(0, 0, 0, 0.7)";
				this.iconElement.style.color = "rgba(255, 255, 255, 0.8)";
				this.iconElement.style.borderColor = "rgba(255, 255, 255, 0.4)";
				this.iconElement.style.transform = "rotate(180deg)";
			} else {
				this.iconElement.style.background = "rgba(0, 0, 0, 0.4)";
				this.iconElement.style.color = "rgba(255, 255, 255, 0.3)";
				this.iconElement.style.borderColor = "rgba(255, 255, 255, 0.15)";
				this.iconElement.style.transform = "rotate(0deg)";
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
		header.style.cssText = "margin-bottom: 16px; padding-bottom: 8px; position: relative;";
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
			<div style="font-size: 10px; color: #888; margin-top: 4px;">Press ? or tap ⚙ to toggle</div>
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
				background: rgba(255, 193, 7, 0.3);
				border: 1px solid #FFC107;
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
			// Add touch support
			closeBtn.style.touchAction = 'manipulation';

			// Track which event type fired to prevent double-firing
			let closeTouchUsed = false;
			let closeResetTimeout;

			closeBtn.addEventListener('touchend', (e) => {
				e.preventDefault();
				e.stopPropagation();
				closeTouchUsed = true;
				clearTimeout(closeResetTimeout);
				closeResetTimeout = setTimeout(() => { closeTouchUsed = false; }, 300);
				this.toggle();
			}, { passive: false });

			closeBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				// Prevent click if touch was used (avoids double-firing)
				if (closeTouchUsed) {
					console.log('DEBUG: Close button click blocked (touch already fired)');
					return;
				}
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

		// Helper function for button setup
		const setupButton = (buttonId, spawnFunction, buttonName) => {
			const button = this.element.querySelector(buttonId);
			if (button) {
				button.style.touchAction = 'manipulation';

				const handleSpawn = (e) => {
					e.preventDefault();
					e.stopPropagation();

					if (typeof spawnFunction === 'function') {
						spawnFunction();
						// Visual feedback
						button.style.transform = 'scale(0.95)';
						setTimeout(() => {
							button.style.transform = 'scale(1)';
						}, 100);
					} else {
						console.error(`${buttonName} function not found`);
					}
				};

				button.addEventListener('click', handleSpawn);
				button.addEventListener('touchend', handleSpawn, { passive: false });
			} else {
				console.error(`${buttonName} button not found`);
			}
		};

		// Setup all spawn buttons
		setupButton('#spawn-virus-btn', window.debugSpawnVirus, 'debugSpawnVirus');
		setupButton('#spawn-anomaly-btn', window.debugSpawnAnomaly, 'debugSpawnAnomaly');
		setupButton('#spawn-station-btn', window.debugSpawnStation, 'debugSpawnStation');
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

export default DebugPanel;
