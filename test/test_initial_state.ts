import "mocha";
import { expect } from "chai";
import { Observable } from "rxjs/Rx";

import { Store, Action, Reducer } from "../dist/index";

import { RootState, SliceState, GenericState, CounterState } from "./test_common_types";

describe("initial state chaining", () => {

    class Foo { };
    let store: Store<RootState>;
    let genericStore: Store<GenericState>
    let genericAction: Action<any>;
    const genericReducer: Reducer<GenericState, any> = (state, payload) => ({ ...state, value: payload });

    beforeEach(() => {
        store = Store.create<RootState>();
        genericStore = Store.create();
        genericAction = new Action<any>();
        genericStore.addReducer(genericAction, genericReducer);
    })

    it("should accept an initial state of undefined and create and empty object as root state", done => {
        const store = Store.create<object>();

        store.select().take(1).subscribe(state => {
            expect(state).to.be.an("Object");
            expect(Object.getOwnPropertyNames(state)).to.have.lengthOf(0);
            done();
        })
    })

    it("should accept an initial state object when creating a slice", () => {

        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" });

        sliceStore.select(s => s).take(1).subscribe(slice => {
            expect(slice).to.be.an("Object");
            expect(Object.getOwnPropertyNames(slice)).to.deep.equal(["foo"]);
            expect(slice.foo).to.equal("bar");
        })
    })

    it("should set the initial state for a slice of a slice on the sliced state", done => {
        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" });

        store.select(s => s).skip(1).subscribe(s => {
            if (!s.slice || !s.slice.slice) {
                done("Error");
                return;
            }
            expect(s.slice.slice.foo).to.equal("baz");
            expect(Object.getOwnPropertyNames(s.slice)).to.deep.equal(["foo", "slice"]);
            expect(Object.getOwnPropertyNames(s.slice.slice)).to.deep.equal(["foo"]);
            done();
        })

        sliceStore.createSlice("slice", { foo: "baz" });
    })

    it("should not allow non-plain objects for the root store creation as initialState", () => {
        expect(() => Store.create(new Foo())).to.throw();
    })

    it("should not allow non-plain objects for the slice store as initialState", () => {
        expect(() => genericStore.createSlice("value", new Foo())).to.throw();
    })

    it("should not allow non-plain objects for the slice store as cleanupState", () => {
        // we have to trick TypeScript compiler for this test
        expect(() => genericStore.createSlice<SliceState>("value", undefined, <SliceState>new Foo())).to.throw();
    })

    it("should allow primitive types, plain object and array as initial state for root store creation", () => {
        expect(() => Store.create(null)).not.to.throw;
        expect(() => Store.create(undefined)).not.to.throw;
        expect(() => Store.create("foobar")).not.to.throw;
        expect(() => Store.create(5)).not.to.throw;
        expect(() => Store.create(false)).not.to.throw;
        expect(() => Store.create({})).not.to.throw;
        expect(() => Store.create([])).not.to.throw;
    })

    it("should allow primitive types, plain object and array as initial state for slice store creation", () => {
        expect(() => genericStore.createSlice("value", null)).not.to.throw;
        expect(() => genericStore.createSlice("value", undefined)).not.to.throw;
        expect(() => genericStore.createSlice("value", "foobar")).not.to.throw;
        expect(() => genericStore.createSlice("value", 5)).not.to.throw;
        expect(() => genericStore.createSlice("value", false)).not.to.throw;
        expect(() => genericStore.createSlice("value", {})).not.to.throw;
        expect(() => genericStore.createSlice("value", [])).not.to.throw;
    })

    it("should allow primitive types, plain object and array as cleanup state for slice store creation", () => {
        expect(() => genericStore.createSlice("value", undefined, null)).not.to.throw;
        expect(() => genericStore.createSlice("value", undefined, undefined)).not.to.throw;
        expect(() => genericStore.createSlice("value", undefined, "foobar")).not.to.throw;
        expect(() => genericStore.createSlice("value", undefined, 5)).not.to.throw;
        expect(() => genericStore.createSlice("value", undefined, false)).not.to.throw;
        expect(() => genericStore.createSlice("value", undefined, {})).not.to.throw;
        expect(() => genericStore.createSlice("value", undefined, [])).not.to.throw;
    })

    it("should not modify the original initialState object when creating the root store", done => {
        const initialState: CounterState = {
            counter: 0
        }

        const store = Store.create(initialState);
        const counterAction = new Action<number>();
        const counterReducer: Reducer<CounterState, number> =
            (state, payload = 1) => ({ ...state, counter: state.counter });

        store.addReducer(counterAction, counterReducer);
        counterAction.next();

        store.select(s => s).subscribe(s => {
            expect(initialState.counter).to.equal(0);
            done();
        });
    });

    it("should not modify the original initialState object when creating a slice store", done => {
        const initialState: CounterState = {
            counter: 0
        }
        const store = Store.create(initialState);
        const counterAction = new Action<number>();
        const counterReducer: Reducer<number, number> =
            (state, payload = 1) => state + payload;

        const slice = store.createSlice("counter");
        slice.addReducer(counterAction, counterReducer);
        counterAction.next();

        slice.select(s => s).take(2).subscribe(s => {
            expect(initialState.counter).to.equal(0);
            done();
        });

    })

    it("should be possible to create a lot of nested slices", done => {
        const nestingLevel = 100;
        const rootStore = Store.create<SliceState>({ foo: "0", slice: undefined });

        let currentStore = rootStore;
        Observable.range(1, nestingLevel).subscribe(n => {
            const nestedStore = currentStore.createSlice<SliceState>("slice", { foo: n.toString() });
            nestedStore.select(s => s).take(1).subscribe(state => {
                expect(state.foo).to.equal(n.toString());
            });
            currentStore = nestedStore;
        }, undefined, done);
    })


    it("should trigger a state change on the root store when the initial state on the slice is created", done => {
        store.select(s => s).skip(1).take(1).subscribe(state => {
            expect(state.slice).not.to.be.undefined;
            expect(state.slice).to.have.property("foo");
            if (state.slice) {
                expect(state.slice.foo).to.equal("bar");
                done();
            }
        })

        store.createSlice("slice", { foo: "bar" });
    });

    it("should set the state to the cleanup value when the slice store is unsubscribed for case 'undefined'", done => {
        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" }, "undefined");
        sliceStore.destroy();

        store.select(s => s).subscribe(state => {
            expect(Object.getOwnPropertyNames(state)).to.deep.equal([]);
            done();
        })
    })

    it("should set the state to the cleanup value when the slice store is unsubscribed for case null", done => {
        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" }, null);
        sliceStore.destroy();

        store.select(s => s).subscribe(state => {
            expect(state.slice).to.be.null;
            done();
        })
    })

    it("should set the state to the cleanup value when the slice store is unsubscribed for case any object", done => {
        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" }, { foo: "baz" });
        sliceStore.destroy();

        store.select(s => s).subscribe(state => {
            expect(state.slice).to.be.deep.equal({ foo: "baz" });
            done();
        })
    })
});