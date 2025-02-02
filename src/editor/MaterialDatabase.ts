import * as THREE from "three";
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import c3d from '../../build/Release/c3d.node';
import controlPointIcon from '../components/viewport/img/control-point.svg';
import { face_unhighlighted, region_unhighlighted } from "../visual_model/RenderedSceneBuilder";
import { BetterRaycastingPointsMaterial } from "../visual_model/VisualModelRaycasting";
import { EditorSignals } from "./EditorSignals";
import { matcapTexture } from "./Matcaps";

export default interface MaterialDatabase {
    line(o?: c3d.SpaceInstance): LineMaterial;
    lineDashed(): LineMaterial;
    setResolution(size: THREE.Vector2): void;
    point(o?: c3d.Item): THREE.Material;
    surface(o?: c3d.Item): THREE.Material;
    mesh(o?: c3d.Item | c3d.MeshBuffer, doubleSided?: boolean): THREE.Material;
    region(): THREE.Material;
    controlPoint(): BetterRaycastingPointsMaterial;

    lookup(o: c3d.Edge): LineMaterial;
    lookup(o: c3d.Face): THREE.Material;
    lookup(o: c3d.Edge | c3d.Face): THREE.Material;
}

const previewLine = new LineMaterial({ color: 0x000088, linewidth: 0.7 });

const line = new LineMaterial({ color: 0x000000, linewidth: 1.4 });

const line_dashed = new LineMaterial({ color: 0x000000, linewidth: 0.3, dashed: true, dashScale: 100, dashSize: 100, gapSize: 100 });
line_dashed.depthFunc = THREE.AlwaysDepth;
line_dashed.defines.USE_DASH = "";

const point = new BetterRaycastingPointsMaterial({ color: 0x888888 });

const surface = region_unhighlighted;

const mesh = face_unhighlighted;

const region = region_unhighlighted;

const controlPoint = new BetterRaycastingPointsMaterial({ map: new THREE.TextureLoader().load(controlPointIcon), size: 10, sizeAttenuation: false, vertexColors: true });

export class BasicMaterialDatabase implements MaterialDatabase {
    readonly materials = new Map<number, THREE.Material>();
    private readonly lines = [line, line_dashed, previewLine];

    constructor(signals: EditorSignals) {
        signals.renderPrepared.add(({ resolution }) => this.setResolution(resolution));
    }

    private get(o: c3d.Item): THREE.Material | undefined {
        const st = o.GetStyle();
        return this.materials.get(st);
    }

    line(o?: c3d.SpaceInstance): LineMaterial {
        if (o === undefined) return line;
        if (o.GetStyle() === 0) return line;
        if (o.GetStyle() === 1) return previewLine;
        return line;
    }

    lineDashed(): LineMaterial {
        return line_dashed;
    }

    // A quirk of three.js is that to render lines with any thickness, you need to use
    // a LineMaterial whose resolution must be set before each render
    setResolution(size: THREE.Vector2) {
        for (const material of this.lines) {
            material.resolution.copy(size);
        }
        controlPoint.resolution.copy(size);
    }

    point(o?: c3d.Item): THREE.Material {
        if (!o) return point;
        return this.get(o) ?? point;
    }

    surface(o?: c3d.Item) {
        return surface;
    }

    mesh(o?: c3d.Item | c3d.MeshBuffer, doubleSided?: boolean): THREE.Material {
        let material;
        if (o instanceof c3d.Item) {
            material = this.get(o);
        } else if (o) {
            material = this.materials.get(o.style);
        }
        material = material ?? mesh;
        // material = material.clone(); // FIXME: need to dispose of this material
        material.side = doubleSided ? THREE.FrontSide : THREE.DoubleSide;
        return material;
    }

    region(): THREE.Material { return region }
    controlPoint(): BetterRaycastingPointsMaterial { return controlPoint }

    lookup(o: c3d.Edge): LineMaterial;
    lookup(o: c3d.Curve3D): LineMaterial;
    lookup(o: c3d.Face): THREE.Material;
    lookup(o: c3d.SpaceInstance): LineMaterial;
    lookup(o: c3d.TopologyItem | c3d.Curve3D | c3d.SpaceInstance): THREE.Material {
        if (o instanceof c3d.Curve3D || o instanceof c3d.Edge)
            return line;
        else if (o instanceof c3d.Face)
            return mesh;
        else if (o instanceof c3d.SpaceInstance)
            return line;
        else {
            throw new Error(`not yet implemented: ${o.constructor}`);
        }
    }
}

export class CurvePreviewMaterialDatabase extends BasicMaterialDatabase {
    line(o?: c3d.SpaceInstance): LineMaterial {
        return previewLine;
    }
}