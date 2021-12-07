import { EditorSignals } from '../editor/EditorSignals';
import MaterialDatabase from '../editor/MaterialDatabase';
import { Intersectable, Intersection } from "../visual_model/Intersectable";
import * as visual from '../visual_model/VisualModel';
import { ControlPoint, Curve3D, CurveEdge, Face, PlaneInstance, Region, Solid, SpaceInstance, TopologyItem } from '../visual_model/VisualModel';
import { ClickStrategy } from './Click';
import { HoverStrategy } from './Hover';
import { HasSelectedAndHovered, Selectable } from './SelectionDatabase';

export enum SelectionMode {
    CurveEdge, Face, Solid, Curve, ControlPoint
}

export interface SelectionStrategy {
    emptyIntersection(): void;
    solid(object: TopologyItem, parentItem: Solid): boolean;
    topologicalItem(object: TopologyItem, parentItem: Solid): boolean;
    curve3D(object: Curve3D, parentItem: SpaceInstance<Curve3D>): boolean;
    region(object: Region, parentItem: PlaneInstance<Region>): boolean;
    controlPoint(object: ControlPoint, parentItem: SpaceInstance<Curve3D>): boolean;
}

export class ChangeSelectionExecutor {
    private readonly clickStrategy: ClickStrategy;
    private readonly hoverStrategy: HoverStrategy;

    constructor(
        readonly selection: HasSelectedAndHovered,
        readonly materials: MaterialDatabase,
        readonly signals: EditorSignals
    ) {
        this.clickStrategy = new ClickStrategy(selection.mode, selection.selected, selection.hovered);
        this.hoverStrategy = new HoverStrategy(selection.mode, selection.selected, selection.hovered);

        this.onClick = this.wrapFunction(this.onClick);
        this.onHover = this.wrapFunction(this.onHover);
        this.onBoxHover = this.wrapFunction(this.onBoxHover);
        this.onBoxSelect = this.wrapFunction(this.onBoxSelect);
        this.onCreatorSelect = this.wrapFunction(this.onCreatorSelect);
    }

    private onIntersection(intersections: Intersection[], strategy: SelectionStrategy): Intersection | undefined {
        if (intersections.length == 0) {
            strategy.emptyIntersection();
            return;
        }

        for (const intersection of intersections) {
            const object = intersection.object;
            if (object instanceof Face || object instanceof CurveEdge) {
                const parentItem = object.parentItem;
                if (strategy.solid(object, parentItem)) return intersection;
                if (strategy.topologicalItem(object, parentItem)) return intersection;
            } else if (object instanceof Curve3D) {
                const parentItem = object.parentItem;
                if (strategy.curve3D(object, parentItem)) return intersection;
            } else if (object instanceof Region) {
                const parentItem = object.parentItem;
                if (strategy.region(object, parentItem)) return intersection;
            } else if (object instanceof ControlPoint) {
                const parentItem = object.parentItem;
                if (strategy.controlPoint(object, parentItem)) return intersection;
            } else {
                console.error(object);
                throw new Error("Invalid precondition");
            }
        }

        strategy.emptyIntersection();
        return;
    }

    onClick(intersections: Intersection[]): Intersection | undefined {
        return this.onIntersection(intersections, this.clickStrategy);
    }

    onHover(intersections: Intersection[]): void {
        this.onIntersection(intersections, this.hoverStrategy);
    }

    onBoxHover(hover: Set<Intersectable>) {
        this.hoverStrategy.box(hover);
    }

    onBoxSelect(select: Set<Intersectable>) {
        this.clickStrategy.box(select);
    }

    onCreatorSelect(topologyItems: visual.TopologyItem[]) {
        for (const topo of topologyItems) {
            if (!this.clickStrategy.solid(topo, topo.parentItem))
                this.clickStrategy.topologicalItem(topo, topo.parentItem);
        }
    }

    private aggregateHovers<R>(f: () => R): R {
        const { signals } = this;
        const added = new Set<Selectable>(), removed = new Set<Selectable>();
        const add = (s: Selectable) => added.add(s);
        const remove = (s: Selectable) => removed.add(s);
        signals.objectHovered.add(add);
        signals.objectUnhovered.add(remove);
        let result: R;
        try { result = f() }
        finally {
            signals.objectHovered.remove(add);
            signals.objectUnhovered.remove(remove);
        }
        this.signals.hoverChanged.dispatch({ added, removed });
        return result;
    }

    private wrapFunction<A extends any[], R>(f: (...args: A) => R): (...args: A) => R {
        return (...args: A): R => this.aggregateHovers(() => f.call(this, ...args));
    }
}