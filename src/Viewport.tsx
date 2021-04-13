import { render } from 'preact';
import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { Editor } from './Editor';
import { Pane } from './Pane';
import { ViewportSelector } from './selection/ViewportSelector';
import { PlaneSnap } from "./SnapManager";
import { Solid, SpaceItem, TopologyItem } from "./VisualModel";

const near = 0.01;
const far = 1000;
const frustumSize = 20;

export interface Viewport {
    renderer: THREE.Renderer;
    camera: THREE.Camera;
    constructionPlane: PlaneSnap;
    enableControls(): void;
    disableControls(): void;
    overlay: THREE.Scene;
}

export default (editor: Editor) => {
    // FIXME rename
    class Viewport extends HTMLElement implements Viewport {
        readonly camera: THREE.Camera;
        readonly overlay = new THREE.Scene();
        readonly renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
        readonly navigationControls?: OrbitControls;
        readonly selector: ViewportSelector;
        readonly constructionPlane: PlaneSnap;
        readonly composer: EffectComposer;
        readonly outlinePassSelection: OutlinePass;
        readonly outlinePassHover: OutlinePass;
        readonly controls = new Set<{ enabled: boolean }>();
        readonly grid = new THREE.GridHelper(300, 300, 0x666666, 0x666666);
        
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });

            let camera: THREE.Camera;
            const view = this.getAttribute("view");
            const aspect = this.offsetWidth / this.offsetHeight;
            const orthographicCamera = new THREE.OrthographicCamera(-frustumSize / 2, frustumSize / 2, frustumSize / 2, -frustumSize / 2, near, far);
            const perspectiveCamera = new THREE.PerspectiveCamera(frustumSize, aspect, near, far);
            const domElement = this.renderer.domElement;
            let n: THREE.Vector3;
            switch (view) {
                case "3d":
                    camera = perspectiveCamera;
                    camera.position.set(-5, 15, 5);
                    this.navigationControls = new OrbitControls(camera, domElement);
                    n = new THREE.Vector3(0, 0, 1);
                    break;
                case "top":
                    camera = orthographicCamera;
                    camera.position.set(0, 0, 10);
                    n = new THREE.Vector3(0, 0, 1);
                    break;
                case "front":
                    camera = orthographicCamera;
                    camera.position.set(0, 10, 0);
                    n = new THREE.Vector3(0, 1, 0);
                    break;
                case "right":
                    camera = orthographicCamera;
                    camera.position.set(10, 0, 0);
                    n = new THREE.Vector3(1, 0, 0);
                    break;
            }
            this.constructionPlane = new PlaneSnap(n);
            this.grid.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), n);
            this.grid.renderOrder = -1;

            camera.up.set(0, 0, 1);
            camera.lookAt(new THREE.Vector3());
            this.camera = camera;
            this.selector = new ViewportSelector(editor.db.drawModel, camera, this.renderer.domElement);

            this.renderer.setPixelRatio(window.devicePixelRatio);
            const size = this.renderer.getSize(new THREE.Vector2());
            const renderTarget = new THREE.WebGLMultisampleRenderTarget(size.width, size.height, { format: THREE.RGBFormat });
            renderTarget.samples = 8;

            this.composer = new EffectComposer(this.renderer, renderTarget);
            this.composer.setPixelRatio(window.devicePixelRatio);

            const renderPass = new RenderPass(editor.db.scene, this.camera);
            const overlayPass = new RenderPass(this.overlay, this.camera);
            const helpersPass = new RenderPass(editor.helpers.scene, this.camera);
            const copyPass = new ShaderPass(CopyShader);

            overlayPass.clear = false;
            overlayPass.clearDepth = true;
            helpersPass.clear = false;
            helpersPass.clearDepth = true;

            const outlinePassSelection = new OutlinePass(new THREE.Vector2(this.offsetWidth, this.offsetHeight), editor.db.scene, this.camera);
            outlinePassSelection.edgeStrength = 10;
            outlinePassSelection.edgeGlow = 0;
            outlinePassSelection.edgeThickness = 2.0;
            outlinePassSelection.visibleEdgeColor.setHex(0xfffff00);
            this.outlinePassSelection = outlinePassSelection;

            const outlinePassHover = new OutlinePass(new THREE.Vector2(this.offsetWidth, this.offsetHeight), editor.db.scene, this.camera);
            outlinePassHover.edgeStrength = 10;
            outlinePassHover.edgeGlow = 0;
            outlinePassHover.edgeThickness = 2.0;
            outlinePassHover.visibleEdgeColor.setHex(0xfffffff);
            this.outlinePassHover = outlinePassHover;

            this.composer.addPass(renderPass);
            this.composer.addPass(this.outlinePassHover);
            this.composer.addPass(this.outlinePassSelection);
            this.composer.addPass(overlayPass);
            this.composer.addPass(helpersPass);
            this.composer.addPass(copyPass);

            this.shadowRoot!.append(domElement);
            render(<slot></slot>, this.shadowRoot!)

            this.outlineSelection = this.outlineSelection.bind(this);
            this.outlineHover = this.outlineHover.bind(this);
            this.resize = this.resize.bind(this);
            this.render = this.render.bind(this);
            this.setNeedsRender = this.setNeedsRender.bind(this);

            if (this.navigationControls) this.controls.add(this.navigationControls)
            this.controls.add(this.selector);

            this.render();
        }

        connectedCallback() {
            editor.viewports.push(this);

            const scene = editor.db.scene;

            const pane = this.parentElement as Pane;
            pane.signals.flexScaleChanged.add(this.resize);
            editor.signals.windowLoaded.add(this.resize);
            editor.signals.windowResized.add(this.resize);

            editor.signals.objectSelected.add(this.outlineSelection);
            editor.signals.objectDeselected.add(this.outlineSelection);
            editor.signals.objectHovered.add(this.outlineHover);

            editor.signals.objectSelected.add(this.setNeedsRender);
            editor.signals.objectDeselected.add(this.setNeedsRender);
            editor.signals.sceneGraphChanged.add(this.setNeedsRender);
            editor.signals.factoryUpdated.add(this.setNeedsRender);
            editor.signals.pointPickerChanged.add(this.setNeedsRender);
            editor.signals.objectHovered.add(this.setNeedsRender);
            editor.signals.objectAdded.add(this.setNeedsRender);

            scene.fog = new THREE.Fog(0x424242, 1, 100);

            this.navigationControls?.addEventListener('change', this.setNeedsRender);
            this.selector.signals.clicked.add((intersections) => editor.selection.onClick(intersections));
            this.selector.signals.hovered.add((intersections) => editor.selection.onPointerMove(intersections));
        }

        private needsRender = true;
        private setNeedsRender() {
            this.needsRender = true;
        }

        render() {
            requestAnimationFrame(this.render);
            if (!this.needsRender) return;

            editor.materials.setResolution(this.offsetWidth, this.offsetHeight);

            editor.helpers.update(this.camera);

            editor.db.scene.add(this.grid);
            this.composer.render();
            editor.db.scene.remove(this.grid);

            this.needsRender = false;
        }

        outlineSelection() {
            const selectionManager = editor.selection;
            const toOutline = [...selectionManager.selectedSolids].map((item) => item.faces);
            this.outlinePassSelection.selectedObjects = toOutline;
        }

        outlineHover(object?: SpaceItem | TopologyItem) {
            if (object == null) this.outlinePassHover.selectedObjects = [];
            else if (object instanceof Solid) this.outlinePassHover.selectedObjects = [object.faces];
        }

        resize() {
            const aspect = this.offsetWidth / this.offsetHeight;
            if (this.camera instanceof THREE.PerspectiveCamera) {
                this.camera.aspect = aspect;
                this.camera.updateProjectionMatrix();
            } else if (this.camera instanceof THREE.OrthographicCamera) {
                this.camera.left = frustumSize * aspect / - 2;
                this.camera.right = frustumSize * aspect / 2;
                this.camera.updateProjectionMatrix();
            }

            this.renderer.setSize(this.offsetWidth, this.offsetHeight);
            this.composer.setSize(this.offsetWidth, this.offsetHeight);
            this.setNeedsRender();
        }

        disableControls() {
            for (var control of this.controls) {
                control.enabled = false;
            }
        }

        enableControls() {
            for (var control of this.controls) {
                control.enabled = true;
            }
        }
    }

    customElements.define('ispace-viewport', Viewport);
}