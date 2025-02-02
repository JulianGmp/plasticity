import * as THREE from "three";
import * as visual from '../../src/visual_model/VisualModel';
import { ThreePointBoxFactory } from "../../src/commands/box/BoxFactory";
import { ExportFactory } from "../../src/commands/export/ExportFactory";
import { EditorSignals } from '../../src/editor/EditorSignals';
import { GeometryDatabase } from '../../src/editor/GeometryDatabase';
import MaterialDatabase from '../../src/editor/MaterialDatabase';
import { FakeMaterials } from "../../__mocks__/FakeMaterials";
import '../matchers';
import { ParallelMeshCreator } from "../../src/editor/MeshCreator";

let db: GeometryDatabase;
let materials: Required<MaterialDatabase>;
let signals: EditorSignals;

beforeEach(() => {
    materials = new FakeMaterials();
    signals = new EditorSignals();
    db = new GeometryDatabase(new ParallelMeshCreator(), materials, signals);
})

let box: visual.Solid;

beforeEach(async () => {
    const makeBox = new ThreePointBoxFactory(db, materials, signals);
    makeBox.p1 = new THREE.Vector3();
    makeBox.p2 = new THREE.Vector3(1, 0, 0);
    makeBox.p3 = new THREE.Vector3(1, 1, 0);
    makeBox.p4 = new THREE.Vector3(1, 1, 1);
    box = await makeBox.commit() as visual.Solid;
});

let exp: ExportFactory;

beforeEach(() => {
    exp = new ExportFactory(db, materials, signals);
})

test('invokes the appropriate c3d commands', async () => {
    exp.solid = box;
    await exp.update();
});
