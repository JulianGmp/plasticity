import { Editor } from '../Editor'
import { PointPicker } from '../PointPicker'
import * as THREE from "three";
import { SphereFactory, CircleFactory, CylinderFactory, LineFactory } from './Factory'

export abstract class Command {
    editor: Editor;

    constructor(editor: Editor) {
        this.editor = editor;
    }

    abstract execute(): Promise<void>;
}

export class SphereCommand extends Command {
    factory: SphereFactory;

    constructor(editor: Editor) {
        super(editor);
        this.factory = new SphereFactory(editor);
    }

    async execute() {
        const pointPicker = new PointPicker(this.editor);
        const p1 = await pointPicker.execute();
        this.factory.center = p1;

        await pointPicker.execute((p2: THREE.Vector3) => {
            const radius = p1.distanceTo(p2);
            this.factory.radius = radius;
            this.factory.update();
        });
        this.factory.commit();
    }
}

export class CircleCommand extends Command {
    factory: CircleFactory;

    constructor(editor: Editor) {
        super(editor);
        this.factory = new CircleFactory(editor);
    }

    async execute() {
        const pointPicker = new PointPicker(this.editor);
        const p1 = await pointPicker.execute();
        this.factory.center = p1;

        await pointPicker.execute((p2: THREE.Vector3) => {
            const radius = p1.distanceTo(p2);
            this.factory.radius = radius;
            this.factory.update();
        });
        this.factory.commit();
    }
}

export class CylinderCommand extends Command {
    factory: CylinderFactory;

    constructor(editor: Editor) {
        super(editor);
        this.factory = new CylinderFactory(editor);
    }

    async execute() {
        const pointPicker = new PointPicker(this.editor);
        const p1 = await pointPicker.execute();
        this.factory.base = p1;

        pointPicker.restrictToPlaneThroughPoint(p1);
        await pointPicker.execute((p2: THREE.Vector3) => {
            this.factory.radius = p2;
            this.factory.update();
        });

        await pointPicker.execute((p3: THREE.Vector3) => {
            this.factory.height = p3;
            this.factory.update();
        });

        this.factory.commit();
    }
}

export class LineCommand extends Command {
    factory: LineFactory;

    constructor(editor: Editor) {
        super(editor)
        this.factory = new LineFactory(editor);
    }

    async execute() {
        const pointPicker = new PointPicker(this.editor);
        const p1 = await pointPicker.execute();
        this.factory.p1 = p1;
        await pointPicker.execute((p2: THREE.Vector3) => {
            this.factory.p2 = p2;
            this.factory.update();
        });
        this.factory.commit();
    }
}