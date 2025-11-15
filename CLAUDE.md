# boers.email - Particle Animation Portfolio

## Project Overview

A minimalist personal portfolio website with an interactive particle-based animation system. The animation features a dynamic battle between a cursor (player), black holes (viruses), anomalies, and energy stations, all rendered using a custom particle physics engine.

## Architecture

### Core Files

- **index.html** - Main HTML structure with header/contact sections and animation containers
- **css/main.css** - Responsive styling with desktop/mobile layouts
- **js/animation.js** - Main particle physics and game logic (~2500 lines)
- **js/debug-panel.js** - Debug panel with entity spawning controls
- **js/util.js** - Utility functions (year display)
- **js/request-animation.js** - RequestAnimationFrame polyfill

### Animation System

The animation runs at 60fps using a **frame-toggle system**:
- **Even frames**: Physics updates (particle movement, forces)
- **Odd frames**: Rendering (ImageData pixel manipulation)

This alternating approach ensures smooth performance on large screens.

## Key Components

### 1. Particle System

**Grid-based initialization:**
- Desktop: 10.5px spacing (~17,500 particles on 1920x1080)
- Mobile: 5.0px spacing (denser for smaller screens)
- Particles rendered directly to ImageData for maximum performance

**Particle properties:**
- Position (x, y) and velocity (vx, vy)
- Original position (ox, oy) for spring-back forces
- Active state (grows over time)
- Nervousness and awareness traits for organic behavior
- `shockDisabledUntil` timestamp for shock wave effects

**Particle forces:**
- Spiral motion (tightens over time)
- Cursor repulsion/attraction
- Black hole gravity (push then pull)
- Anomaly vortex (spiral inward)
- Energy station rotating ring and radial burst patterns
- Shock wave temporary disabling

**Growth phases:**
- 0-60%: Grows from 8% to 68% of original radius
- 60%+: Fluctuates between 55-70% using sine wave

**Dynamic particle spawning:**
- New particles can be spawned at runtime via `spawnParticles(x, y, count, spreadRadius, burstVelocity)`
- Spawned particles use their spawn position as their "home" (ox, oy) for spring-back behavior
- Energy stations spawn particles during burst phase (bright explosion effect)
- Shock waves spawn particles in expanding ring pattern (makes wave visible through particles only)
- Spawned particles are immediately active and integrate with all existing forces

### 2. Black Holes (Viruses/Outbreaks)

**Lifecycle:**
- Frames 0-360: **Push phase** - repels particles outward
- Frames 360+: **Pull phase** - attracts particles with increasing gravity
- **Slow continuous growth**: 30 seconds to reach 2x, 90 seconds to reach 4x pull radius
- Health scales with screen size multiplier
- **Particle consumption**: Particles that enter the inner 35% of the black hole radius are permanently consumed and removed from the game
- **Anomaly protection**: Particles within 80px of an anomaly are protected from consumption (strategic positioning!)
- Balanced to maintain visible particle field while creating threat

**Spawn mechanics:**
- Desktop: 25-45 seconds (faster when winning, slower when losing)
- Mobile: 28-50 seconds (slightly slower overall)
- Health: 300-500 (base) * screen multiplier
- Pull radius grows from 4x to 8x+ over time
- Creates subtle "ring of darkness" visual effect (5-20% dimming)

**Key constants (js/animation.js):**
```javascript
OUTBREAK_SPAWN_INTERVAL: 15000  // Base spawn every 15s
OUTBREAK_PUSH_FORCE: 2.0
OUTBREAK_PULL_FORCE_BASE: 0.0005
OUTBREAK_PULL_RADIUS_MIN: 4.0
OUTBREAK_PULL_RADIUS_MAX: 8.0
```

### 3. Cursor Mechanics

**Movement:**
- Desktop: Slower, methodical (0.3-0.85 speed multiplier)
- Mobile: Faster, responsive (0.6-1.15 speed multiplier)
- Speed scales with active particle ratio
- Radius pulsates: Desktop 18-40%, Mobile 8-15%

**Damage system:**
- Inverse particle scaling: 100% damage at 0% particles, 40% at 100%
- Prevents cursor from being overpowered late game
- Black hole kill grants 8-second power boost (2x speed, 2.5x damage)
- Manual control: 3.5x damage at center vs 1.2x automatic

**Manual control:**
- Smooth 2.5-second transition back to automatic control
- Buff particle effects reduced to 30% during manual for stability
- Speed boosts blend in gradually during transition

**Particle spawning:**
- Cursor spawns particles when below 50% active particles
- Spawns every 120ms at cursor edge (60% of repulsion radius)
- 6 particles per spawn (scaled with spacing)
- Creates "halo" effect and keeps field populated while maintaining tension

**Attraction forces:**
- Only attracts to viruses in early game (<30% particles)
- Very weak pull to avoid "indecisive" movement
- No attraction to anomalies

### 4. Disruption Ability

**Activation:**
- Triggers when largest black hole covers 70%+ of screen diagonal
- Automatic decision-making by cursor
- Cooldown: 5-20 seconds (faster when losing)

**Power scaling:**
- Base damage scales 1x-6x with black hole dominance (more dramatic!)
- With intensity: Up to 18x damage
- Primary target: Up to 27x damage (MASSIVE comeback potential!)
- Secondary target: Up to 23.4x damage
- Pull forces also scale 2-3x stronger

### 5. Anomalies

**Behavior:**
- Spiral vortex that pulls particles inward
- **Protect particles from black hole consumption** within 80px radius
- Strategic positioning: Place between black holes and particles
- Spawn rarely to add variety
- Captured by black holes for vortex boost
- Lifespan: max 5 minutes

### 6. Energy Stations

**Visual design:**
- **No visual marker** - only visible through particle effects
- **Compact geometric grid pattern** - particles snap to grid positions for structured, blocky aesthetic
- **Concentric square pulses** - animated waves expand outward through grid levels
- Constant 35px radius - small, clean pattern that looks good in the particle battle
- Charging ripples pull particles inward while maintaining grid structure
- Burst ripples create explosive radial push that disrupts grid temporarily
- Max 2 stations at once for normal gameplay (unlimited in debug mode)

**Mechanics:**
- Spawn every 30-60 seconds when >25% particles
- Lifetime: 75 seconds
- Capture radius: 35px
- Buffs: Shield (10s) or Damage Boost (10s)

**Capture Visual Feedback:**
- **Cursor capture**: 15-particle straight stream flows from station to cursor
- **Virus capture**: 20-particle stream flows from station to virus (faster velocity)
- **Anomaly capture**: 18-particle spiral stream flows from station to anomaly
- Makes it crystal clear WHO captured the station and got the powerup!

**Charging cycle (15 seconds total):**
- **Grid snapping**: Particles continuously pulled toward nearest grid points
  - Grid spacing: 2x particle spacing (creates blocky pixel art effect)
  - Snap strength decreases with distance from grid point
  - Fixed 35px radius - compact, clean geometric pattern
- **Concentric square pulses**: Animated waves through grid levels
  - Each "square level" pulses at different times
  - Creates rippling effect outward from center
  - Pulses add subtle radial force
- **Charging phase (80% / 12s)**: Slow rotating ring pulling particles inward
  - Radial force: 12.0 (gentle pull toward center)
  - Orbital force: 8.0 (clockwise rotation)
  - Wave expansion: 1.2px/frame
- **Burst phase (20% / 3s)**: Explosive radial burst pushing particles outward
  - Burst force: 60.0 (dramatic explosion)
  - Wave expansion: 6.0px/frame
  - Random variation (±0.3 radians) for organic effect
  - **Spawns 80 particles** (scaled with spacing) - HUGE reward keeps field populated!
  - Burst radius: 30px, velocity: 4.0px/frame
- Wave thickness: 200px (large affected area)
- Ripple interval: 15s initially, speeds up to 7s as station ages

### 7. ~~Shock Wave System~~ (Disabled)

The shock wave system has been disabled in favor of cursor particle spawning. The code remains in the codebase but is commented out.

## Performance Considerations

### Desktop Optimization

**Critical for fullscreen:**
1. **Particle spacing** - 10.5px reduces count dramatically on large screens
2. **Fresh ImageData** - Creating new instead of clearing is faster
3. **Station limit** - Max 2 stations prevents force calculation explosion
4. **Squared distance checks** - Avoid expensive sqrt() where possible
5. **Early exits** - Skip inactive particles and out-of-range calculations

### Mobile Optimization

- Higher particle density (5px spacing) is fine on smaller screens
- Touch events use `passive: false` with `preventDefault()`
- Faster cursor movement for better responsiveness
- Less dramatic radius pulsing
- **Smart resize detection**: Only re-renders on width changes >100px (prevents re-render during scrolling when URL bar hides/shows)

## Styling System

### Desktop Layout
- **Single merged panel**: Header and contact sections form one continuous box
- Semi-transparent background: `rgba(0, 0, 0, 0.7)`
- Subtle borders: `hsla(0, 0%, 100%, .2)`
- Divider line between bio and contact info
- 20px horizontal padding, proper vertical spacing

### Mobile Layout
- **Three separate panels**: Header, animation, contact
- Animation section: 600px height, inline in page flow
- Full borders on all sections
- No divider (hidden)

### Typography
- Font: JetBrains Mono
- H1: 18px, uppercase, 500 weight
- H2: 13px, uppercase, 300 weight
- Body: 14px, 300 weight
- Proper spacing: h1 8px bottom, h2 16px bottom

## Configuration Values (js/animation.js)

```javascript
CONFIG = {
  // Particle grid
  SPACING_MOBILE: 5.0,
  SPACING_DESKTOP: 10.5,
  COLOR: 220,  // Grayscale value

  // Physics
  PARTICLE_DRAG: 0.92,
  CURSOR_LERP: 0.15,
  REPULSION_RADIUS: 68,
  REPULSION_FORCE: 8.5,

  // Growth
  GROWTH_DURATION: 60000,  // 60 seconds
  GROWTH_START_RADIUS: 0.08,  // 8%

  // Black holes
  OUTBREAK_SPAWN_INTERVAL: 15000,
  OUTBREAK_PUSH_DURATION: 360,  // frames
  OUTBREAK_HEALTH_MIN: 300,
  OUTBREAK_HEALTH_MAX: 500,

  // Stations
  STATION_SPAWN_MIN: 30000,
  STATION_SPAWN_MAX: 60000,
  STATION_LIFETIME: 75000,
  STATION_CAPTURE_RADIUS: 35,

  // Cursor particle spawning
  CURSOR_SPAWN_INTERVAL: 150,  // 150ms between spawns
  CURSOR_SPAWN_RADIUS_MULT: 0.6,  // Spawn at 60% of repulsion radius
}
```

## Game Balance Philosophy

1. **Real tension** - You can actually win or lose (cursor only spawns when below 40%)
2. **Comeback mechanics** - Disruption up to 27x damage when desperate, cursor spawns when losing
3. **Reward success** - Black hole kills grant temporary power boost
4. **Strategic depth** - Anomalies protect particles from consumption, position them wisely
5. **Diversity of encounters** - Black holes spawn less frequently (25-50s) but each one matters more
6. **Visual feedback** - Subtle ring of darkness, buff indicators, geometric station patterns
7. **Minimal UI** - All state communicated through particle behavior
8. **Balanced particle economy** (tuned for visible action):
   - Cursor **spawns** 6 particles every 120ms when below 50% (steady replenishment)
   - Energy stations **spawn** 80 particles during burst phase (huge reward!)
   - Black holes **consume** particles in 35% radius (threat without emptying field)
   - Anomalies **protect** particles from consumption (strategic utility)
   - Balance maintains visible particle field while creating tension

## Debug Menu

Press **?** to toggle debug panel, or click the **⚙** (cog wheel) icon showing:
- Active particle ratio and FPS
- Entity counts (viruses, anomalies, stations)
- Cursor state (position, velocity, mode, buffs)
- Disruption status and coverage
- Largest black hole stats with health and pull radius
- Active buffs with remaining time
- **Control buttons**: Spawn viruses, anomalies, and stations on demand

**Debug panel features:**
- Fixed position (top-right)
- X button for easy closing (mobile-friendly)
- Unlimited entity spawning (bypasses normal gameplay limits)
- Smart spawn positioning (150px from cursor for viruses/anomalies, 100px for stations)

**Debug icon:**
- Desktop: Fixed bottom-right corner (30px, 30px)
- Mobile: Absolute within header bottom-left (20px, 20px)
- Cog wheel icon (⚙) with rotation animation when panel open
- Size: 40px diameter for better touch targeting
- Subtle dark aesthetic matching site design
- Hover/touch effects for visibility
- Touch-optimized with proper event handling and debugging

## Common Issues

### Performance
- **Choppy on fullscreen**: Increase `SPACING_DESKTOP` to reduce particles
- **Stuttering**: Check station count (should be ≤2) and particle force loops
- **Mobile lag**: Reduce `SPACING_MOBILE` or disable station forces

### Visual
- **Station grid not visible**: Increase grid snap strength or reduce grid spacing
- **Grid too loose**: Decrease `gridSpacing` multiplier (currently 2x particle spacing)
- **Grid too tight**: Increase `gridRadius` (currently fixed at 35px) or reduce snap strength
- **Grid too small/large**: Adjust constant `gridRadius` value for desired size
- **Black holes too weak/strong**: Adjust `OUTBREAK_HEALTH_MIN/MAX` and spawn interval
- **Cursor too slow/fast**: Modify speed multipliers in `updateCursor()` function
- **Station bursts not visible**: Increase burst force or particle spawn count
- **Manual control erratic**: Check buff reduction multiplier (should be 0.3)
- **Cursor spawning too many/few particles**: Adjust spawn interval (currently 150ms) or particle count
- **Cursor halo effect too subtle**: Increase spawn radius multiplier (currently 0.6) or particle count
- **Debug icon not working on mobile**: Check browser console for touch event logs, verify z-index and pointer-events
- **Too many spawned particles**: Reduce spawn count in `spawnParticles()` calls or increase spawn interval

### Layout
- **Borders not connecting**: Check media query breakpoints and border rules
- **Mobile animation not showing**: Verify `li.animation-container` display rules
- **Text too close to edges**: Adjust padding on `ul.header-section li` and `ul.contact-section li`

## Development Notes

- **Never use padding on ul elements** - Apply to li instead to keep borders connected
- **Station forces are expensive** - Always early-exit when possible (check distance first)
- **Grid snapping creates structure** - Particles snap to grid points for blocky pixel art aesthetic
- **Frame toggle is critical** - Don't run physics and render in same frame
- **Mobile touch requires passive:false** - Otherwise preventDefault() fails
- **ImageData is fastest** - Don't use canvas drawing APIs for particles
- **Debug spawn functions** - Must spawn entities away from cursor to avoid instant dissolution (25px dissolve radius)
- **Mobile resize events** - Filter height-only changes to prevent re-render on scroll (URL bar)
- **Manual control buffs** - Reduce particle effect intensity to 30% for stable control
- **Transition blending** - Use 2.5-second smooth blend when returning to automatic control
- **Cursor particle spawning** - Cursor continuously spawns particles for halo effect and gameplay balance
- **Particle-only visuals** - All effects visible through particle behavior (no white canvas drawings)
- **Dynamic particle spawning** - Use `spawnParticles()` to add particles at runtime for visual effects
- **Capture feedback** - Particle streams flow from stations to capturing entities for clear visual communication
- **Touch event debugging** - Use console.log with event type for mobile touch issues
- **Touch/click separation** - Track touchUsed flag to prevent double-firing on touch devices
- **Touch action management** - Use `pan-y` to allow scrolling while enabling canvas interaction
- **Debug icon pointer events** - Must have `pointer-events: auto` to override header's `pointer-events: none`
- **No libraries needed** - Vanilla JS is fastest and most maintainable for this project

## Future Optimization Ideas

- Web Workers for physics calculations
- Spatial hashing for particle neighbor lookups
- Canvas pooling for multiple simultaneous effects
- Optimize station ring/burst calculations for large particle counts
- Cull off-screen particles more aggressively
- Cache distance calculations between particles and stations

## Session Continuity

When continuing work on this project:
1. Test both desktop fullscreen (1920x1080+) and mobile views
2. Check performance with F12 performance monitor
3. Verify border connections on both layouts
4. Test touch interactions on actual mobile device
5. Ensure particle density looks good at target spacing

## Contact Information

- Email: martijn@boers.email
- Matrix: @martijn:boers.email
- GitHub: martijnboers
- Mastodon: @martijn@noisesfrom.space
