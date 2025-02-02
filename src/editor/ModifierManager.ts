import * as THREE from "three";
import c3d from '../../build/Release/c3d.node';
import { SymmetryFactory } from "../commands/mirror/MirrorFactory";
import { HasSelectedAndHovered, ModifiesSelection, Selectable, SelectionDatabase } from "../selection/SelectionDatabase";
import { SelectionProxy } from "../selection/SelectionProxy";
import { ItemSelection } from "../selection/TypedSelection";
import { GConstructor } from "../util/Util";
import * as visual from "../visual_model/VisualModel";
import { Agent, DatabaseLike, TemporaryObject } from "./DatabaseLike";
import { DatabaseProxy } from "./DatabaseProxy";
import { EditorSignals } from "./EditorSignals";
import { MementoOriginator, ModifierMemento, ModifierStackMemento } from "./History";
import MaterialDatabase from "./MaterialDatabase";

export type Replacement = { from: visual.Item, to: visual.Item }

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

/**
 * Modifiers are a "stack" of post-processing operations on an object, e.g., a symmetrize that will
 * automatically run after every operation.
 * 
 * Important vocabulary: "unmodified" -- a normal object with no modifier stack; "premodified" --
 * an object with a modifier stack, but before the modifiers have been run; "modified" -- an object
 * with a modifier stack fully executed.
 */

export class ModifierStack {
    isEnabled = true;
    showWhileEditing = true;

    constructor(
        readonly premodified: visual.Solid,
        readonly modified: visual.Solid,
        readonly modifiers: SymmetryFactory[],
        private readonly db: DatabaseLike,
        private readonly materials: MaterialDatabase,
    ) {
        Object.freeze(this);
        Object.freeze(modifiers);
    }

    async update(underlying: c3d.Solid, view: Promise<visual.Solid>): Promise<ModifierStack> {
        const { premodified, modified } = await this.calculate(underlying, view);
        return new ModifierStack(premodified, modified, this.modifiers, this.db, this.materials);
    }

    async rebuild(): Promise<ModifierStack> {
        const { db, premodified } = this;
        return this.update(db.lookup(premodified), Promise.resolve(premodified));
    }

    addModifier(factory: SymmetryFactory): ModifierStack {
        return new ModifierStack(this.premodified, this.modified, [...this.modifiers, factory], this.db, this.materials);
    }

    removeModifier(index: number): ModifierStack {
        if (index >= this.modifiers.length) throw new Error("invalid precondition");
        const spliced = [...this.modifiers];
        spliced.splice(index, 1);
        return new ModifierStack(this.premodified, this.modified, spliced, this.db, this.materials);
    }

    private async calculate(model: c3d.Solid, view: Promise<visual.Solid>): Promise<{ premodified: visual.Solid, modified: visual.Solid }> {
        const { modifiers } = this;
        if (modifiers.length === 0) {
            const completed = await view;
            return { premodified: completed, modified: completed }
        }

        for (const modifier of modifiers) {
            const symmetry = modifier as SymmetryFactory;
            symmetry.solid = model;
            await symmetry.beforeCalculate();
            model = (await symmetry.calculate())[0];
        }

        const modified = (this.modified === this.premodified) ?
            await this.db.addItem(model) :
            await this.db.replaceItem(this.modified, model);

        const premodified = await view;

        return { premodified, modified };
    }

    async updateTemporary(from: visual.Item, underlying: c3d.Solid): Promise<TemporaryObject> {
        const modifiers = this.modifiers;
        const allButLast = modifiers.slice(0, modifiers.length - 1);
        const last = modifiers[modifiers.length - 1];
        let symmetrized = underlying;
        for (const modifier of allButLast) {
            const symmetry = modifier as SymmetryFactory;
            symmetry.solid = symmetrized;
            symmetrized = (await symmetry.calculate())[0];
        }
        const symmetry = last as SymmetryFactory;
        symmetry.solid = symmetrized;
        await symmetry.beforeCalculate()
        const temps = await symmetry.doUpdate(() => false);

        if (temps.length === 0) return {
            underlying: undefined as any,
            show() { },
            cancel() { },
            hide() { },
        };
        if (temps.length > 1) throw new Error("invalid postcondition: " + temps.length);
        const temp = temps[0];
        const { modified, premodified } = this;

        return {
            underlying: temp.underlying,
            show() {
                temp.show();
                temp.underlying.updateMatrixWorld();
                modified.visible = false;
                premodified.visible = false;
            },
            hide() {
                temp.hide();
                modified.visible = true;
                premodified.visible = true;
            },
            cancel() {
                temp.cancel();
                modified.visible = true;
                premodified.visible = true;
            }
        }
    }

    dispose() {
        const { modified, premodified, materials } = this;
        if (modified !== premodified) {
            this.db.removeItem(modified);
            for (const face of premodified.allFaces) {
                face.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        child.material = materials.mesh();
                    }
                });
            }
        }
    }

    saveToMemento(): ModifierStackMemento {
        return new ModifierStackMemento(
            this.premodified,
            this.modified,
            [...this.modifiers],
        )
    }

    static restoreFromMemento(m: ModifierStackMemento, db: DatabaseLike, materials: MaterialDatabase) {
        return new ModifierStack(m.premodified, m.modified, new Array(...m.modifiers), db, materials)
    }

    toJSON() {
        return this.saveToMemento().toJSON();
    }

    static fromJSON(json: any, db: DatabaseLike, materials: MaterialDatabase, signals: EditorSignals): ModifierStack {
        return this.restoreFromMemento(ModifierStackMemento.fromJSON(json, db, materials, signals), db, materials);
    }
}

export default class ModifierManager extends DatabaseProxy implements HasSelectedAndHovered, MementoOriginator<ModifierMemento> {
    protected readonly name2stack = new Map<c3d.SimpleName, ModifierStack>();
    protected readonly version2name = new Map<c3d.SimpleName, c3d.SimpleName>();
    protected readonly modified2name = new Map<c3d.SimpleName, c3d.SimpleName>();

    readonly selected: ModifierSelection;
    readonly hovered: ModifiesSelection;

    constructor(
        db: DatabaseLike,
        protected readonly selection: HasSelectedAndHovered,
        protected readonly materials: MaterialDatabase,
        readonly signals: EditorSignals
    ) {
        super(db);
        this.selected = new ModifierSelection(db, this, selection.selected);
        this.hovered = selection.hovered;
    }

    get mode() { return this.selection.mode }

    add(object: visual.Solid, klass: GConstructor<SymmetryFactory>): { stack: ModifierStack, factory: SymmetryFactory } {
        const { version2name, name2stack } = this;

        const factory = new klass(this.db, this.materials, this.signals);
        factory.shouldCut = true;
        factory.shouldUnion = true;
        switch (this.stateOf(object)) {
            case 'unmodified': {
                const name = version2name.get(object.simpleName)!;
                let stack = new ModifierStack(object, object, [], this.db, this.materials);
                stack = stack.addModifier(factory);
                name2stack.set(name, stack);
                return { stack, factory };
            }
            case 'premodified': {
                const name = version2name.get(object.simpleName)!;
                let stack = name2stack.get(name)!;
                stack = stack.addModifier(factory);
                return { stack, factory }
            }
            default: throw new Error("invalid state");
        }


    }

    async remove(object: visual.Solid) {
        const { version2name, modified2name, name2stack } = this;
        const stack = this.getByPremodified(object);
        if (stack === undefined) throw new Error("invalid precondition");
        modified2name.delete(stack.modified.simpleName);
        stack.dispose();

        name2stack.delete(version2name.get(object.simpleName)!);
    }

    async rebuild(stack: ModifierStack): Promise<ModifierStack> {
        const { modified2name, name2stack, version2name } = this;
        if (stack.modifiers.length === 0) {
            const name = modified2name.get(stack.modified.simpleName);
            if (name === undefined) throw new Error("invalid precondition");
            name2stack.delete(name);
            modified2name.delete(stack.modified.simpleName);
            stack.dispose();
            return stack;
        } else {
            modified2name.delete(stack.modified.simpleName);
            stack = await stack.rebuild();
            const { premodified, modified } = stack;
            const name = version2name.get(premodified.simpleName)!;
            name2stack.set(name, stack);
            modified2name.set(modified.simpleName, name);
            return stack;
        }
    }

    async apply(stack: ModifierStack) {
        const { version2name, modified2name, name2stack } = this;
        const { premodified, modified } = stack;

        modified2name.delete(modified.simpleName);
        const name = version2name.get(premodified.simpleName)!;
        name2stack.delete(name);
        version2name.set(modified.simpleName, name);
        version2name.delete(premodified.simpleName)
        this.db.removeItem(premodified);
        return modified;
    }

    getByPremodified(object: visual.Solid | c3d.SimpleName): ModifierStack | undefined {
        const { version2name, name2stack } = this;
        const simpleName = object instanceof visual.Solid ? object.simpleName : object;
        let name = version2name.get(simpleName);
        if (name === undefined) return undefined;

        return name2stack.get(name);
    }

    getByModified(object: visual.Solid | c3d.SimpleName): ModifierStack | undefined {
        const { name2stack, modified2name } = this;
        const simpleName = object instanceof visual.Solid ? object.simpleName : object;
        const name = modified2name.get(simpleName);
        if (name === undefined) return;
        if (!name2stack.has(name)) throw new Error("invalid precondition");
        return name2stack.get(name)!;
    }

    get stacks(): Iterable<ModifierStack> {
        return this.name2stack.values();
    }

    async addItem(model: c3d.Solid, agent?: Agent): Promise<visual.Solid>;
    async addItem(model: c3d.SpaceInstance, agent?: Agent): Promise<visual.SpaceInstance<visual.Curve3D>>;
    async addItem(model: c3d.PlaneInstance, agent?: Agent): Promise<visual.PlaneInstance<visual.Region>>;
    async addItem(model: c3d.Item, agent: Agent = 'user'): Promise<visual.Item> {
        const result = await this.db.addItem(model, agent);
        this.version2name.set(result.simpleName, result.simpleName);
        return result;
    }

    async replaceItem(from: visual.Solid, model: c3d.Solid, agent?: Agent): Promise<visual.Solid>;
    async replaceItem<T extends visual.SpaceItem>(from: visual.SpaceInstance<T>, model: c3d.SpaceInstance, agent?: Agent): Promise<visual.SpaceInstance<visual.Curve3D>>;
    async replaceItem<T extends visual.PlaneItem>(from: visual.PlaneInstance<T>, model: c3d.PlaneInstance, agent?: Agent): Promise<visual.PlaneInstance<visual.Region>>;
    async replaceItem(from: visual.Item, model: c3d.Item, agent?: Agent): Promise<visual.Item>;
    async replaceItem(from: visual.Item, to: c3d.Item): Promise<visual.Item> {
        const { name2stack, version2name, modified2name } = this;
        const name = version2name.get(from.simpleName)!;

        const result = this.db.replaceItem(from, to);
        if (name2stack.has(name)) {
            let stack = name2stack.get(name)!;
            modified2name.delete(stack.modified.simpleName);
            stack = await stack.update(to as c3d.Solid, result as Promise<visual.Solid>);
            const modified = stack.modified;
            modified2name.set(modified.simpleName, name);
            name2stack.set(name, stack);
        }

        const view = await result;

        version2name.delete(from.simpleName);
        version2name.set(view.simpleName, name);

        return result;
    }

    async removeItem(view: visual.Item, agent?: Agent): Promise<void> {
        const { version2name, name2stack, modified2name } = this;
        switch (this.stateOf(view)) {
            case 'unmodified':
                version2name.delete(view.simpleName)!;
                break;
            case 'premodified': {
                const name = version2name.get(view.simpleName)!;
                const modifiers = name2stack.get(name)!;
                modified2name.delete(modifiers.modified.simpleName);
                version2name.delete(view.simpleName)!;
                name2stack.delete(name);
                modifiers.dispose();
                break;
            }
            case 'modified':
                const name = modified2name.get(view.simpleName)!;
                const modifiers = name2stack.get(name)!;
                modified2name.delete(view.simpleName);
                name2stack.delete(name);
                modifiers.dispose();
                break;
        }

        return this.db.removeItem(view, agent);
    }

    async duplicate(model: visual.Solid): Promise<visual.Solid>;
    async duplicate<T extends visual.SpaceItem>(model: visual.SpaceInstance<T>): Promise<visual.SpaceInstance<T>>;
    async duplicate<T extends visual.PlaneItem>(model: visual.PlaneInstance<T>): Promise<visual.PlaneInstance<T>>;
    async duplicate(edge: visual.CurveEdge): Promise<visual.SpaceInstance<visual.Curve3D>>;
    async duplicate(item: visual.Item | visual.CurveEdge): Promise<visual.Item> {
        // @ts-expect-error('typescript cant type polymorphism like this')
        const result = await this.db.duplicate(item);
        this.version2name.set(result.simpleName, result.simpleName);
        return result;
    }

    async replaceWithTemporaryItem(from: visual.Item, to: c3d.Item): Promise<TemporaryObject> {
        const { name2stack, version2name } = this;
        const name = version2name.get(from.simpleName)!;

        switch (this.stateOf(from)) {
            case 'premodified':
                const modifiers = name2stack.get(name)!;
                return modifiers.updateTemporary(from, to as c3d.Solid);
            case 'unmodified':
                return this.db.replaceWithTemporaryItem(from, to);
            default: throw new Error("invalid state");
        }
    }

    optimization<T>(from: visual.Item, fast: () => T, ifDisallowed: () => T): T {
        switch (this.stateOf(from as visual.Solid)) {
            case 'unmodified': return fast();
            default: return ifDisallowed();
        }
    }

    stateOf(item: visual.Item | c3d.SimpleName): 'unmodified' | 'premodified' | 'modified' {
        if (item instanceof visual.Item) item = item.simpleName;

        if (this.getByPremodified(item) !== undefined) return 'premodified';
        else if (this.getByModified(item) !== undefined) return 'modified';
        else return 'unmodified';
    }

    makeTemporary(): SelectionDatabase {
        return this.selection.makeTemporary();
    }

    copy(that: HasSelectedAndHovered) {
        this.selection.copy(that);
    }

    saveToMemento(): ModifierMemento {
        return new ModifierMemento(
            new Map(this.name2stack),
            new Map(this.version2name),
            new Map(this.modified2name),
        );
    }

    restoreFromMemento(m: ModifierMemento) {
        (this.name2stack as ModifierMemento['name2stack']) = new Map(m.name2stack);
        (this.version2name as ModifierMemento['version2name']) = new Map(m.version2name);
        (this.modified2name as ModifierMemento['modified2name']) = new Map(m.modified2name);
    }

    async serialize(): Promise<Buffer> {
        return this.saveToMemento().serialize();
    }

    async deserialize(data: Buffer): Promise<void> {
        this.restoreFromMemento(ModifierMemento.deserialize(data, this.db, this.materials, this.signals));
        this.signals.modifiersLoaded.dispatch();
    }

    validate() {
        const { name2stack, version2name, modified2name, db } = this;
        console.assert([...modified2name.keys()].length <= [...name2stack.keys()].length, "modified2name.keys.length == name2stack.keys.length", modified2name, name2stack);
        for (const [mname, name] of modified2name) {
            const stack = name2stack.get(name)!;
            console.assert(stack !== undefined, "stack should exist for modified item", name, name2stack);
            console.assert(stack.modified.simpleName === mname, "modified2name.key == stack.modified.simpleName", stack.modified.simpleName, mname);
            console.assert(name === version2name.get(stack.premodified.simpleName), "name === version2name.get(stack.premodified.simpleName),", name, stack.premodified.simpleName, version2name);
            console.assert(stack.modifiers.length > 0, "stack.modifiers.length > 0");
        }
        for (const [version, name] of version2name) {
            console.assert(db.lookupItemById(version) !== undefined, "db.lookupItemById(version) !== undefined", version);
        }
    }

    debug() {
        console.group("Modifiers");
        const { name2stack, version2name, modified2name, db } = this;
        console.group("version2name");
        console.table([...version2name].map(([version, name]) => { return { version, name } }));
        console.groupEnd();
        console.group("modified2name");
        console.table([...modified2name].map(([modified, name]) => { return { modified, name } }));
        console.groupEnd();
        console.group("name2stack");
        console.table([...name2stack].map(([name, stack]) => { return { name, premodified: stack.premodified.simpleName, modified: stack.modified.simpleName, modifiers: stack.modifiers.length } }));
        console.groupEnd();
        console.groupEnd();
    }
}

class ModifierSelection extends SelectionProxy {
    constructor(private readonly db: DatabaseLike, private readonly modifiers: ModifierManager, selection: ModifiesSelection) {
        super(selection);
    }

    add(items: Selectable | Selectable[]) {
        if (!Array.isArray(items)) items = [items];
        for (const item of items) {
            if (item instanceof visual.Solid) {
                this.addSolid(item);
            } else if (item instanceof visual.SpaceInstance) {
                this.addCurve(item);
            } else if (item instanceof visual.PlaneInstance) {
                this.addRegion(item);
            } else if (item instanceof visual.Face) {
                this.addFace(item);
            } else if (item instanceof visual.CurveEdge) {
                this.addEdge(item);
            } else throw new Error("invalid type");
        }
    }

    addSolid(solid: visual.Solid) {
        const { modifiers, selection } = this;
        switch (this.stateOf(solid)) {
            case 'unmodified':
                return super.addSolid(solid);
            case 'modified':
                super.addSolid(solid);
                const stack = modifiers.getByModified(solid)!;
                const { premodified } = stack;
                selection.addSolid(premodified);
                return;
            case 'premodified': {
                const stack = modifiers.getByPremodified(solid)!;
                if (stack.modified === stack.premodified)
                    selection.addSolid(solid);
                else
                    this.addSolid(stack.modified);
            }
        }
    }

    removeSolid(solid: visual.Solid) {
        switch (this.stateOf(solid)) {
            case 'unmodified':
            case 'premodified':
                return super.removeSolid(solid);
            case 'modified':
                throw new Error("invalid precondition");
        }
    }

    removeFace(object: visual.Face) {
        const parentItem = object.parentItem;
        switch (this.stateOf(parentItem)) {
            case 'unmodified':
                this.selection.removeFace(object);
                break;
            case 'premodified':
                this.selection.removeFace(object);
                this.unselectModifiedIfNoMoreSelectedTopology(parentItem);
                break;
            case 'modified':
                throw new Error("invalid precondition");
        }
    }

    removeEdge(object: visual.CurveEdge) {
        const parentItem = object.parentItem;
        switch (this.stateOf(parentItem)) {
            case 'unmodified':
                this.selection.removeEdge(object);
                break;
            case 'premodified':
                this.selection.removeEdge(object);
                this.unselectModifiedIfNoMoreSelectedTopology(parentItem);
                break;
            case 'modified':
                throw new Error("invalid precondition");
        }
    }

    private unselectModifiedIfNoMoreSelectedTopology(parentItem: visual.Solid) {
        if (!this.selection.hasSelectedChildren(parentItem)) {
            const stack = this.modifiers.getByPremodified(parentItem)!;
            this.selection.removeSolid(stack.modified);
        }
    }

    private stateOf(solid: visual.Solid | c3d.SimpleName): 'unmodified' | 'premodified' | 'modified' {
        return this.modifiers.stateOf(solid);
    }

    get solids() {
        const { unmodifiedIds, premodifiedIds } = this.groupIds;
        return new ItemSelection<visual.Solid>(this.db, new Set([...unmodifiedIds, ...premodifiedIds]));
    }

    get groupIds(): { unmodifiedIds: Set<c3d.SimpleName>, premodifiedIds: Set<c3d.SimpleName>, modifiedIds: Set<c3d.SimpleName> } {
        const unmodifiedIds = new Set<c3d.SimpleName>();
        const premodifiedIds = new Set<c3d.SimpleName>();
        const modifiedIds = new Set<c3d.SimpleName>();
        for (const id of this.solidIds) {
            if (this.stateOf(id) === 'unmodified') unmodifiedIds.add(id);
            else if (this.stateOf(id) === 'premodified') premodifiedIds.add(id);
            else if (this.stateOf(id) === 'modified') modifiedIds.add(id);
        }
        return { unmodifiedIds, premodifiedIds, modifiedIds };
    }
}