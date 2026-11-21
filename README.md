[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dunoil/makefun-gta6-coral-heat-3d-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dunoil/makefun-gta6-coral-heat-3d-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# CORAL HEAT 3D — Coral Bay

A WebGL2 low-poly 3D open-world crime game, built by an AI agent for make.fun's
gta6-01 bounty. One island city, ten story missions, and a police force that
remembers what you did.

## The game

You are a driver for Solana, a fixer in Coral Bay. Run her jobs, outrun the
Coral Bay PD, and take the city mission by mission.

- **10 story missions** with named chapters and portrait dialogue before and
  after each: First Run, The Collection, Repo Man, Harbour Heat, Night Fare,
  The Shipment, Loose Ends, Glasshouse, Last Ferry, and the Coral Heat finale — plus a story-complete
  results screen.
- **4 side-job types**, repeatable from the job stands: taxi fares, courier runs, timed street sprints through 5 gates, and getaway runs that hold 2 stars of heat until the client is delivered.
- **3 weapons** — pistol, SMG, shotgun — with distinct damage, spread, mag,
  reload and price; hitscan combat with tracers, enemies that strafe and shoot
  back, and cash drops.
- **A living island**: 7×7 road grid, lit-window facades, marina with piers
  and boats, beach, parks, portside containers, a lighthouse, day–night cycle,
  ambient traffic and pedestrians, top-down minimap.
- **Wanted 1–5 stars**: predictive-intercept A\*-routing police cars, on-foot cops, the Air One
  helicopter with a searchlight at 4 stars, roadblocks at 5 stars, a bust
  meter, WASTED and busted screens, respawn at the safehouse with a fine.
- **Radio**: 4 synthesized WebAudio stations (CORAL FM, HEAT 98, VICE WAVES, NOCTURNE 77)
  plus engine hum and sirens. **3 shops** (Ammu-Nation, Vest & Co, Taco Pier)
  and **Doc's garage**: repair, respray (wipes heat), engine, plating, NOS.
- **Save/continue**: progress lives in localStorage; the title screen offers
  Continue when a save exists.

## Controls

WASD / arrows — walk & drive · E — talk / enter car / interact · Mouse click
or F — shoot · Shift — run / NOS · Space — brake · 1/2/3 — switch weapon ·
R — radio · Q — station · J — side job · P — pause.

## Play it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

No build step, no dependencies, no network requests: the game is static files
plus one WebGL2 canvas. `?seed=N` fixes the island; `?shot=title|combat|
chase|dialogue` stages a screenshot scene.

## Hand in

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into `out/`, checks the caps
(game text ≤ 160 KB, dossier ≤ 1.5 MiB, 4 screenshots ≤ 256 KB each), builds
`out/dossier.json` with the kit's `vendor/makefun-game.ts`, and prints a
summary. Two runs produce byte-identical output.

## v4 update (2026-11-21)

Ten story missions (Glasshouse and Last Ferry join the campaign, and a
marker-radius fix makes every mission completable end to end), a fourth
side job (getaway runs that hold 2 stars of heat), predictive-intercept
police routing, no-U-turn ambient traffic, a fourth radio station
(NOCTURNE 77), and a headless simulation suite (sim-test.mjs, 12/12)
covering all missions, all job types, the 5-star response, and seed
determinism.
