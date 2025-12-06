import { RunService, Workspace } from "@rbxts/services";
import { Connection, Signal } from "@rbxts/beacon";

export type ModelQueryMode = (typeof Volume3.ModelQueryMode)[keyof typeof Volume3.ModelQueryMode];
export type PartQueryMode = (typeof Volume3.PartQueryMode)[keyof typeof Volume3.PartQueryMode];
export type ObjectTrackerMode = (typeof Volume3.ObjectTrackerMode)[keyof typeof Volume3.ObjectTrackerMode];
export type ObjectTrackerPrecision = (typeof Volume3.ObjectTrackerPrecision)[keyof typeof Volume3.ObjectTrackerPrecision];

/**
 * The `ObjectTracker` class is used to track the position(s) of a given `Object` ( `Model`, `BasePart`, or `Attachment` ) for use within a `Volume3`.
 * @public
 * @class
 * @see {@linkcode Volume3}
 */
export class ObjectTracker {
	/**
	 * The signal that is fired upon any live update detected to the target `Object`. If the `ObjectTracker` is not live, this signal will never fire.
	 * @public
	 * @readonly
	 */
	public readonly LiveUpdate: Signal<void> = new Signal;

	/**
	 * The signal that is fired when this `ObjectTracker` is destroyed, either manually called through `.Destroy()`, or when the target `Object` is destroyed.
	 * @public
	 * @readonly
	 * @see {@linkcode ObjectTracker.Destroy}
	 */
	public readonly Destroyed: Signal<void> = new Signal;

	/**
	 * The target `Object` this `ObjectTracker` is based around.
	 * @public
	 * @readonly
	 */
	public readonly Object: Model | BasePart | Attachment;

	/**
	 * The `ObjectTrackerMode` that changes how this `ObjectTracker` treats the updates and resulting `Positions` gathered from the target `Object`.
	 * @public
	 * @readonly
	 * @see {@linkcode Volume3.ObjectTrackerMode}
	 */
	public readonly Mode: ObjectTrackerMode;

	/**
	 * The `ObjectTrackerPrecision` that decides what level of recalculation should be done upon a `LiveUpdate` from this `ObjectTracker`.
	 * @public
	 * @see {@linkcode Volume3.ObjectTrackerPrecision}
	 */
	public Precision: ObjectTrackerPrecision;

	/**
	 * The current list of `Vector3`(s) that make up all points gathered from the target `Object` with respects to the active `ObjectTrackerMode`.
	 * @public
	 * @readonly
	 * @see {@linkcode Volume3.ObjectTrackerMode}
	 */
	public readonly Positions: Vector3[];

	/**
	 * The currently connected `RBXScriptConnection` signal(s).
	 * @private
	 */
	private _activeSignals: RBXScriptConnection[] = [];

	/**
	 * Updates this `ObjectTracker`(s) `Positions` based on the passed `object`. Used to type extract position updates for only `Model` targets.
	 * @private
	 * @param object The given `Instance` to update `Positions` from.
	 */
	private _modelUpdatePosition(object: Model) {
		const [cf, size] = object.GetBoundingBox();

		if (this.Mode === Volume3.ObjectTrackerMode.Point) {
			this.Positions[0] = cf.Position;
		} else {
			const extents = size.div(2);
			const offsets = [
				new Vector3(-extents.X, -extents.Y, -extents.Z),
				new Vector3(-extents.X, -extents.Y,  extents.Z),
				new Vector3(-extents.X,  extents.Y, -extents.Z),
				new Vector3(-extents.X,  extents.Y,  extents.Z),
				new Vector3( extents.X, -extents.Y, -extents.Z),
				new Vector3( extents.X, -extents.Y,  extents.Z),
				new Vector3( extents.X,  extents.Y, -extents.Z),
				new Vector3( extents.X,  extents.Y,  extents.Z)
			];

			for (let i = 0; i < offsets.size(); i++) {
				this.Positions[i] = cf.mul(offsets[i]);
			}
		}

		this.LiveUpdate.Fire();
	}

	/**
	 * Updates this `ObjectTracker`(s) `Positions` based on the passed `object`. Used to type extract position updates for only `BasePart` targets.
	 * @private
	 * @param object The given `Instance` to update `Positions` from.
	 */
	private _partUpdatePosition(object: BasePart) {
		if (this.Mode === Volume3.ObjectTrackerMode.Point) {
			this.Positions[0] = object.CFrame.Position;
		} else {
			const extents = object.Size.div(2);
			const offsets = [
				new Vector3(-extents.X, -extents.Y, -extents.Z),
				new Vector3(-extents.X, -extents.Y,  extents.Z),
				new Vector3(-extents.X,  extents.Y, -extents.Z),
				new Vector3(-extents.X,  extents.Y,  extents.Z),
				new Vector3( extents.X, -extents.Y, -extents.Z),
				new Vector3( extents.X, -extents.Y,  extents.Z),
				new Vector3( extents.X,  extents.Y, -extents.Z),
				new Vector3( extents.X,  extents.Y,  extents.Z)
			];

			for (let i = 0; i < offsets.size(); i++) {
				this.Positions[i] = object.CFrame.mul(offsets[i]);
			}
		}

		this.LiveUpdate.Fire();
	}

	/**
	 * Updates this `ObjectTracker`(s) `Positions` based on the passed `object`. Used to type extract position updates for only `Attachment` targets.
	 * @private
	 * @param object The given `Instance` to update `Positions` from.
	 */
	private _attachmentUpdatePosition(object: Attachment) {
		if (this.Mode === Volume3.ObjectTrackerMode.Point) {
			this.Positions[0] = object.WorldCFrame.Position;
		} else {
			error("Cannot use Box mode for Attachment ObjectTracker.");
		}

		this.LiveUpdate.Fire();
	}

	/**
	 * Destroys this `ObjectTracker`, disconnecting any active signals, and notifying any connected `Volume3`(s) to clear references to this `ObjectTracker`.
	 * @public
	 */
	public Destroy() {
		this.Destroyed.Fire();
		for (const sig of this._activeSignals) {
			sig.Disconnect();
		}
		this._activeSignals.clear();
		this.LiveUpdate.Destroy();
		this.Destroyed.Destroy();
	}

	/**
	 * Creates a new `ObjectTracker`.
	 * @public
	 * @param object The given `Instance` to track.
	 * @param mode The `ObjectTrackerMode` defining what points from the passed `object` should be tracked.
	 * @param precision The `ObjectTrackerPrecision` defining (when `live`) if the full `Volume3` bounds should be recalculated when this tracker detects an update.
	 * @param live If this `ObjectTracker` should update dynamically when the target `object` moves, if false, it will calculate the `Positions` only once.
	 * @returns The created `ObjectTracker`.
	 */
	public constructor(object: Model | BasePart | Attachment, mode: ObjectTrackerMode, precision: ObjectTrackerPrecision, live: boolean) {
		this.Object = object;
		this.Mode = mode;
		this.Precision = precision;

		if (mode === Volume3.ObjectTrackerMode.Point) {
			this.Positions = [Vector3.zero];
		} else {
			this.Positions = [Vector3.zero, Vector3.zero, Vector3.zero, Vector3.zero, Vector3.zero, Vector3.zero, Vector3.zero, Vector3.zero];
		}
		
		if (object.IsA("Model")) {
			if (live) {
				if (!object.PrimaryPart) {
					error(`Cannot create a live-updating ObjectTracker for Model '${object.Name}' without a PrimaryPart set.`);
				}

				const primaryPartSignals: RBXScriptConnection[] = [];

				if (mode === Volume3.ObjectTrackerMode.Point) {
					const sig = object.PrimaryPart.GetPropertyChangedSignal("Position").Connect(() => this._modelUpdatePosition(object));
					primaryPartSignals.push(sig);
					this._activeSignals.push(sig);
				} else if (mode === Volume3.ObjectTrackerMode.Box) {
					const sig = object.PrimaryPart.GetPropertyChangedSignal("CFrame").Connect(() => this._modelUpdatePosition(object));
					primaryPartSignals.push(sig);
					this._activeSignals.push(sig);
				}
				const sizeSig = object.PrimaryPart.GetPropertyChangedSignal("Size").Connect(() => this._modelUpdatePosition(object));
				primaryPartSignals.push(sizeSig);
				this._activeSignals.push(sizeSig);

				object.DescendantAdded.Connect(() => this._modelUpdatePosition(object));
				object.DescendantRemoving.Connect(() => this._modelUpdatePosition(object));

				object.GetPropertyChangedSignal("PrimaryPart").Connect(() => {
					for (const sig of primaryPartSignals) {
						sig.Disconnect();

						const index = this._activeSignals.indexOf(sig);
						if (index !== -1) {
							this._activeSignals.remove(index);
						}
					}
					primaryPartSignals.clear();
					if (object.PrimaryPart && object.PrimaryPart.IsA("BasePart")) {
						if (mode === Volume3.ObjectTrackerMode.Point) {
							const sig = object.PrimaryPart.GetPropertyChangedSignal("Position").Connect(() => this._modelUpdatePosition(object));
							primaryPartSignals.push(sig);
							this._activeSignals.push(sig);
						} else if (mode === Volume3.ObjectTrackerMode.Box) {
							const sig = object.PrimaryPart.GetPropertyChangedSignal("CFrame").Connect(() => this._modelUpdatePosition(object));
							primaryPartSignals.push(sig);
							this._activeSignals.push(sig);
						}
						const sizeSig = object.PrimaryPart.GetPropertyChangedSignal("Size").Connect(() => this._modelUpdatePosition(object));
						primaryPartSignals.push(sizeSig);
						this._activeSignals.push(sizeSig);
					}
				});

				object.Destroying.Connect(() => this.Destroy());
			}
			this._modelUpdatePosition(object);
		} else if (object.IsA("BasePart")) {
			if (live) {
				if (mode === Volume3.ObjectTrackerMode.Point) {
					const sig = object.GetPropertyChangedSignal("Position").Connect(() => this._partUpdatePosition(object));
					this._activeSignals.push(sig);
				} else if (mode === Volume3.ObjectTrackerMode.Box) {
					const sig = object.GetPropertyChangedSignal("CFrame").Connect(() => this._partUpdatePosition(object));
					this._activeSignals.push(sig);
				}
				const sizeSig = object.GetPropertyChangedSignal("Size").Connect(() => this._partUpdatePosition(object));
				this._activeSignals.push(sizeSig);
				object.Destroying.Connect(() => this.Destroy());
			}
			this._partUpdatePosition(object);
		} else if (object.IsA("Attachment")) {
			if (live) {
				if (!object.Parent || !object.Parent.IsA("BasePart")) {
					error(`Cannot create a live-updating ObjectTracker for Attachment '${object.Name}' without a Parent set.`);
				}

				if (mode === Volume3.ObjectTrackerMode.Point) {
					const sig = object.GetPropertyChangedSignal("WorldPosition").Connect(() => this._attachmentUpdatePosition(object));
					this._activeSignals.push(sig);
				} else if (mode === Volume3.ObjectTrackerMode.Box) {
					error("Cannot use Box mode for Attachment ObjectTracker.");
				}
				let parentSizeSignal = object.Parent.GetPropertyChangedSignal("Size").Connect(() => this._attachmentUpdatePosition(object));
				this._activeSignals.push(parentSizeSignal);
				object.GetPropertyChangedSignal("Parent").Connect(() => {
					parentSizeSignal.Disconnect();
					const index = this._activeSignals.indexOf(parentSizeSignal);
					if (index !== -1) {
						this._activeSignals.remove(index);
					}
					if (object.Parent && object.Parent.IsA("BasePart")) {
						parentSizeSignal = object.Parent.GetPropertyChangedSignal("Size").Connect(() => this._attachmentUpdatePosition(object));
						this._activeSignals.push(parentSizeSignal);
						this._attachmentUpdatePosition(object);
					}
				});
				object.Destroying.Connect(() => this.Destroy());
			}
			this._attachmentUpdatePosition(object);
		}
	}
}

/**
 * The `Volume3` class is used to represent a 3D volume in space defined by a set of vertices or tracked objects, allowing for efficient querying of `Model`(s) and `BasePart`(s) entering and leaving the volume.
 * @public
 * @class
 * @see {@linkcode ObjectTracker}
 */
export class Volume3 {
	static ObjectTracker = ObjectTracker;

    /** 
     * Enum used to represent how a given `Volume3` should query against any given `Model`.
	 * @static
     * @readonly
     * @enum {string}
	 * @see {@linkcode Volume3}
	 * @see {@linkcode Volume3.SetModelQueryMode}
	 * @see {@linkcode Volume3.GetModelQueryMode}
     */
    static ModelQueryMode = {
		/** Any `Volume3` using `ModelQueryMode.Any` will consider any given `Model` entered / inside if any descendant `BasePart` meets the current `PartQueryMode` requirements. 
		*/
        Any: 1,
		/** Any `Volume3` using `ModelQueryMode.All` will only consider any given `Model` entered / inside if ALL of its descendant `BasePart`(s) meets the current `PartQueryMode` requirements. 
		*/
        All: 2,
		/** Any `Volume3` using `ModelQueryMode.Primary` will only consider any given `Model` entered / inside if its `PrimaryPart` meets the current `PartQueryMode` requirements.
		 */
        Primary: 3
    } as const;

	/** 
     * Enum used to represent how a given `Volume3` should query against any given `BasePart`.
	 * @static
     * @readonly
     * @enum {string}
	 * @see {@linkcode Volume3}
	 * @see {@linkcode Volume3.SetPartQueryMode}
	 * @see {@linkcode Volume3.GetPartQueryMode}
     */
	static PartQueryMode = {
		/** Any `Volume3` using `PartQueryMode.Point` will only consider any given `BasePart` entered / inside if the volume contains the center point. 
		*/
        Point: 1,
		/** Any `Volume3` using `PartQueryMode.Box` will consider any given `BasePart` entered / inside if the volume overlaps or contains it in any way. 
		*/
        Box: 2
    } as const;

	/** 
     * Enum used to represent what points an `ObjectTracker` should gather from its target `Object`.
	 * @static
     * @readonly
     * @enum {string}
	 * @see {@linkcode ObjectTracker}
     */
	static ObjectTrackerMode = {
		/** Any `ObjectTracker` using `ObjectTrackerMode.Point` will only track and update using the center point of the tracked object or its bounds, effectively ignoring rotation,
		 *  and acting as a single vertex for any containing `Volume3`(s) 
		 */
        Point: 1,
		/** Any `ObjectTracker` using `ObjectTrackerMode.Box` will track and update using all 8 corner points of the tracked object or its bounds, taking into account rotation,
		 *  and acting as a cloud of vertices for any containing `Volume3`(s) 
		 */
        Box: 2
    } as const;

	/** 
     * Enum used to represent how a `Volume3` should recalculate its bounds when an `ObjectTracker` it contains fires its `LiveUpdate`.
	 * @static
     * @readonly
     * @enum {string}
	 * @see {@linkcode Volume3}
	 * @see {@linkcode ObjectTracker}
     */
	static ObjectTrackerPrecision = {
		/**	Any `Volume3` containing an `ObjectTracker` using `ObjectTrackerPrecision.Low` should only update positions, and never recalculate its true bounds.
		 *  This is useful for large numbers of trackers where performance is more important than accuracy, or when all tracked objects are guaranteed to move at the same time in the same way.
		 *  e.g. all `ObjectTracker`(s) are tracking objects connected to the same assembly.
		 */
		Low: 1,
		/** Any `Volume3` containing an `ObjectTracker` using `ObjectTrackerPrecision.High` should recalculate its true bounds upon receiving a `LiveUpdate`.
		 * 	This is useful for when accuracy is more important than performance, or when tracked objects in the same `Volume3` move or rotate independently of one another.
		 * 	e.g. `ObjectTracker`(s) are tracking objects that move each based on their own assembly or system.
		 */
		High: 2
	} as const;

	/** 
	 * The `Signal` that is fired upon any `BasePart` or `Model` ( that this `Volume3` is aware of ) entering the volume.
	 * @event
	 * @public
	 * @readonly
	 * @param thing The `BasePart` or `Model` that has entered the volume.
	 * @see {@linkcode Volume3.TryMakeAware}
	 * @see {@linkcode Volume3.TryForget}
	 */
	public readonly AnyEntered: Signal<[thing: BasePart | Model]> = new Signal;

	/** 
	 * The `Signal` that is fired upon any `BasePart` or `Model` ( that this `Volume3` is aware of ) leaving the volume.
	 * @event
	 * @public
	 * @readonly
	 * @param thing The `BasePart` or `Model` that has left the volume.
	 * @see {@linkcode Volume3.TryMakeAware}
	 * @see {@linkcode Volume3.TryForget}
	 */
	public readonly AnyLeft: Signal<[thing: BasePart | Model]> = new Signal;

	/** 
	 * The `Signal` that is fired upon any `BasePart` ( that this `Volume3` is aware of ) entering the volume.
	 * @event
	 * @public
	 * @readonly
	 * @param thing The `BasePart` that has entered the volume.
	 * @see {@linkcode Volume3.TryMakeAware}
	 * @see {@linkcode Volume3.TryForget}
	 */
	public readonly PartEntered: Signal<[thing: BasePart]> = new Signal;

	/** 
	 * The `Signal` that is fired upon any `BasePart` ( that this `Volume3` is aware of ) leaving the volume.
	 * @event
	 * @public
	 * @readonly
	 * @param thing The `BasePart` that has left the volume.
	 * @see {@linkcode Volume3.TryMakeAware}
	 * @see {@linkcode Volume3.TryForget}
	 */
	public readonly PartLeft: Signal<[thing: BasePart]> = new Signal;

	/** 
	 * The `Signal` that is fired upon any `Model` ( that this `Volume3` is aware of ) entering the volume.
	 * @event
	 * @public
	 * @readonly
	 * @param thing The `Model` that has entered the volume.
	 * @see {@linkcode Volume3.TryMakeAware}
	 * @see {@linkcode Volume3.TryForget}
	 */
	public readonly ModelEntered: Signal<[thing: Model]> = new Signal;

	/** 
	 * The `Signal` that is fired upon any `Model` ( that this `Volume3` is aware of ) leaving the volume.
	 * @event
	 * @public
	 * @readonly
	 * @param thing The `Model` that has left the volume.
	 * @see {@linkcode Volume3.TryMakeAware}
	 * @see {@linkcode Volume3.TryForget}
	 */
	public readonly ModelLeft: Signal<[thing: Model]> = new Signal;

	/**
	 * The current `ModelQueryMode` defining how this `Volume3` queries against any given `Model`.
	 * @private
	 * @see {@linkcode Volume3.ModelQueryMode}
	 */
	private _modelQueryMode: ModelQueryMode = Volume3.ModelQueryMode.Any;

	/**
	 * The current `PartQueryMode` defining how this `Volume3` queries against any given `BasePart`.
	 * @private
	 * @see {@linkcode Volume3.PartQueryMode}
	 */
	private _partQueryMode: PartQueryMode = Volume3.PartQueryMode.Box;

	/**
	 * Map of all `Model`(s) and `BasePart`(s) that this `Volume3` is currently aware of, and their last known inside / outside state stored as a `boolean`.
	 * @private
	 * @see {@linkcode Volume3.TryMakeAware}
	 * @see {@linkcode Volume3.TryForget}
	 */
	private _awareOf: Map<Model | BasePart, boolean> = new Map;

	/**
	 * The list of vertices that make up this `Volume3`.
	 * @private
	 */
	private _vertices: Vector3[];

	/**
	 * The list of trackers that make up this `Volume3`.
	 * @private
	 * @see {@linkcode ObjectTracker}
	 */
	private _trackers: (ObjectTracker|number)[];

	/**
	 * The list of faces that make up this `Volume3`, stored as pairs of 3 indices into `_vertices`.
	 * @private
	 * @see `_vertices`
	 */
	private _faces: Array<[number, number, number]>;

	/**
	 * The list of edges that make up this `Volume3`, stored as pairs of 2 indices into `_vertices`.
	 * @private
	 * @see `_vertices`
	 */
	private _edges: Array<[number, number]>;

	/**
	 * The list of normals that make up this `Volume3`, stored 1-to-1 in size and indexing with `_faces`.
	 * @private
	 * @see `_faces`
	 */
	private _normals: Vector3[];

	/**
	 * The calculated center of this `Volume3`.
	 * @private
	 */
	private _center: Vector3;

	/**
	 * If this `Volume3` is currently displaying or storing anything from `_debugParts`.
	 * @private
	 * @see {@linkcode Volume3.SetVisibility}
	 */
	private _visible: boolean = false;

	/**
	 * The list of currently instantiated debug `BasePart`(s) that make up a visual set of faces for debug purposes.
	 * @private
	 * @see {@linkcode Volume3.SetVisibility}
	 */
	private _debugParts: BasePart[] = [];

	/**
	 * The list of currently active `RBXScriptConnection`(s) for this `Volume3`, tracking when anything it is aware of is destroyed. ( only if `automaticallyForget` was passed as `true` when `Volume3.TryMakeAware()` was called. )
	 * @private
	 * @see {@linkcode Volume3.TryMakeAware}
	 */
	private _destroyConnections: RBXScriptConnection[] = [];

	/**
	 * The list of currently active `Connection`(s) for this `Volume3`, tracking when anything is called from any contained `ObjectTracker`(s) `LiveUpdate` or `Destroyed` signal(s).
	 * @private
	 * @see {@linkcode ObjectTracker}
	 * @see {@linkcode ObjectTracker.LiveUpdate}
	 * @see {@linkcode ObjectTracker.Destroyed}
	 */
	private _trackerConnections: Connection<void>[] = [];

	/**
	 * The currently active `RBXScriptConnection` for this `Volume3`, tracking the `RunService.PostSimulation` to perform queries each frame. ( only exists if currently `Listening`. )
	 * @private
	 * @see {@linkcode Volume3.BeginListening}
	 * @see {@linkcode Volume3.StopListening}
	 */
	private _queryConnection?: RBXScriptConnection;

	/**
	 * Creates a new `Volume3` from a list of vertices.
	 * @public
	 * @static
	 * @param vertices The list of `Vector3`(s) that make up the volume.
	 * @returns The created `Volume3`.
	 */
	public static FromVertices(vertices: Vector3[]): Volume3 {
		return new Volume3(vertices);
	}

	/**
	 * Creates a new `Volume3` from an existing `Region3`.
	 * @public
	 * @static
	 * @param region The `Region3` to create the volume from.
	 * @returns The created `Volume3`.
	 * @see {@linkcode Volume3.FromBox} for a more generalized and efficient method of creating a box-shaped `Volume3`.
	 * @see {@linkcode Volume3.FromAABB} for creating an axis-aligned box-shaped `Volume3`.
	 */
	public static FromRegion3(region: Region3) {
		return this.FromBox(region.CFrame, region.Size);
	}

	/**
	 * Creates a new `Volume3` from a box defined by a `CFrame` and `Vector3` size.
	 * @public
	 * @static
	 * @param cf The `CFrame` defining the center and rotation of the box.
	 * @param size The `Vector3` defining the size of the box.
	 * @returns The created `Volume3`.
	 */
	public static FromBox(cf: CFrame, size: Vector3): Volume3 {
		const extents = size.div(2);
		const offsets = [
			new Vector3(-extents.X, -extents.Y, -extents.Z),
			new Vector3(-extents.X, -extents.Y,  extents.Z),
			new Vector3(-extents.X,  extents.Y, -extents.Z),
			new Vector3(-extents.X,  extents.Y,  extents.Z),
			new Vector3( extents.X, -extents.Y, -extents.Z),
			new Vector3( extents.X, -extents.Y,  extents.Z),
			new Vector3( extents.X,  extents.Y, -extents.Z),
			new Vector3( extents.X,  extents.Y,  extents.Z)
		];
		return new Volume3(offsets.map(offset => cf.mul(offset)));
	}

	/**
	 * Creates a new `Volume3` from an axis-aligned box defined by a position and `Vector3` size.
	 * @public
	 * @static
	 * @param position The `Vector3` defining the center position of the box.
	 * @param size The `Vector3` defining the size of the box.
	 * @returns The created `Volume3`.
	 */
	public static FromAABB(position: Vector3, size: Vector3): Volume3 {
		const extents = size.div(2);
		const offsets = [
			new Vector3(-extents.X, -extents.Y, -extents.Z),
			new Vector3(-extents.X, -extents.Y,  extents.Z),
			new Vector3(-extents.X,  extents.Y, -extents.Z),
			new Vector3(-extents.X,  extents.Y,  extents.Z),
			new Vector3( extents.X, -extents.Y, -extents.Z),
			new Vector3( extents.X, -extents.Y,  extents.Z),
			new Vector3( extents.X,  extents.Y, -extents.Z),
			new Vector3( extents.X,  extents.Y,  extents.Z)
		];
		return new Volume3(offsets.map(offset => position.add(offset)));
	}

	/**
	 * Creates a new `Volume3` from a plane defined by 4 corner vertices and a height to extrude.
	 * @public
	 * @static
	 * @param vertices The list of 4 or more `Vector3`(s) that make up the corners of the plane.
	 * @param height The height to extrude the plane upwards along the Y axis.
	 * @returns The created `Volume3`.
	 */
	public static FromPlaneXZ(vertices: Vector3[], height: number) {
		if (vertices.size() <= 4) {
			error("Cannot create a Volume3 without 4 vertices (corners) defined for the plane.");
		}
		const extend = Vector3.yAxis.mul(height);
		const heightDenoters = vertices.map(vertex => vertex.add(extend));
		return new Volume3([...vertices, ...heightDenoters]);
	}

	/**
	 * Creates a new `Volume3` from a plane defined by 4 corner vertices and a width to extrude.
	 * @public
	 * @static
	 * @param vertices The list of 4 or more `Vector3`(s) that make up the corners of the plane.
	 * @param width The width to extrude the plane along the X axis.
	 * @returns The created `Volume3`.
	 */
	public static FromPlaneYZ(vertices: Vector3[], width: number) {
		if (vertices.size() <= 4) {
			error("Cannot create a Volume3 without 4 vertices (corners) defined for the plane.");
		}
		const extend = Vector3.xAxis.mul(width);
		const heightDenoters = vertices.map(vertex => vertex.add(extend));
		return new Volume3([...vertices, ...heightDenoters]);
	}

	/**
	 * Creates a new `Volume3` from a plane defined by 4 corner vertices and a depth to extrude.
	 * @public
	 * @static
	 * @param vertices The list of 4 or more `Vector3`(s) that make up the corners of the plane.
	 * @param depth The depth to extrude the plane along the Z axis.
	 * @returns The created `Volume3`.
	 */
	public static FromPlaneXY(vertices: Vector3[], depth: number) {
		if (vertices.size() <= 4) {
			error("Cannot create a Volume3 without 4 vertices (corners) defined for the plane.");
		}
		const extend = Vector3.zAxis.mul(depth);
		const heightDenoters = vertices.map(vertex => vertex.add(extend));
		return new Volume3([...vertices, ...heightDenoters]);
	}

	/**
	 * Creates a new `Volume3` from a list of `ObjectTracker`(s).
	 * @public
	 * @static
	 * @param trackers The list of `ObjectTracker`(s) that make up the volume.
	 * @returns The created `Volume3`.
	 */
	public static FromObjectTrackers(trackers: ObjectTracker[]) {
		const allPositions: Vector3[] = [];
		for (const tracker of trackers) {
			const start = allPositions.size();
			const count = tracker.Positions.size();
			for (let i = 0; i < count; i++) {
				allPositions.push(tracker.Positions[i]);
			}
		}
		return new Volume3(allPositions, trackers);
	}

	/**
	 * Creates a new `Volume3` from a list of vertices and optional `ObjectTracker`(s).
	 * @public
	 * @param vertices The list of `Vector3`(s) that make up the volume.
	 * @param trackers The optional list of `ObjectTracker`(s) that make up the volume.
	 * @returns The created `Volume3`.
	 */
	protected constructor(vertices: Vector3[], trackers?: ObjectTracker[]) {
		this._vertices = vertices;
		this._trackers = trackers ? trackers : [];
		this._faces = [];
		this._edges = [];
		this._normals = [];
		this._center = Vector3.zero;

		if (trackers) {
			let currentStart = 0;
			for (let index = 0; index < this._trackers.size(); index++) {
				const tracker = this._trackers[index];
				const start = currentStart;
				const count = typeIs(tracker, "number") ? tracker as number : (tracker as ObjectTracker).Positions.size();
				currentStart += count;
				if (typeIs(tracker, "number")) continue;
				const trackerUpdate = tracker.LiveUpdate.Connect(() => {
					for (let i = 0; i < count; i++) {
						this._vertices[start + i] = tracker.Positions[i];
					}
					if (tracker.Precision === Volume3.ObjectTrackerPrecision.Low) {
						this._recalculateInternals();
					} else {
						this._recalculateInternals(true);
					}
					this._recalculateDebug(true);
				});
				const trackerDestroyed = tracker.Destroyed.Connect(() => {
					this._trackers[index] = count;

					trackerUpdate.Disconnect();
					trackerDestroyed.Disconnect();

					const updateIndex = this._trackerConnections.indexOf(trackerUpdate);
					const destroyIndex = this._trackerConnections.indexOf(trackerDestroyed);

					if (updateIndex !== -1) {
						this._trackerConnections.remove(updateIndex);
					}

					if (destroyIndex !== -1) {
						this._trackerConnections.remove(destroyIndex);
					}
				});

				this._trackerConnections.push(trackerUpdate, trackerDestroyed);
			}
		}

		this._recalculateInternals(true);
		this._recalculateDebug(true);
	}

	/**
	 * Sets the current `ModelQueryMode` defining how this `Volume3` queries against any given `Model`.
	 * @public
	 * @param mode The `ModelQueryMode` to set.
	 */
	public SetModelQueryMode(mode: ModelQueryMode) {
		this._modelQueryMode = mode;
	}

	/**
	 * Gets the current `ModelQueryMode` defining how this `Volume3` queries against any given `Model`.
	 * @public
	 * @returns The current `ModelQueryMode`.
	 */
	public GetModelQueryMode(): ModelQueryMode {
		return this._modelQueryMode;
	}

	/**
	 * Sets the current `PartQueryMode` defining how this `Volume3` queries against any given `BasePart`.
	 * @public
	 * @param mode The `PartQueryMode` to set.
	 */
	public SetPartQueryMode(mode: PartQueryMode) {
		this._partQueryMode = mode;
	}

	/**
	 * Gets the current `PartQueryMode` defining how this `Volume3` queries against any given `BasePart`.
	 * @public
	 * @returns The current `PartQueryMode`.
	 */
	public GetPartQueryMode(): PartQueryMode {
		return this._partQueryMode;
	}

	/**
	 * Begins listening for updates to this `Volume3`, attaching a query to the `RunService.PostSimulation` event.
	 * @public
	 */
	public BeginListening() {
		if (!this._queryConnection) {
			this._queryConnection = RunService.PostSimulation.Connect(() => this._query());
		}
	}
	
	/**
	 * Stops listening for updates to this `Volume3`, disconnecting from the `RunService.PostSimulation` event.
	 * @public
	 */
	public StopListening() {
		if (this._queryConnection) {
			this._queryConnection.Disconnect();
			this._queryConnection = undefined;
		}
	}

	/**
	 * Sets the visibility, creation and destruction of the debug parts for this `Volume3`.
	 * @public
	 * @param visible Whether the debug parts should exist.
	 */
	public SetVisibility(visible: boolean) {
		this._visible = visible;
		this._recalculateDebug();
	}

	/**
	 * Clears all awareness of objects within this `Volume3`.
	 * @public
	 */
	public ClearAware() {
		this._awareOf = new Map;
		for (const destroyConnection of this._destroyConnections) {
			destroyConnection.Disconnect();
		}
		this._destroyConnections = [];
	}

	/**
	 * Destroys this `Volume3`, disconnecting all connections and clearing all data.
	 * @public
	 */
	public Destroy() {
		this.StopListening();
		for (const con of this._trackerConnections) {
			con.Disconnect();
		}
		this._trackerConnections.clear();
		this.ClearAware();
		for (const part of this._debugParts) {
			part.Destroy();
		}
		this.AnyEntered.Destroy();
		this.AnyLeft.Destroy();
		this.PartEntered.Destroy();
		this.PartLeft.Destroy();
		this.ModelEntered.Destroy();
		this.ModelLeft.Destroy();
		this._trackers.clear();
		this._debugParts.clear();
		this._visible = false;
		this._vertices.clear();
		this._faces.clear();
		this._edges.clear();
		this._normals.clear();
		this._center = Vector3.zero;
	}

	/**
	 * Destroys this `Volume3`, disconnecting all connections and clearing all data, including destroying all contained `ObjectTracker`(s).
	 * @public
	 */
	public DestroyAll() {
		this.StopListening();
		for (const con of this._trackerConnections) {
			con.Disconnect();
		}
		this._trackerConnections.clear();
		for (const tracker of this._trackers) {
			if (typeIs(tracker, "number")) continue;
			tracker.Destroy();
		}
		this.ClearAware();
		for (const part of this._debugParts) {
			part.Destroy();
		}
		this.AnyEntered.Destroy();
		this.AnyLeft.Destroy();
		this.PartEntered.Destroy();
		this.PartLeft.Destroy();
		this.ModelEntered.Destroy();
		this.ModelLeft.Destroy();
		this._trackers.clear();
		this._debugParts.clear();
		this._visible = false;
		this._vertices.clear();
		this._faces.clear();
		this._edges.clear();
		this._normals.clear();
		this._center = Vector3.zero;
	}

	/**
	 * Checks if this `Volume3` is aware of the given `Model` or `BasePart`.
	 * @public
	 * @param thing The `Model` or `BasePart` to check awareness for.
	 * @returns Whether this `Volume3` is aware of the given object.
	 */
	public IsAwareOf(thing: Model | BasePart): boolean {
		return this._awareOf.has(thing);
	}

	/**
	 * Attempts to make this `Volume3` aware of the given `Model` or `BasePart`.
	 * @public
	 * @param thing The `Model` or `BasePart` to become aware of.
	 * @param automaticallyForget Whether to automatically forget the object when it is destroyed. Defaults to `true`.
	 * @returns Whether the awareness was successfully added.
	 */
	public TryMakeAware(thing: Model | BasePart, automaticallyForget: boolean = true): boolean {
		if (this.IsAwareOf(thing)) {
			warn(`Duplicate awareness attempt for instance '${thing.Name}'.`);
			return false;
		}

		if (automaticallyForget) {
			const destroyConnection = thing.Destroying.Connect(() => {
				if (!this.TryForget(thing)) {
					error("Automatic TryForget call failed, possibly due to multiple awareness calls to the same instance.");
				}
			});
			this._destroyConnections.push(destroyConnection);
		}

		this._awareOf.set(thing, false);
		return true;
	}

	/** 
	 * Attempts to forget the given `Model` or `BasePart`, removing awareness.
	 * @public
	 * @param thing The `Model` or `BasePart` to forget.
	 * @returns Whether the forget was successful.
	 */
	public TryForget(thing: Model | BasePart): boolean {
		if (this.IsAwareOf(thing)) {
			this._awareOf.delete(thing);
			return true;
		} else {
			warn("Attempted to call TryForget for an object that the Volume3 was not aware of.");
			return false;
		}
	}

	/**
	 * Checks if the given `Model` or `BasePart` is inside this `Volume3` ( warns and returns `false` if not aware ).
	 * @public
	 * @param thing The `Model` or `BasePart` to check.
	 * @returns Whether the object is inside and aware.
	 */
	public AwareInside(thing: Model | BasePart): boolean {
		const inside = this._awareOf.get(thing)
		if (inside !== undefined) {
			if (this._queryConnection !== undefined) {
				return inside;
			} else {
				if (this._intersects(thing)) {
					return true;
				} else {
					return false;
				}
			}
		} else {
			warn("Attempted to call AwareInside when the Volume3 was not aware of the object, maybe you meant to call ObjectInside instead?");
			return false;
		}
	}

	/**
	 * Gets an array of all `Model` or `BasePart` instances that this `Volume3` is aware of and are inside it.
	 * @public
	 * @returns An array of objects that are inside and aware.
	 */
	public GetAwareInside(): Array<Model | BasePart> {
		const awareInside: Array<Model | BasePart> = [];
		for (const [object, inside] of this._awareOf) {
			if (inside !== undefined) {
				if (this._queryConnection !== undefined) {
					if (inside) {
						awareInside.push(object);
					}
				} else {
					if (this._intersects(object)) {
						awareInside.push(object);
					}
				}
			}
		}
		return awareInside;
	}

	/**
	 * Checks if the given `Model` or `BasePart` is inside this `Volume3`.
	 * @public
	 * @param thing The `Model` or `BasePart` to check.
	 * @returns Whether the object is inside.
	 */
	public ObjectInside(thing: Model | BasePart): boolean {
		return this._intersects(thing);
	}

	/**
	 * Draws a debug triangle using wedge parts.
	 * @private
	 * @param a The first vertex of the triangle.
	 * @param b The second vertex of the triangle.
	 * @param c The third vertex of the triangle.
	 * @returns A tuple containing two wedge parts representing the triangle.
	 */
	private _drawDebugTriangle(a: Vector3, b: Vector3, c: Vector3) {
		const ab = b.sub(a);
		const ac = c.sub(a);
		const bc = c.sub(b);

		const abd = ab.Dot(ab);
		const acd = ac.Dot(ac);
		const bcd = bc.Dot(bc);

		let p_a = a, p_b = b, p_c = c;
		if (abd > acd && abd > bcd) {
			p_c = a;
			p_a = c;
		} else if (acd > bcd && acd > abd) {
			p_a = b;
			p_b = a;
		}

		const ab_new = p_b.sub(p_a);
		const ac_new = p_c.sub(p_a);
		const bc_new = p_c.sub(p_b);

		const right = ac_new.Cross(ab_new).Unit;
		const up = bc_new.Cross(right).Unit;
		const back = bc_new.Unit;

		const height = math.abs(ab_new.Dot(up));

		const w1 = new Instance("WedgePart");
		w1.TopSurface = Enum.SurfaceType.Smooth;
		w1.BottomSurface = Enum.SurfaceType.Smooth;
		w1.Anchored = true;
		w1.CanCollide = false;
		w1.CanQuery = false;
		w1.CanTouch = false;
		w1.Transparency = 0.4;
		w1.CastShadow = false;
		w1.Color = Color3.fromRGB(0, 150, 255);
		w1.Size = new Vector3(0, height, math.abs(ab_new.Dot(back)));
		w1.CFrame = CFrame.fromMatrix(p_a.add(p_b).div(2), right, up, back);

		const w2 = new Instance("WedgePart");
		w2.TopSurface = Enum.SurfaceType.Smooth;
		w2.BottomSurface = Enum.SurfaceType.Smooth;
		w2.Anchored = true;
		w2.CanCollide = false;
		w2.CanQuery = false;
		w2.CanTouch = false;
		w2.Transparency = 0.4;
		w2.CastShadow = false;
		w2.Color = Color3.fromRGB(0, 150, 255);
		w2.Size = new Vector3(0, height, math.abs(ac_new.Dot(back)));
		w2.CFrame = CFrame.fromMatrix(p_a.add(p_c).div(2), right.mul(-1), up, back.mul(-1));

		return $tuple(w1, w2);
	}

	/**
	 * Recalculates the debug visualization of the volume.
	 * @private
	 * @param shouldRemake Whether to remake the debug parts.
	 * @param forceThrough Whether to force the recalculation through.
	 */
	private _recalculateDebug(shouldRemake: boolean = false, forceThrough: boolean = false) {
		if (!this._visible && this._debugParts.size() > 0) {
			for (const part of this._debugParts) {
				part.Destroy();
			}
			this._debugParts = [];
		}

		if (this._visible || forceThrough) {
			if (this._debugParts.size() === 0 || shouldRemake || forceThrough) {
				for (const part of this._debugParts) {
					part.Destroy();
				}
				this._debugParts = [];

				for (const [a, b, c] of this._faces) {
					const [w1, w2] = this._drawDebugTriangle(this._vertices[a], this._vertices[b], this._vertices[c]);
					if (w1 === undefined || w2 === undefined) continue;
					w1.Parent = Workspace;
					w2.Parent = Workspace;
					this._debugParts.push(w1, w2);
				}
			}
		}
	}

	/**
	 * Recalculates the internal faces, edges and normals of the volume.
	 * @private
	 * @param fullRecalculation Whether to perform a full recalculation ( defaults to `false` ).
	 */
	private _recalculateInternals(fullRecalculation: boolean = false) {
		if (fullRecalculation) {
			this._faces = [];
			this._edges = [];
			this._normals = [];

			if (this._vertices.size() < 4) {
				error("Hull needs at least 4 non-coplanar points.");
			}

			const addFace = (a: number, b: number, c: number) => {
				let normal = this._vertices[b].sub(this._vertices[a]).Cross(this._vertices[c].sub(this._vertices[a]));
				if (normal.Magnitude < 1e-9) return;

				normal = normal.Unit;
				const center = this._center;

				if (normal.Dot(this._vertices[a].sub(center)) < 0) {
					this._faces.push([a, c, b]);
					this._normals.push(normal.mul(-1));
				} else {
					this._faces.push([a, b, c]);
					this._normals.push(normal);
				}
			};

			const planeDist = (p: Vector3, a: Vector3, n: Vector3) => {
				return p.sub(a).Dot(n);
			};

			let i0 = 0;

			let i1 = 1;
			let maxD = this._vertices[i1].sub(this._vertices[i0]).Magnitude;
			for (let i = 2; i < this._vertices.size(); i++) {
				const d = this._vertices[i].sub(this._vertices[i0]).Magnitude;
				if (d > maxD) { maxD = d; i1 = i; }
			}

			let i2 = -1;
			let bestArea = -1;
			const a = this._vertices[i0], b = this._vertices[i1];
			const ab = b.sub(a);
			for (let i = 0; i < this._vertices.size(); i++) {
				if (i === i0 || i === i1) continue;
				const area = ab.Cross(this._vertices[i].sub(a)).Magnitude;
				if (area > bestArea) { bestArea = area; i2 = i; }
			}
			if (i2 === -1) error("Points are collinear.");

			let i3 = -1;
			let maxDist = -1;
			const n012 = this._vertices[i1].sub(a).Cross(this._vertices[i2].sub(a)).Unit;
			for (let i = 0; i < this._vertices.size(); i++) {
				if (i === i0 || i === i1 || i === i2) continue;
				const d = math.abs(this._vertices[i].sub(a).Dot(n012));
				if (d > maxDist) { maxDist = d; i3 = i; }
			}
			if (i3 === -1) error("Points are coplanar.");

			this._center = (this._vertices[i0].add(this._vertices[i1]).add(this._vertices[i2]).add(this._vertices[i3])).div(4);

			addFace(i0, i1, i2);
			addFace(i0, i2, i3);
			addFace(i0, i3, i1);
			addFace(i1, i3, i2);

			const EPS = 1e-6;

			for (let pIndex = 0; pIndex < this._vertices.size(); pIndex++) {
				if (pIndex === i0 || pIndex === i1 || pIndex === i2 || pIndex === i3) continue;

				const p = this._vertices[pIndex];
				const visible = new Set<number>();

				for (let f = 0; f < this._faces.size(); f++) {
					const [a, b, c] = this._faces[f];
					const n = this._normals[f];
					const dist = planeDist(p, this._vertices[a], n);

					if (dist > EPS) {
						visible.add(f);
					}
				}

				if (visible.size() === 0) continue;

				const edgeMap = new Map<string, [number, number]>();

				const processEdge = (u: number, v: number) => {
					const key = u < v ? `${u},${v}` : `${v},${u}`;
					if (edgeMap.has(key)) {
						edgeMap.delete(key);
					} else {
						edgeMap.set(key, [u, v]);
					}
				};

				visible.forEach(f => {
					const [a, b, c] = this._faces[f];
					processEdge(a, b);
					processEdge(b, c);
					processEdge(c, a);
				});

				const nf: Array<[number, number, number]> = [];
				const nn: Vector3[] = [];
				for (let f = 0; f < this._faces.size(); f++) {
					if (!visible.has(f)) {
						nf.push(this._faces[f]);
						nn.push(this._normals[f]);
					}
				}
				this._faces = nf;
				this._normals = nn;

				edgeMap.forEach(([u, v]) => {
					addFace(u, v, pIndex);
				});
			}

			const dedupe = new Set<string>();
			const addEdge = (u: number, v: number) => {
				const key = u < v ? `${u},${v}` : `${v},${u}`;
				if (!dedupe.has(key)) {
					dedupe.add(key);
					this._edges.push([u, v]);
				}
			};

			for (const [a0, b0, c0] of this._faces) {
				addEdge(a0, b0);
				addEdge(b0, c0);
				addEdge(c0, a0);
			}
		} else {
			const newEdges = new Array<[number, number]>();
			for (const [a, b] of this._edges) {
				if (this._vertices[a] !== Vector3.zero && this._vertices[b] !== Vector3.zero) {
					newEdges.push([a, b]);
				}
			}

			const newFaces = new Array<[number, number, number]>();
			for (const [a, b, c] of this._faces) {
				if (this._vertices[a] !== Vector3.zero && this._vertices[b] !== Vector3.zero && this._vertices[c] !== Vector3.zero) {
					newFaces.push([a, b, c]);
				}
			}

			this._edges = newEdges;
			this._faces = newFaces;
		}

		const v_count = this._vertices.size();

		const sum = this._vertices.reduce((acc, p) => ({
			x: acc.x + p.X,
			y: acc.y + p.Y,
			z: acc.z + p.Z,
		}), { x: 0, y: 0, z: 0 });

		const center = new Vector3(sum.x / v_count, sum.y / v_count, sum.z / v_count);

		this._center = center;
	}

	/**
	 * Checks if the given `BasePart` intersects with this `Volume3`.
	 * @private
	 * @param part The `BasePart` to check.
	 * @returns Whether the part intersects with the volume.
	 */
	private _partIntersects(part: BasePart): boolean {
		if (this._partQueryMode === Volume3.PartQueryMode.Point) {
			for (let i = 0; i < this._faces.size(); i++) {
				const normal = this._normals[i];
				const faceVert = this._vertices[this._faces[i][0]];
				const toPoint = part.Position.sub(faceVert);

				if (toPoint.Dot(normal) > 0) {
					return false;
				}
			}
			return true;
		} else {
			const half = part.Size.mul(0.5);
			const c = part.CFrame;

			const signs = [
				new Vector3(1, 1, 1), new Vector3(-1, 1, 1),
				new Vector3(1, -1, 1), new Vector3(-1, -1, 1),
				new Vector3(1, 1, -1), new Vector3(-1, 1, -1),
				new Vector3(1, -1, -1), new Vector3(-1, -1, -1),
			];

			const boxCorners = signs.map(s =>
				c.mul(new Vector3(half.X * s.X, half.Y * s.Y, half.Z * s.Z))
			);

			const boxAxes = [c.RightVector, c.UpVector, c.LookVector];

			const axes = [...boxAxes, ...this._normals];

			for (const [a, b] of this._edges) {
				const hullDir = this._vertices[b].sub(this._vertices[a]);
				if (hullDir.Magnitude < 1e-6) continue;
				const eH = hullDir.Unit;

				for (const bAxis of boxAxes) {
					const axis = eH.Cross(bAxis);
					if (axis.Magnitude > 1e-6) {
						axes.push(axis.Unit);
					}
				}
			}

			const project = (pts: Vector3[], axis: Vector3): [number, number] => {
				let min = pts[0].Dot(axis);
				let max = min;
				for (let i = 1; i < pts.size(); i++) {
					const p = pts[i].Dot(axis);
					if (p < min) min = p;
					if (p > max) max = p;
				}
				return [min, max];
			};

			for (const axis of axes) {
				const [minA, maxA] = project(this._vertices, axis);
				const [minB, maxB] = project(boxCorners, axis);

				if (maxA < minB || maxB < minA) {
					return false;
				}
			}

			return true;
		}
	}

	/**
	 * Checks if the given `Model` intersects with this `Volume3`.
	 * @private
	 * @param model The `Model` to check.
	 * @returns Whether the model intersects with the volume.
	 */
	private _modelIntersects(model: Model): boolean {
		if (this._modelQueryMode === Volume3.ModelQueryMode.Any) {
			for (const descendant of model.GetDescendants()) {
				if (descendant.IsA("BasePart")) {
					if (this._partIntersects(descendant)) {
						return true;
					}
				}
			}
		} else if (this._modelQueryMode === Volume3.ModelQueryMode.All) {
			for (const descendant of model.GetDescendants()) {
				if (descendant.IsA("BasePart")) {
					if (!this._partIntersects(descendant)) {
						return false;
					}
				}
			}
			return true;
		} else if (this._modelQueryMode === Volume3.ModelQueryMode.Primary) {
			const primaryPart = model.PrimaryPart;
			if (primaryPart) {
				return this._partIntersects(primaryPart);
			} else {
				warn(`Model '${model.Name}' has no PrimaryPart set, cannot use Primary model query mode. Defaulting to 'Any' mode.`);
				this._modelQueryMode = Volume3.ModelQueryMode.Any;
				return this._modelIntersects(model);
			}
		}
		return false;
	}

	/**
	 * Checks if the given `Model` or `BasePart` intersects with this `Volume3`.
	 * @private
	 * @param object The `Model` or `BasePart` to check.
	 * @returns Whether the object intersects with the volume.
	 */
	private _intersects(object: Model | BasePart): boolean {
		if (object.IsA("Model")) {
			if (this._modelIntersects(object)) {
				return true;
			}
		} else {
			if (this._intersects(object)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Performs a query against all aware objects to check for entries and exits.
	 * @private
	 */
	private _query() {
		for (const [object, inside] of this._awareOf) {
			let newInside = this._intersects(object);
			if (newInside !== inside) {
				if (newInside) {
					this.AnyEntered.Fire(object);
					if (object.IsA("Model")) {
						this.ModelEntered.Fire(object);
					} else {
						this.PartEntered.Fire(object);
					}
				} else {
					this.AnyLeft.Fire(object);
					if (object.IsA("Model")) {
						this.ModelLeft.Fire(object);
					} else {
						this.PartLeft.Fire(object);
					}
				}
				this._awareOf.set(object, newInside);
			}
		}
	}
}

