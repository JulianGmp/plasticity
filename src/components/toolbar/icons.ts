import Command from '../../command/Command';
import * as like from '../../commands/CommandLike';
import * as cmd from '../../commands/GeometryCommands';
import { Editor } from '../../editor/Editor';

export const tooltips = new Map<typeof Command, string>();
tooltips.set(cmd.MoveCommand, "Move");
tooltips.set(cmd.RotateCommand, "Rotate");
tooltips.set(cmd.ScaleCommand, "Scale");
tooltips.set(cmd.FilletSolidCommand, "Fillet");
tooltips.set(cmd.BooleanCommand, "Boolean");
tooltips.set(cmd.CutCommand, "Cut solid with curve");
tooltips.set(cmd.OffsetFaceCommand, "Offset face");
tooltips.set(cmd.DraftSolidCommand, "Draft solid");
tooltips.set(cmd.DeleteCommand, "Delete");
tooltips.set(cmd.ActionFaceCommand, "Move face");
tooltips.set(cmd.CurveCommand, "Curve");
tooltips.set(cmd.SphereCommand, "Sphere");
tooltips.set(cmd.CenterCircleCommand, "Center and radius circle");
tooltips.set(cmd.TwoPointCircleCommand, "Two-point circle");
tooltips.set(cmd.ThreePointCircleCommand, "Three-point circle");
tooltips.set(cmd.CenterPointArcCommand, "Center-point arc");
tooltips.set(cmd.ThreePointArcCommand, "Three-point arc");
tooltips.set(cmd.CenterEllipseCommand, "Center ellipse");
tooltips.set(cmd.ThreePointEllipseCommand, "Three-point ellipse");
tooltips.set(cmd.PolygonCommand, "Regular polygon");
tooltips.set(cmd.LineCommand, "Line");
tooltips.set(cmd.ThreePointRectangleCommand, "Three point rectangle");
tooltips.set(cmd.CornerRectangleCommand, "Corner rectangle");
tooltips.set(cmd.CenterRectangleCommand, "Center rectangle");
tooltips.set(cmd.CylinderCommand, "Cylinder");
tooltips.set(cmd.ThreePointBoxCommand, "Three point Box");
tooltips.set(cmd.CornerBoxCommand, "Corner box");
tooltips.set(cmd.CenterBoxCommand, "Center box");
tooltips.set(cmd.LoftCommand, "Loft");
tooltips.set(cmd.MirrorCommand, "Mirror");
tooltips.set(cmd.JoinCurvesCommand, "Join curves");
tooltips.set(cmd.ExtrudeCommand, "Extrude");
tooltips.set(cmd.SpiralCommand, "Spiral");
tooltips.set(cmd.CharacterCurveCommand, "Custom function");
tooltips.set(cmd.TrimCommand, "Cut off line segments at intersections of curves");
tooltips.set(cmd.OffsetCurveCommand, "Offset Loop");
tooltips.set(cmd.BridgeCurvesCommand, "Bridge two curves");
tooltips.set(cmd.RevolutionCommand, "Revolve");
tooltips.set(cmd.EvolutionCommand, "Sweep");
tooltips.set(cmd.PipeCommand, "Pipe");
tooltips.set(cmd.ModifyContourCommand, "ModifyCurve");
tooltips.set(cmd.ShellCommand, "Shell (thicken) solid or stroke (thicken) curve");
tooltips.set(cmd.RadialArrayCommand, "Radial array");
tooltips.set(cmd.ExtensionShellCommand, "Extend face");
tooltips.set(cmd.DuplicateCommand, "Duplicate object");
tooltips.set(cmd.SlotCommand, "Create a hole");
tooltips.set(cmd.PlaceCommand, "Place solid or curve");

export const keybindings = new Map<string, string>();
keybindings.set("gizmo:move:x", "X axis");
keybindings.set("gizmo:move:y", "Y axis");
keybindings.set("gizmo:move:z", "Z axis");
keybindings.set("gizmo:move:xy", "Z plane");
keybindings.set("gizmo:move:yz", "X plane");
keybindings.set("gizmo:move:xz", "Y plane");
keybindings.set("gizmo:move:screen", "Screen space");
keybindings.set("keyboard:move:free", "Freestyle");
keybindings.set("keyboard:move:pivot", "Pivot");
keybindings.set("gizmo:rotate:x", "X axis");
keybindings.set("gizmo:rotate:y", "Y axis");
keybindings.set("gizmo:rotate:z", "Z axis");
keybindings.set("gizmo:rotate:screen", "Screen space");
keybindings.set("keyboard:rotate:free", "Freestyle");
keybindings.set("keyboard:rotate:pivot", "Pivot");
keybindings.set("gizmo:scale:x", "X axis");
keybindings.set("gizmo:scale:y", "Y axis");
keybindings.set("gizmo:scale:z", "Z axis");
keybindings.set("gizmo:scale:xy", "Z plane");
keybindings.set("gizmo:scale:yz", "X plane");
keybindings.set("gizmo:scale:xz", "Y plane");
keybindings.set("gizmo:scale:xyz", "Uniform");
keybindings.set("keyboard:scale:free", "Freestyle");
keybindings.set("keyboard:scale:pivot", "Pivot");
keybindings.set("command:abort", "Abort");
keybindings.set("command:finish", "Finish");
keybindings.set("gizmo:curve:line-segment", "Line segment");
keybindings.set("gizmo:curve:arc", "Arc");
keybindings.set("gizmo:curve:polyline", "Polyline");
keybindings.set("gizmo:curve:nurbs", "NURBS");
keybindings.set("gizmo:curve:hermite", "Hermite");
keybindings.set("gizmo:curve:bezier", "Bezier");
keybindings.set("gizmo:curve:cubic-spline", "Cubic spline");
keybindings.set("gizmo:curve:undo", "Undo");
keybindings.set("gizmo:line:undo", "Undo");
keybindings.set("gizmo:fillet-solid:add", "Add variable fillet point");
keybindings.set("gizmo:fillet-solid:distance", "Distance");
keybindings.set("gizmo:fillet-solid:fillet", "Fillet distance");
keybindings.set("gizmo:fillet-solid:chamfer", "Chamfer distance");
keybindings.set("gizmo:fillet-solid:angle", "Chamfer angle");
keybindings.set("gizmo:circle:mode", "Toggle vertical/horizontal");
keybindings.set("keyboard:rectangle:mode", "Toggle center/corner");
keybindings.set("gizmo:polygon:add-vertex", "Add a vertex");
keybindings.set("gizmo:polygon:subtract-vertex", "Subtract a vertex");
keybindings.set("gizmo:polygon:mode", "Toggle vertical/horizontal");
keybindings.set("gizmo:array:add", "Add copy");
keybindings.set("gizmo:array:subtract", "Subtract copy");
keybindings.set("gizmo:pipe:add-vertex", "Add a vertex");
keybindings.set("gizmo:pipe:subtract-vertex", "Subtract a vertex");
keybindings.set("gizmo:pipe:thickness", "Thickness");
keybindings.set("gizmo:pipe:section-size", "Section size");
keybindings.set("gizmo:pipe:angle", "Angle");
keybindings.set("gizmo:spiral:angle", "Angle");
keybindings.set("gizmo:spiral:radius", "Radius");
keybindings.set("gizmo:spiral:length", "Length");
keybindings.set("gizmo:extrude:race1", "Angle 1");
keybindings.set("gizmo:extrude:distance1", "Distance 1");
keybindings.set("gizmo:extrude:race2", "Angle 2");
keybindings.set("gizmo:extrude:distance2", "Distance 2");
keybindings.set("gizmo:extrude:thickness", "Thickness");
keybindings.set("gizmo:boolean:union", "Union");
keybindings.set("gizmo:boolean:difference", "Difference");
keybindings.set("gizmo:boolean:intersect", "Intersect");
keybindings.set("keyboard:extrude:union", "Union");
keybindings.set("keyboard:extrude:difference", "Difference");
keybindings.set("keyboard:extrude:intersect", "Intersect");
keybindings.set("keyboard:extrude:new-body", "New body");
keybindings.set("keyboard:pipe:union", "Union");
keybindings.set("keyboard:pipe:difference", "Difference");
keybindings.set("keyboard:pipe:intersect", "Intersect");
keybindings.set("keyboard:pipe:new-body", "New body");
keybindings.set("keyboard:sphere:union", "Union");
keybindings.set("keyboard:sphere:difference", "Difference");
keybindings.set("keyboard:sphere:intersect", "Intersect");
keybindings.set("keyboard:sphere:new-body", "New body");
keybindings.set("keyboard:box:union", "Union");
keybindings.set("keyboard:box:difference", "Difference");
keybindings.set("keyboard:box:intersect", "Intersect");
keybindings.set("keyboard:box:new-body", "New body");
keybindings.set("keyboard:cylinder:union", "Union");
keybindings.set("keyboard:cylinder:difference", "Difference");
keybindings.set("keyboard:cylinder:intersect", "Intersect");
keybindings.set("keyboard:cylinder:new-body", "New body");
keybindings.set("gizmo:cylinder:radius", "Radius");
keybindings.set("gizmo:cylinder:height", "Height");
keybindings.set("gizmo:offset-face:distance", "Distance");
keybindings.set("gizmo:offset-face:angle", "Angle adjacent");
keybindings.set("gizmo:offset-face:toggle", "New body");
keybindings.set("gizmo:refillet-face:distance", "Distance");
keybindings.set("gizmo:mirror:x", "Positive X");
keybindings.set("gizmo:mirror:y", "Positive Y");
keybindings.set("gizmo:mirror:z", "Positive Z");
keybindings.set("gizmo:mirror:-x", "Negative X");
keybindings.set("gizmo:mirror:-y", "Negative Y");
keybindings.set("gizmo:mirror:-z", "Negative Z");
keybindings.set("gizmo:mirror:free", "Freestyle");
keybindings.set("gizmo:mirror:pivot", "Pivot");
keybindings.set("gizmo:rebuild:forward", "Go forward in history");
keybindings.set("gizmo:rebuild:backward", "Go backward in history");
keybindings.set("gizmo:modify-contour:fillet-all", "Fillet all");
keybindings.set("gizmo:revolution:angle", "Angle");
keybindings.set("gizmo:revolution:thickness", "Thickness");
keybindings.set("gizmo:evolution:thickness", "Thickness");
keybindings.set("gizmo:pipe:thickness", "Thickness");
keybindings.set("gizmo:offset-curve:distance", "Distance");
keybindings.set("gizmo:place:flip", "Flip");
keybindings.set("gizmo:place:angle", "Angle");
keybindings.set("snaps:set-x", "X axis");
keybindings.set("snaps:set-y", "Y axis");
keybindings.set("snaps:set-z", "Z axis");
keybindings.set("snaps:set-normal", "Normal");
keybindings.set("snaps:set-binormal", "Binormal");
keybindings.set("snaps:set-tangent", "Tangent");
keybindings.set("snaps:set-square", "Square");
keybindings.set("gizmo:shell", "Thickness");

export default (editor: Editor): void => {
    for (const Command of Object.values(cmd)) {
        editor.registry.addOne('plasticity-viewport', `command:${Command.identifier}`, () => {
            const command = new Command(editor);
            command.agent = 'user';
            editor.enqueue(command);
        });
    }

    for (const Command of Object.values(like)) {
        editor.registry.addOne('plasticity-viewport', `command:${Command.identifier}`, () => {
            const command = new Command(editor);
            command.agent = 'user';
            editor.enqueue(command);
        });
    }
}
