import "mocha";
import { expect } from "chai";

import { getNestedProperty } from "../src/store";

describe("getNestedProperty tests", () => {

    it("should return first-level property", () => {
        const obj = {}
        const prop = getNestedProperty(obj, ["level1"]);
        expect(prop).to.be.undefined;
    })

    it("should return first-level property", () => {
        const obj = { level1: {} }
        const prop = getNestedProperty(obj, ["level1"]);
        expect(prop).to.be.ok;
    })

    it("should return undefined for not-defined second-level property", () => {
        const obj = { level1: {} }
        const prop = getNestedProperty(obj, ["level1", "level2"]);
        expect(prop).to.be.undefined;
    })

    // was a regression
    it("should return undefined for not-defined second-level property if keys have same name", () => {
        const obj = { level1: {} }
        const prop = getNestedProperty(obj, ["level1", "level1"]);
        expect(prop).to.be.undefined;
    })
})