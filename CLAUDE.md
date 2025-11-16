# boers.email - Particle Animation Portfolio

## Project Overview

A minimalist personal portfolio website with an interactive particle-based animation system. The animation features a dynamic battle between a cursor (player), black holes (viruses), and anomalies, all rendered using a custom particle physics engine. A "Formation" entity also appears periodically, offering power-ups to the other entities.

## Architecture

### Core Files

- **index.html** - Main HTML structure with header/contact sections and animation containers.
- **css/main.css** - Responsive styling with desktop/mobile layouts.
- **js/main.js** - The main entry point, handling initialization, the game loop, and state management.
- **js/config.js** - Contains all the configuration values for the animation.
- **js/particle.js** - Defines the `Particle` class and its physics.
- **js/entities.js** - Manages the lifecycle and logic for all entities (viruses, anomalies, formations).
- **js/debug-panel.js** - A UI panel with entity spawning controls and diagnostic information.

### Animation System

The animation runs at 60fps using a **frame-toggle system**:
- **Even frames**: Physics updates (particle movement, forces).
- **Odd frames**: Rendering (ImageData pixel manipulation).

This alternating approach ensures smooth performance on large screens.

## Key Components

### 1. Particle System

**Grid-based initialization:**
- Desktop: 8.0px spacing.
- Mobile: 5.0px spacing.
- Particles are rendered directly to an ImageData buffer for maximum performance.

**Particle properties:**
- Position (x, y) and velocity (vx, vy).
- Original position (ox, oy) for spring-back forces.
- Active state (the grid of particles grows over time).
- `isFormation` flag to dedicate particles to the Formation entity.

**Particle forces:**
- Cursor repulsion (V-shaped "plow" effect).
- Black hole gravity (push then pull).
- Anomaly vortex (spiral inward).
- Strong pull to "home" position (`ox`, `oy`), which is dynamically updated for Formation particles.

### 2. Black Holes (Viruses/Outbreaks)

**Lifecycle:**
- **Push phase (initial):** Repels particles outward.
- **Pull phase (mature):** Attracts particles with increasing gravity.
- Health scales with screen size.

**Spawn mechanics:**
- Spawn periodically, with the interval based on game state.

### 3. Cursor Mechanics

**Movement:**
- **Automatic:** A blend of a complex cruising path and "investigative" attraction to nearby threats. The cursor is always in motion, orbiting the center and reacting to the environment.
- **Manual:** Direct 1:1 control via mouse/touch. The cursor's position is set directly to the input, providing a highly responsive feel. Environmental gravity still applies.

**Interaction:**
- **V-Shaped Hull:** The cursor displaces particles using a "V-shaped hull" model, creating a clean "plowing" effect that becomes sharper and more defined at higher speeds.
- **Warp-In:** The cursor starts off-screen and is pulled into the grid by the first gravitational forces, creating a "warp-in" effect. Its visual impact on the grid ramps up over the first 7 seconds.

**Damage system:**
- Damage is proportional to the cursor's radius, which changes based on buffs and game state.

### 4. Disruption Ability

**Activation:**
- The cursor's ultimate weapon, which triggers automatically when a black hole grows powerful enough to consume most of the particles.
- This provides a "comeback" mechanic to break endgame stalemates.

**Effect:**
- Massively boosts the cursor's damage for a short period, allowing it to shatter the dominant threat.

### 5. Anomalies

**Behavior:**
- Create a spiral vortex that pulls particles inward.
- Can be destroyed by the cursor.
- Can capture Formations to receive a temporary power-up (stronger vortex).

### 6. Formations

**Appearance:**
- A 2x2 square of glowing white particles.

**Behavior:**
- A single Formation moves at a constant velocity, bouncing off the screen edges.
- It is composed of 4 dedicated particles that are strongly pulled to the corners of the moving square, creating a stable shape that glides through the grid.
- It does not displace other particles, leaving no trail.
- It is gently nudged by gravity but is not strongly pulled.

**Capture:**
- Can be captured by viruses or anomalies that move over it.
- Capture triggers a particle stream animation and grants the capturer a temporary buff (e.g., boosted regeneration for viruses).
- After capture, the Formation's particles are released, and a new Formation is created with a new set of dedicated particles.

## Debug Menu

Press **?** to toggle the debug panel, which shows:
- FPS and particle counts.
- Entity states (viruses, anomalies, formations).
- Cursor diagnostics (position, velocity, mode).
- **Control buttons:** Manually spawn viruses, anomalies, and formations.