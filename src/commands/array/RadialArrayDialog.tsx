import { render } from 'preact';
import { EditorSignals } from "../../editor/EditorSignals";
import { AbstractDialog } from "../../command/AbstractDialog";
import { ArrayParams } from "./ArrayFactory";

export class RadialArrayDialog extends AbstractDialog<ArrayParams> {
    name = "Radial array";

    constructor(protected readonly params: ArrayParams, signals: EditorSignals) {
        super(signals);
    }

    render() {
        const { step1, num1, degrees, num2, isAlongAxis } = this.params;

        render(
            <>
                <ol>
                    <plasticity-prompt name="Select solids or curves" description="to duplicate"></plasticity-prompt>
                    <plasticity-prompt name="Select center point" description="to orient around"></plasticity-prompt>
                </ol>

                <ul>
                    {/* <li>
                        <label for="isAlongAxis">Is along axis</label>
                        <div class="fields">
                            <input type="checkbox" hidden id="isAlongAxis" name="isAlongAxis" checked={isAlongAxis} onClick={this.onChange}></input>
                            <label for="isAlongAxis">Add tangent edges</label>
                        </div>
                    </li> */}

                    <li>
                        <label for="degrees">Degrees</label>
                        <div class="fields">
                            <plasticity-number-scrubber precision={1} name="degrees" value={degrees} onchange={this.onChange} onscrub={this.onChange} onfinish={this.onChange}></plasticity-number-scrubber>
                        </div>
                    </li>
                    <li>
                        <label for="num2">Number</label>
                        <div class="fields">
                            <plasticity-number-scrubber precision={1} name="num2" value={num2} onchange={this.onChange} onscrub={this.onChange} onfinish={this.onChange}></plasticity-number-scrubber>
                        </div>
                    </li>
                    <li>
                        <label for="step1">Distance</label>
                        <div class="fields">
                            <plasticity-number-scrubber name="step1" value={step1} onchange={this.onChange} onscrub={this.onChange} onfinish={this.onChange}></plasticity-number-scrubber>
                        </div>
                    </li>
                    <li>
                        <label for="num1">Repeat</label>
                        <div class="fields">
                            <plasticity-number-scrubber precision={1} name="num1" value={num1} onchange={this.onChange} onscrub={this.onChange} onfinish={this.onChange}></plasticity-number-scrubber>
                        </div>
                    </li>
                </ul></>, this);
    }
}
customElements.define('plasticity-array-dialog', RadialArrayDialog);
