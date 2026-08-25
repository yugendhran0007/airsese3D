# AirSense — Real-Time Interactive 3D Office Environment

AirSense visualizes how **Chennai's live outdoor weather and air quality**, **office occupancy**, and
**ventilation** interact to shape the indoor environment — CO₂, O₂, temperature, humidity, airflow —
in a fully interactive 3D office you can walk through.

Built per the spec in `md`: dummy/simulated indoor data today, physical sensors later, without a rewrite.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle in dist/
```

No API keys needed — Chennai weather + AQI come from the free, keyless [Open-Meteo](https://open-meteo.com) APIs.

## What you can do

- **Photorealistic mode** (default, toggle "Real/Styled" in the top bar): bright architectural office
  with image-based lighting (three.js RoomEnvironment), wood-plank floor, CC0
  [KayKit Furniture Bits](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0) desks,
  chairs and break-area decor, and a **skinned, animated human avatar** (three.js Soldier with
  Idle/Walk/Run crossfades driven by your live movement speed). The stylized dark neon mode remains
  one click away.
- **Human employees**: every one of the up-to-100 instanced workers has a textured face (eyes, brows,
  smile), a skin tone, a hair style (short cap or long bob), and a male/female office outfit
  (shirt + tie or blouse + skirt) — all deterministic per person and still GPU-instanced. In realistic
  mode a few skinned, walk-animated employees also stroll the aisles. Realistic mode adds a gradient
  daylight sky, a lit ceiling with recessed panels (invisible to the top-down camera), window
  mullions, monitor stands, keyboards, and desk mats.
- **Per-person side effects**: in yellow/red zones a deterministic share of occupants visibly slump,
  their rings pulse hot red, and a floating ⚠ badge appears over their heads (like the concept image).
  **Click any person** to open their inspector: zone exposure values + possible comfort effects,
  always labeled educational/not-medical. The Human Insight panel shows a split
  *Optimal air vs This office now* silhouette comparison with organ-region highlights.
- **Increase / Decrease modes** (top bar): continuous condition ramps. *Increase* fills the office and
  starves ventilation so you watch the environment degrade live; *Decrease* empties it and recovers
  HVAC until everything trends green. Ramp speed follows the simulation speed control.
- **Walk the office**: WASD / arrow keys or click the floor to send your avatar (like messenger.abeto.co).
  The bottom HUD shows the air of the exact zone you're standing in; your status ring turns
  green / yellow / red as you cross zones.
- **Change everything**: people (global slider, ± buttons, per-zone ±), room W×L×H, ventilation,
  fresh-air %, AC power + setpoint, doors, windows, initial conditions, simulation speed 0.5×–10×.
- **Watch the physics respond**: CO₂ mass balance (generation vs air-changes-per-hour), heat balance
  (occupant + equipment gains vs AC and envelope), absolute-humidity balance with AHU coil
  dehumidification. Values drift smoothly; O₂ is derived honestly (never fake danger) and is always
  badged **SIMULATED**.
- **Zones**: the floor is a 2×2 zone grid (A–D) with per-zone people, readings, status, floor heatmap
  glow, and inter-zone air mixing.
- **Alerts + recommendations**: hysteresis-based alerts (no flapping) with practical environmental
  recommendations — including "outdoor AQI is high, prefer filtered fresh air over open windows".
- **Charts**: 8 history series (CO₂, occupancy, temp, humidity, O₂, ventilation, outdoor temp,
  outdoor AQI) with threshold bands, plus a correlation view (occupancy vs CO₂ vs ventilation).
- **Scenarios**: five scripted timelines (normal, rising occupancy, poor ventilation, improved
  ventilation, reduced occupancy).
- **Presentation mode**: a 9-scene cinematic fly-through with captions (ESC exits).
- **Human Insight panel**: educational "possible comfort effects" indicators with a permanent
  not-medical-advice disclaimer.
- **Reliability**: if the weather API fails, the last reading is kept and labeled **STALE**
  (never passed off as live); the indoor simulation keeps running.

## Conference room & the Sketchfab models

- The glass **conference room** on the back wall (boardroom table, chairs, wall display, pendant
  lights) is built in code from the look of the Sketchfab "Conference Room" reference — that model is
  view-only (not downloadable, no license granted), so it cannot be imported directly.
- The Sketchfab **"Office Studio"** model (CC Attribution) *is* downloadable and can replace the whole
  building: log in on its page → **Download 3D Model** → **glTF**, unzip into
  `public/models/office/` so `public/models/office/scene.gltf` exists (keep the `.bin` + textures
  beside it), and reload — the app auto-fits it to your room size. Delete the folder to go back to
  the built-in building. Keep the author credit from the download's license.txt.

## Architecture

```
Open-Meteo (weather + AQI)        DummyOutdoorProvider        SensorProvider (future)
            └────────────── OutdoorProvider interface ──────────────┘
                                     │
                       SimulationEngine (plain TS singleton)
                 fixed-step tick · zone physics · status · alerts
                     │                                  │
        R3F scene reads engine directly      zustand stores (4 Hz snapshots)
        in useFrame (60 fps, no re-renders)  → DOM dashboard, charts, HUD
```

- `src/simulation/` — physics (`physics.ts`), engine loop, zones, status, alerts, recommendations,
  history ring buffer, scenario player.
- `src/providers/` — the provider seam. Real sensors later = one new class, zero frontend changes.
- `src/scene/` — procedural office (no external 3D assets), instanced crowd (up to 100 people),
  WASD + click-to-walk character, GPU airflow particles, weather-reactive lighting, bloom.
- `src/ui/` — glass dark-theme overlay: dashboard cards (with SIMULATED/MEASURED badges),
  outdoor card, indoor-vs-outdoor comparison, zone panel, control drawer, Recharts drawers.

### Key physics (all constants in `src/config/constants.ts`)

- CO₂: `dC/dt = people·0.018 m³/h / V · 10⁶ − ACH_fresh·(C − 420 ppm)`
- ACH: `0.3 (infiltration) + 8·vent%·fresh% (mechanical) + windows·2·windFactor + door·0.5`
- Temperature: envelope + ventilation (AHU coil conditions mechanical intake) + 100 W/person
  + 150 W/desk − AC cooling toward setpoint
- Humidity: tracked as absolute g/m³ (Magnus conversion for display RH), coil condensation
- O₂: `20.95 − ΔCO₂/10⁴/0.85` — drifts in the 2nd decimal, by design

## Dev scripts

```bash
node scripts/verify.mjs [url] [shot.png] [waitMs]   # headless render + engine state dump
node scripts/interact.mjs [outDir]                  # scripted interaction suite (screenshots)
```

Both use `puppeteer-core` with the system Chrome and SwiftShader (no GPU needed).
# Airsense
# Airsense
# Airsense
# datavizair
# datavizair
