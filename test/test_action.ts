import { expect } from "chai";
import "mocha";
import { Subject } from "rxjs";
import { Reducer, Store } from "../src/index";

describe("Action tests", () => {
    interface GenericState {
        value?: any;
    }
    class Foo {}

    let store: Store<GenericState>;
    let genericAction: Subject<any>;
    let genericReducer: Reducer<GenericState, any>;

    beforeEach(() => {
        store = Store.create({ value: undefined });
        genericAction = new Subject<any>();
        genericReducer = (state, payload) => ({ ...state, value: payload });
        store.addReducer(genericAction, genericReducer);
    });

    it("should not throw an error when an action emits a non-plain object", () => {
        expect(() => genericAction.next(new Foo())).not.to.throw();
    });

    // Should be ok for primitive types
    it("should not throw an error when an action emits a plain object", () => {
        expect(() => genericAction.next({})).not.to.throw();
    });

    it("should not throw an error when an action emits an array", () => {
        expect(() => genericAction.next([])).not.to.throw();
    });

    it("should not throw an error when an action emits a string", () => {
        expect(() => genericAction.next("foobar")).not.to.throw();
    });

    it("should not throw an error when an action emits a number", () => {
        expect(() => genericAction.next(5)).not.to.throw();
    });

    it("should not throw an error when an action emits a boolean", () => {
        expect(() => genericAction.next(false)).not.to.throw();
    });

    it("should not throw an error when an action emits null", () => {
        expect(() => genericAction.next(null)).not.to.throw();
    });

    it("should not throw an error when an action emits undefined", () => {
        expect(() => genericAction.next(undefined)).not.to.throw();
    });
});
