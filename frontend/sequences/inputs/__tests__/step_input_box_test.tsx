jest.mock("../input_unknown", () => ({
  InputUnknown: jest.fn(() => { })
}));

import { StepInputBox } from "../step_input_box";
import { DeepPartial } from "redux";
import { StepInputProps } from "../../interfaces";
import { InputUnknown } from "../input_unknown";

describe("StepInputBox", () => {
  it("handles unknown `field` via <InputUnknown/>", () => {
    const props: DeepPartial<StepInputProps> = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field: ("something else" as any)
    };
    StepInputBox(props as StepInputProps);
    expect(InputUnknown).toHaveBeenCalledWith(props);
  });
});
