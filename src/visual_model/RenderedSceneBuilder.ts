import { CompositeDisposable, Disposable } from "event-kit";
import signals from "signals";
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { DatabaseLike } from "../editor/DatabaseLike";
import { EditorSignals } from "../editor/EditorSignals";
import { matcapTexture } from "../editor/Matcaps";
import MaterialDatabase from "../editor/MaterialDatabase";
import ModifierManager from "../editor/ModifierManager";
import { HasSelectedAndHovered, Selectable } from "../selection/SelectionDatabase";
import { ItemSelection } from "../selection/TypedSelection";
import { Theme } from "../startup/LoadTheme";
import * as visual from '../visual_model/VisualModel';

type State = { tag: 'none' } | { tag: 'scratch', selection: HasSelectedAndHovered }

export class RenderedSceneBuilder {
    private readonly disposable = new CompositeDisposable();
    dispose() { this.disposable.dispose() }

    private state: State = { tag: 'none' };
    constructor(
        protected readonly db: DatabaseLike,
        protected readonly materials: MaterialDatabase,
        protected readonly editorSelection: HasSelectedAndHovered,
        theme: Theme,
        protected readonly signals: EditorSignals,
    ) {
        this.highlight = this.highlight.bind(this);

        const bindings: signals.SignalBinding[] = [];
        bindings.push(signals.renderPrepared.add(({ resolution }) => this.setResolution(resolution)));
        bindings.push(signals.commandEnded.add(this.highlight));
        bindings.push(signals.sceneGraphChanged.add(this.highlight));
        bindings.push(signals.modifiersLoaded.add(this.highlight));
        bindings.push(signals.historyChanged.add(this.highlight));
        bindings.push(signals.quasimodeChanged.add(this.highlight));
        bindings.push(signals.hoverDelta.add(({ added, removed }) => {
            this.unhover(removed);
            this.hover(added);
        }));
        this.disposable.add(new Disposable(() => {
            for (const binding of bindings) binding.detach();
        }));

        this.setTheme(theme);
    }

    private get selection() {
        switch (this.state.tag) {
            case 'none': return this.editorSelection;
            case 'scratch': return this.state.selection;
        }
    }

    // FIXME: combine hovered and unhovered by combining highlightCurve/etc with hoverCurve/etc.
    hover(hovered: Set<Selectable>) {
        performance.mark('begin-hover');
        const facesChanged = new Set<visual.Solid>();
        const edgesChanged = new Set<visual.Solid>();
        for (const item of hovered) {
            if (item instanceof visual.SpaceInstance) {
                this.hoverCurve(item);
            } else if (item instanceof visual.Face) {
                facesChanged.add(item.parentItem);
            } else if (item instanceof visual.CurveEdge) {
                edgesChanged.add(item.parentItem);
            } else if (item instanceof visual.PlaneInstance) {
                this.hoverRegion(item);
            } else if (item instanceof visual.ControlPoint) {
                this.hoverControlPoint(item);
            }
        }
        for (const item of facesChanged) this.highlightFaces(item);
        for (const item of edgesChanged) this.highlightEdges(item);
        performance.measure('hover', 'begin-hover');
    }

    private hoverRegion(item: visual.PlaneInstance<visual.Region>) {
        item.underlying.mesh.material = region_hovered;
    }

    protected hoverFace(item: visual.Face) {
    }

    private hoverCurve(item: visual.SpaceInstance<visual.Curve3D>) {
        const curve = item.underlying;
        curve.line.material = line_hovered;
    }

    private hoverControlPoint(v: visual.ControlPoint) {
        const geometry = v.geometry!;
        const colors = geometry.attributes.color;
        const array = colors.array as unknown as Uint8Array;
        array[v.index * 3 + 0] = controlPoint_hovered.r * 255;
        array[v.index * 3 + 1] = controlPoint_hovered.g * 255;
        array[v.index * 3 + 2] = controlPoint_hovered.b * 255;
        colors.needsUpdate = true;
    }

    unhover(hovered: Set<Selectable>) {
        performance.mark('begin-unhover');
        const facesChanged = new Set<visual.Solid>();
        const edgesChanged = new Set<visual.Solid>();
        for (const item of hovered) {
            if (item instanceof visual.SpaceInstance) {
                this.highlightCurve(item);
            } else if (item instanceof visual.Face) {
                facesChanged.add(item.parentItem);
            } else if (item instanceof visual.CurveEdge) {
                edgesChanged.add(item.parentItem);
            } else if (item instanceof visual.PlaneInstance) {
                this.highlightRegion(item);
            } else if (item instanceof visual.ControlPoint) {
                this.highlightCurve(item.parentItem);
            }
        }
        for (const item of facesChanged) this.highlightFaces(item);
        for (const item of edgesChanged) this.highlightEdges(item);
        performance.measure('unhover', 'begin-unhover');
    }

    protected unhoverFace(item: visual.Face) { }

    highlight() {
        performance.mark('begin-highlight');
        for (const item of this.db.visibleObjects) {
            if (item instanceof visual.Solid) {
                this.highlightSolid(item);
            } else if (item instanceof visual.SpaceInstance) {
                this.highlightSpaceInstance(item);
            } else if (item instanceof visual.PlaneInstance) {
                this.highlightRegion(item);
            } else throw new Error("invalid type: " + item.constructor.name);
            item.updateMatrixWorld();
        }
        this.highlightControlPoints();
        performance.measure('highlight', 'begin-highlight');
    }

    private readonly lines = [line_unselected, line_selected, line_edge, line_hovered];

    private highlightSolid(solid: visual.Solid) {
        this.highlightFaces(solid);
        this.highlightEdges(solid);
        solid.layers.set(visual.Layers.Solid);
    }

    private highlightRegion(item: visual.PlaneInstance<visual.Region>) {
        const { selected } = this.selection;
        const region = item.underlying as visual.Region;
        region.mesh.material = selected.regionIds.has(region.simpleName) ? region_highlighted : region_unhighlighted;
        region.layers.set(visual.Layers.Region);
        region.mesh.layers.set(visual.Layers.Region);
    }

    private highlightSpaceInstance(item: visual.SpaceInstance<any>) {
        const underlying = item.underlying;
        if (underlying instanceof visual.Curve3D) {
            this.highlightCurve(item);
        } else if (underlying instanceof visual.Surface) {
        }
    }

    private highlightCurve(item: visual.SpaceInstance<visual.Curve3D>) {
        const { selected } = this.selection;
        const curve = item.underlying;
        const layer = curve.isFragment ? visual.Layers.CurveFragment : visual.Layers.Curve;
        const occludedLayer = curve.isFragment ? visual.Layers.CurveFragment_XRay : visual.Layers.XRay;
        const isSelected = selected.curveIds.has(item.simpleName);
        curve.line.material = isSelected ? line_selected : line_unselected;
        curve.line.layers.set(layer);
        curve.occludedLine.layers.set(occludedLayer);
        curve.layers.set(layer);
        const geometry = curve.points.geometry;
        const colors = geometry.attributes.color;
        if (colors === undefined) return;
        const colorsArray = colors.array as unknown as Uint8Array;
        for (let i = 0; i < colorsArray.length / 3; i++) {
            const id = visual.ControlPoint.simpleName(item.simpleName, i);
            const color = selected.controlPointIds.has(id) ? controlPoint_highlighted : controlPoint_unhighlighted;
            colorsArray[i * 3 + 0] = color.r * 255;
            colorsArray[i * 3 + 1] = color.g * 255;
            colorsArray[i * 3 + 2] = color.b * 255;
        }
        colors.needsUpdate = true;
    }

    private highlightControlPoints() {
        const { selected } = this.selection;
        for (const point of selected.controlPoints) {
            const geometry = point.geometry!;
            const colors = geometry.attributes.color;
            const array = colors.array as unknown as Uint8Array;
            array[point.index * 3 + 0] = controlPoint_highlighted.r * 255;
            array[point.index * 3 + 1] = controlPoint_highlighted.g * 255;
            array[point.index * 3 + 2] = controlPoint_highlighted.b * 255;
            colors.needsUpdate = true;
        }
    }

    protected highlightEdges(solid: visual.Solid) {
        const selection = this.selection.selected;
        const hovering = this.selection.hovered;
        const edgegroup = solid.lod.high.edges;
        let hovered: visual.CurveEdge[] = [];
        let selected: visual.CurveEdge[] = [];

        for (const edge of edgegroup) {
            if (hovering.edgeIds.has(edge.simpleName)) {
                hovered.push(edge);
            } else if (selection.edgeIds.has(edge.simpleName)) {
                selected.push(edge);
            }
        }

        const pairs: [visual.CurveEdge[], LineMaterial][] = [[selected, line_selected], [hovered, line_hovered]];
        edgegroup.temp.clear();
        for (const [edges, mat] of pairs) {
            if (edges.length === 0) continue;
            const sliced = edgegroup.slice(edges);
            sliced.material = mat;
            edgegroup.temp.add(sliced);
        }
    }

    protected highlightFaces(solid: visual.Solid, highlighted: THREE.Material = face_highlighted, unhighlighted: THREE.Material = face_unhighlighted, phantom: THREE.Material = face_hovered_phantom) {
        const selection = this.selection.selected;
        const hovering = this.selection.hovered;
        const facegroup = solid.lod.high.faces;
        let hovered: visual.GeometryGroup[] = [];
        let selected: visual.GeometryGroup[] = [];
        let unselected: visual.GeometryGroup[] = [];
        for (const face of facegroup) {
            if (hovering.faceIds.has(face.simpleName)) {
                hovered.push(face.group);
            } else if (selection.faceIds.has(face.simpleName)) {
                selected.push(face.group);
            } else {
                unselected.push(face.group);
            }
        }
        hovered = visual.GeometryGroupUtils.compact(hovered);
        selected = visual.GeometryGroupUtils.compact(selected);
        unselected = visual.GeometryGroupUtils.compact(unselected);
        const hovered_phantom = hovered.map(u => ({ ...u }));
        hovered.forEach(s => s.materialIndex = 0);
        selected.forEach(s => s.materialIndex = 1);
        unselected.forEach(s => s.materialIndex = 2);
        hovered_phantom.forEach(s => s.materialIndex = 3);
        facegroup.mesh.material = [face_hovered, highlighted, unhighlighted, phantom];
        facegroup.mesh.geometry.groups = [...hovered, ...selected, ...unselected, ...hovered_phantom];
    }

    protected highlightFace(face: visual.Face, highlighted: THREE.Material = face_highlighted, unhighlighted: THREE.Material = face_unhighlighted) { }

    setResolution(size: THREE.Vector2) {
        for (const material of this.lines) {
            material.resolution.copy(size);
        }
    }

    get outlineSelection() { return this.selection.selected.solids }
    get outlineHover() { return this.selection.hovered.solids }

    useTemporary(selection: HasSelectedAndHovered) {
        switch (this.state.tag) {
            case 'none': this.state = { tag: 'scratch', selection }; break;
            case 'scratch': throw new Error("already in scratch state");
        }
        this.signals.selectionChanged.dispatch();
        const bindings: signals.SignalBinding[] = [];
        bindings.push(selection.signals.selectionDelta.add(() => this.highlight()));
        bindings.push(selection.signals.hoverDelta.add(({ added, removed }) => {
            this.unhover(removed);
            this.hover(added);
            this.signals.hoverDelta.dispatch({ added, removed });
        }));
        return new Disposable(() => {
            bindings.forEach(x => x.detach());
            this.state = { tag: 'none' };
            this.highlight();
            this.signals.selectionChanged.dispatch();
        })
    }

    private setTheme(theme: Theme) {
        face_unhighlighted.color.setStyle(theme.colors.matcap).convertSRGBToLinear();
        face_highlighted.color.setStyle(theme.colors.yellow[200]).convertSRGBToLinear();
        face_hovered.color.setStyle(theme.colors.yellow[500]).convertSRGBToLinear();
        line_unselected.color.setStyle(theme.colors.blue[400]).convertSRGBToLinear();
        region_hovered.color.setStyle(theme.colors.blue[200]).convertSRGBToLinear();
        region_highlighted.color.setStyle(theme.colors.blue[300]).convertSRGBToLinear();
        region_unhighlighted.color.setStyle(theme.colors.blue[400]).convertSRGBToLinear();
    }
}

export class ModifierHighlightManager extends RenderedSceneBuilder {
    constructor(
        private readonly modifiers: ModifierManager,
        db: DatabaseLike,
        materials: MaterialDatabase,
        selection: HasSelectedAndHovered,
        theme: Theme,
        signals: EditorSignals,
    ) {
        super(db, materials, selection, theme, signals);
    }

    highlight() {
        super.highlight();
        performance.mark('begin-modifier-highlight');
        const { modifiers, modifiers: { selected } } = this;
        const { premodifiedIds, modifiedIds } = selected.groupIds;

        for (const { premodified, modified } of modifiers.stacks) {
            // All premodifieds have transparent faces
            for (const face of premodified.allFaces) {
                // But only if they're unselected
                if (selected.faceIds.has(face.simpleName)) {
                    // face.child.material = invisible_highlighted;
                } else {
                    // face.child.material = invisible;
                }
            }

            if (premodifiedIds.has(premodified.simpleName) || selected.hasSelectedChildren(premodified)) {
                // All selected premodifieds have visible edges
                for (const edge of premodified.allEdges) {
                    edge.visible = true;
                }

                // All selected premodifieds are selectable
                premodified.traverse(unmask);
            } else {
                // All unselected premodifieds have invisible edges
                for (const edge of premodified.allEdges) {
                    edge.visible = false;
                }
                // All unselected premodifieds are unselectable
                premodified.traverse(mask);
            }

            if (modifiedIds.has(modified.simpleName)) {
                // All selected modifieds have invisible edges
                for (const edge of modified.allEdges) {
                    edge.visible = false;
                }

                // All selected modifieds have unselectable topo items
                modified.traverse(mask);
            } else {
                // All unselected modifieds have visible edges
                for (const edge of modified.allEdges) {
                    edge.visible = true;
                }

                // All unselected modifieds have selectable topo items
                modified.traverse(unmask);
            }
        }
        performance.measure('modifier-highlight', 'begin-modifier-highlight');
    }

    get outlineSelection() {
        const { db, modifiers } = this;
        const { unmodifiedIds, modifiedIds } = modifiers.selected.groupIds;

        return new ItemSelection<visual.Solid>(db, new Set([...unmodifiedIds, ...modifiedIds]));
    }

    protected hoverFace(item: visual.Face) {
        const { views } = this.db.lookupTopologyItemById(item.simpleName);
        for (const view of views) {
            const face = view as visual.Face;
            const solid = face.parentItem;
            switch (this.modifiers.stateOf(solid)) {
                case 'premodified':
                    // face.child.material = invisible_hovered;
                    break;
                default:
                // face.child.material = face_hovered;
            }
        }
    }

    protected unhoverFace(item: visual.Face) {
        const { views } = this.db.lookupTopologyItemById(item.simpleName);
        for (const topo of views) {
            const face = topo as visual.Face;
            const solid = face.parentItem;
            switch (this.modifiers.stateOf(solid)) {
                case 'premodified':
                    this.highlightFace(face, invisible_highlighted, invisible);
                    break;
                default:
                    this.highlightFace(face, face_highlighted, face_unhighlighted);
            }
        }
    }
}

function mask(child: THREE.Object3D) {
    if (child.userData.oldLayerMask == undefined) {
        child.userData.oldLayerMask = child.layers.mask;
        child.layers.set(visual.Layers.Unselectable);
    }
}

function unmask(child: THREE.Object3D) {
    if (child.userData.oldLayerMask !== undefined) {
        child.layers.mask = child.userData.oldLayerMask;
        delete child.userData.oldLayerMask;
    }
}

const line_unselected = new LineMaterial({ linewidth: 1.5 });
line_unselected.polygonOffset = true;
line_unselected.polygonOffsetFactor = -20;
line_unselected.polygonOffsetUnits = -20;

const line_edge = new LineMaterial({ linewidth: 1.4, vertexColors: true });

const line_selected = new LineMaterial({ color: 0xffff00, linewidth: 2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
line_selected.depthFunc = THREE.AlwaysDepth;

const line_hovered = new LineMaterial({ color: 0xffffff, linewidth: 2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
line_hovered.depthFunc = THREE.AlwaysDepth;

export const face_unhighlighted = new THREE.MeshMatcapMaterial();
face_unhighlighted.fog = false;
face_unhighlighted.matcap = matcapTexture;
face_unhighlighted.polygonOffset = true;
face_unhighlighted.polygonOffsetFactor = 1;
face_unhighlighted.polygonOffsetUnits = 2;

const face_highlighted = new THREE.MeshMatcapMaterial();
face_highlighted.fog = false;
face_highlighted.matcap = matcapTexture;
face_highlighted.polygonOffset = true;
face_highlighted.polygonOffsetFactor = 1;
face_highlighted.polygonOffsetUnits = 1;

const face_highlighted_phantom = face_highlighted.clone();
face_highlighted_phantom.depthFunc = THREE.AlwaysDepth;
face_highlighted_phantom.transparent = true;
face_highlighted_phantom.opacity = 0.0;

const face_hovered = new THREE.MeshMatcapMaterial();
face_hovered.fog = false;
face_hovered.matcap = matcapTexture;
face_hovered.polygonOffset = true;
face_hovered.polygonOffsetFactor = 1;
face_hovered.polygonOffsetUnits = 1;

const face_hovered_phantom = face_hovered.clone();
face_hovered.depthFunc = THREE.AlwaysDepth;
face_hovered.transparent = true;
face_hovered.opacity = 0.35;
face_hovered.side = THREE.DoubleSide;

const region_hovered = new THREE.MeshBasicMaterial();
region_hovered.fog = false;
region_hovered.opacity = 0.5;
region_hovered.transparent = true;
region_hovered.side = THREE.DoubleSide;
region_hovered.polygonOffset = true;
region_hovered.polygonOffsetFactor = -10;
region_hovered.polygonOffsetUnits = -1;
region_hovered.depthFunc = THREE.AlwaysDepth;

const region_highlighted = new THREE.MeshBasicMaterial();
region_highlighted.fog = false;
region_highlighted.opacity = 0.9;
region_highlighted.transparent = true;
region_highlighted.side = THREE.DoubleSide;
region_highlighted.polygonOffset = true;
region_highlighted.polygonOffsetFactor = -10;
region_highlighted.polygonOffsetUnits = -1;

export const region_unhighlighted = new THREE.MeshBasicMaterial();
region_unhighlighted.fog = false;
region_unhighlighted.opacity = 0.1;
region_unhighlighted.transparent = true;
region_unhighlighted.side = THREE.DoubleSide;
region_unhighlighted.polygonOffset = true;
region_unhighlighted.polygonOffsetFactor = -10;
region_unhighlighted.polygonOffsetUnits = -1;


const controlPoint_hovered = new THREE.Color(0xffff88);
const controlPoint_highlighted = new THREE.Color(0xffff00);
const controlPoint_unhighlighted = new THREE.Color(0xa000aa);

const invisible = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    depthTest: false,
});

const invisible_highlighted = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffff00).convertSRGBToLinear(),
    transparent: true,
    opacity: 0.20,
    depthWrite: false,
    depthTest: false,
});

const invisible_hovered = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffffcc).convertSRGBToLinear(),
    transparent: true,
    opacity: 0.20,
    depthWrite: false,
    depthTest: false,
});