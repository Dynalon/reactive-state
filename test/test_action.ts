import "mocha";
import { expect } from "chai";

import { Action } from "../dist/index";

describe("Action tests", () => {

    it("should be possible to create an action without a name", () => {
        const action = new Action();
        expect(action.name).to.be.undefined;
    });

    it("should be possible to create an action with a name", () => {
        const name = "SOME_NAME";
        const action = new Action(name);
        expect(action.name).to.equal(name);
    });

 })