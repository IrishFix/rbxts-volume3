# @rbxts/volume3

[![Documentation](https://img.shields.io/badge/docs-online-blue)](https://irishfix.github.io/rbxts-volume3/)

Roblox-ts library for convex-hull volumes with evented enter/leave detection and object tracking. Define arbitrary 3D shapes from vertices or boxes, hook signals for parts/models entering or leaving, and keep volumes up to date with live object trackers.

## Features
- Create volumes from vertices, boxes (`FromBox`, `FromAABB`, `FromRegion3`), extruded planes (`FromPlaneXY/XZ/YZ`), or object trackers.
- Track arbitrary models, parts, or attachments with `ObjectTracker` (point or full box vertices; low/high precision).
- Signals: `AnyEntered`, `AnyLeft`, `PartEntered`, `PartLeft`, `ModelEntered`, `ModelLeft`.
- Awareness helpers: `TryMakeAware`, `TryForget`, `IsAwareOf`, `AwareInside`, `GetAwareInside`.
- Configurable query modes: `ModelQueryMode` (Any/All/Primary) and `PartQueryMode` (Point/Box).
- Optional debug drawing for hull faces/edges (see TSDoc on debug helpers).

## Documentation
Full API documentation: **[https://irishfix.github.io/rbxts-volume3/](https://irishfix.github.io/rbxts-volume3/)**

## Installation
```sh
npm install @rbxts/volume3
```

## Quick start
```ts
import { Volume3, ObjectTracker } from "@rbxts/volume3";

// Build a box volume at a CFrame with size
const volume = Volume3.FromBox(new CFrame(0, 10, 0), new Vector3(20, 10, 20));
volume.SetPartQueryMode(Volume3.PartQueryMode.Box);
volume.SetModelQueryMode(Volume3.ModelQueryMode.Any);

// Subscribe to enter/leave signals
volume.AnyEntered.Connect((thing) => print(`${thing.Name} entered`));
volume.AnyLeft.Connect((thing) => print(`${thing.Name} left`));

// Register things to track (Models/BaseParts) and start listening
for (const part of Workspace.GetDescendants().filter(isBasePart)) {
	volume.TryMakeAware(part);
}
volume.BeginListening(); // hooks RunService.PostSimulation

// Track a moving object and feed its vertices into the hull
const tracker = new ObjectTracker(somePart, Volume3.ObjectTrackerMode.Box, Volume3.ObjectTrackerPrecision.High, true);
const trackerVolume = Volume3.FromObjectTrackers([tracker]);
trackerVolume.BeginListening();
```

## API hints
- Creation: `FromVertices`, `FromBox`, `FromAABB`, `FromRegion3`, `FromPlaneXY/XZ/YZ`, `FromObjectTrackers`.
- Control queries: `SetModelQueryMode` / `GetModelQueryMode`, `SetPartQueryMode` / `GetPartQueryMode`.
- Awareness lifecycle: `TryMakeAware(thing, automaticallyForget?)`, `TryForget(thing)`, `IsAwareOf`, `AwareInside`, `GetAwareInside`.
- Looping: `BeginListening()` / `StopListening()` to hook/unhook the per-frame query.
- Debug: enable/disable/debug draw helpers via the `Debug` methods (see TSDoc for details).
