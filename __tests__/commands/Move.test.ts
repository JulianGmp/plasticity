import * as THREE from "three";
import MoveFactory from '../../src/commands/move/MoveFactory';
import SphereFactory from '../../src/commands/sphere/SphereFactory';
import { EditorSignals } from '../../src/Editor';
import { GeometryDatabase } from '../../src/GeometryDatabase';
import MaterialDatabase from '../../src/MaterialDatabase';
import * as visual from '../../src/VisualModel';
import { FakeMaterials } from "../../__mocks__/FakeMaterials";
import FakeSignals from '../../__mocks__/FakeSignals';
import '../matchers';

let db: GeometryDatabase;
let move: MoveFactory;
let materials: Required<MaterialDatabase>;
let signals: EditorSignals;

beforeEach(() => {
    materials = new FakeMaterials();
    signals = FakeSignals();
    db = new GeometryDatabase(materials, signals);
    move = new MoveFactory(db, materials, signals);
})

describe('update', () => {
    test('moves the visual object', async () => {
        const item = new visual.Solid();
        move.item = item;
        move.p1 = new THREE.Vector3();
        move.p2 = new THREE.Vector3(1, 0, 0);
        expect(item.position).toEqual(new THREE.Vector3(0, 0, 0));
        await move.update();
        expect(item.position).toEqual(new THREE.Vector3(1, 0, 0));
    });
});

describe('commit', () => {
    test('invokes the appropriate c3d commands', async () => {
        expect(db.scene.children.length).toBe(0);
        const makeSphere = new SphereFactory(db, materials, signals);
        makeSphere.center = new THREE.Vector3();
        makeSphere.radius = 1;
        const sphere = await makeSphere.commit() as visual.Solid;

        move.item = sphere;
        move.p1 = new THREE.Vector3();
        move.p2 = new THREE.Vector3(1, 0, 0);
        const moved = await move.commit() as visual.Solid;
        const bbox = new THREE.Box3().setFromObject(moved);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        expect(center).toApproximatelyEqual(new THREE.Vector3(1, 0, 0));
    })
})