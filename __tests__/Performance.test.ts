import * as fs from 'fs';
import { performance } from 'perf_hooks';
import { CrossPointDatabase } from '../src/editor/curves/CrossPointDatabase';
import { EditorSignals } from '../src/editor/EditorSignals';
import { GeometryDatabase } from '../src/editor/GeometryDatabase';
import MaterialDatabase from '../src/editor/MaterialDatabase';
import { ParallelMeshCreator } from '../src/editor/MeshCreator';
import { SnapManager } from '../src/editor/snaps/SnapManager';
import { TypeManager } from '../src/editor/TypeManager';
import { FakeMaterials } from "../__mocks__/FakeMaterials";
import './matchers';

jest.setTimeout(20_000);

let db: GeometryDatabase;
let materials: MaterialDatabase;
let signals: EditorSignals;

beforeEach(() => {
    materials = new FakeMaterials();
    signals = new EditorSignals();
    db = new GeometryDatabase(new ParallelMeshCreator(), materials, signals);
});

let data: Buffer;
beforeEach(async () => {
    const filePath = '/Users/nickkallen/Downloads/tactical.c3d';
    data = await fs.promises.readFile(filePath);
})

// NOTE: run `ndb .` and run the "benchmark" script.

describe.skip("Performance tests", () => {
    // NAIVE: 10980 10962 10931 11096
    // FIRST OPTIMIZATION: 3285 3251 3264 3316 3318
    // IF Edge and Face are no longer subclasses of THREE.Object3D 2889 2957 2916
    test.only('deserialize', async () => {
        const start = performance.now();
        await db.deserialize(data);
        const end = performance.now();
        console.log(end - start);
    })
    
    // NAIVE: 9981 9091 9917 8902 9868
    // IF PointSnap doesn't instantiate a snapper & nearby: closer to 6963 6759 6714
    // If CurveEdgeSnap snapper can be avoided: 6138 6125 6120
    // Generate helper lazily: 5538 5544 5541
    test.skip('snaps', async () => {
        const snaps = new SnapManager(db, new CrossPointDatabase(), new TypeManager(signals), signals);
        const start = performance.now();
        await db.deserialize(data);
        const end = performance.now();
        console.log(end - start);
    })
})