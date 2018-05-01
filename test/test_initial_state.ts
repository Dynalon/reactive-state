import "mocha";
import { expect } from "chai";
import { range } from "rxjs";
import { take, skip } from "rxjs/operators";

import { Store, Action, Reducer } from "../src/index";
import { RootState, SliceState, GenericState, CounterState } from "./test_common_types";

describe("initial state setting", () => {

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

    // justification: Slices can have any type like "number" etc., so makes no sense to initialize with {}
    it("should accept an initial state of undefined and create and empty object as initial root state", done => {
        const store = Store.create<object>();

        store.select().pipe(take(1)).subscribe(state => {
            expect(state).to.be.an("Object");
            expect(Object.getOwnPropertyNames(state)).to.have.lengthOf(0);
            done();
        })
    })

    it("should accept an initial state of undefined and use undefined as initial state", done => {
        const sliceStore = store.createSlice("slice", undefined);

        sliceStore.select().pipe(take(1)).subscribe(initialState => {
            expect(initialState).to.be.undefined;
            done();
        })
    })

    it("should accept an initial state object when creating a slice", () => {

        const sliceStore = store.createSlice("slice", { foo: "bar" });

        sliceStore.select().pipe(take(1)).subscribe(slice => {
            expect(slice).to.be.an("Object");
            expect(Object.getOwnPropertyNames(slice)).to.deep.equal(["foo"]);
            expect(slice!.foo).to.equal("bar");
        })
    })

    it("should set the initial state for a slice-of-a-slice on the sliced state", done => {
        const sliceStore = store.createSlice("slice", { foo: "bar" }) as Store<SliceState>

        store.select(s => s, true).pipe(skip(1)).subscribe(s => {
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
        expect(() => genericStore.createSlice("value", undefined, <SliceState>new Foo())).to.throw();
    })

    it("should allow primitive types, plain object and array as initial state for root store creation", () => {
        expect(() => Store.create(null)).not.to.throw();
        expect(() => Store.create(undefined)).not.to.throw();
        expect(() => Store.create("foobar")).not.to.throw();
        expect(() => Store.create(5)).not.to.throw();
        expect(() => Store.create(false)).not.to.throw();
        expect(() => Store.create({})).not.to.throw();
        expect(() => Store.create([])).not.to.throw();
        expect(() => Store.create(Symbol())).not.to.throw();
    })

    it("should allow primitive types, plain object and array as initial state for slice store creation", () => {
        expect(() => genericStore.createSlice("value", null)).not.to.throw();
        expect(() => genericStore.createSlice("value", undefined)).not.to.throw();
        expect(() => genericStore.createSlice("value", "foobar")).not.to.throw();
        expect(() => genericStore.createSlice("value", 5)).not.to.throw();
        expect(() => genericStore.createSlice("value", false)).not.to.throw();
        expect(() => genericStore.createSlice("value", {})).not.to.throw();
        expect(() => genericStore.createSlice("value", [])).not.to.throw();
        expect(() => genericStore.createSlice("value", Symbol())).not.to.throw();
    })

    it("should allow primitive types, plain object and array as cleanup state for slice store creation", () => {
        expect(() => genericStore.createSlice("value", undefined, null)).not.to.throw();
        expect(() => genericStore.createSlice("value", undefined, undefined)).not.to.throw();
        expect(() => genericStore.createSlice("value", undefined, "foobar")).not.to.throw();
        expect(() => genericStore.createSlice("value", undefined, 5)).not.to.throw();
        expect(() => genericStore.createSlice("value", undefined, false)).not.to.throw();
        expect(() => genericStore.createSlice("value", undefined, {})).not.to.throw();
        expect(() => genericStore.createSlice("value", undefined, [])).not.to.throw();
        expect(() => genericStore.createSlice("value", undefined, Symbol())).not.to.throw();
    })

    it("does clone the initialState object when creating the root store, so changes to it can not be noticed outside the store", done => {
        const initialState: CounterState = Object.freeze({
            counter: 0
        })

        const store = Store.create(initialState);
        const counterAction = new Action<number>();
        const counterReducer: Reducer<CounterState, number> = (state, payload = 1) => {
            // WARNING this is not immutable and should not be done in production code
            // we just do it here for the test...
            state.counter++;
            return state;
        }

        store.addReducer(counterAction, counterReducer);
        counterAction.next();

        store.select().subscribe(s => {
            expect(initialState.counter).to.equal(0);
            done();
        });
    });

    it("should create an immutable copy of the initialState object when creating a slice store, so changes to it can not be noticed outside the slice", done => {
        const initialState: CounterState = Object.freeze({
            counter: 0
        })
        const store = Store.create(initialState);
        const counterAction = new Action<number>();
        const counterReducer: Reducer<number, number> = (state, payload = 1) => state + payload;

        const slice = store.createSlice("counter");
        slice.addReducer(counterAction, counterReducer);
        counterAction.next();

        slice.select().pipe(take(2)).subscribe(s => {
            expect(initialState.counter).to.equal(0);
            done();
        });

    })

    it("should be possible to create a lot of nested slices", done => {
        const nestingLevel = 100;
        const rootStore = Store.create<SliceState>({ foo: "0", slice: undefined });

        let currentStore: Store<SliceState> = rootStore;
        range(1, nestingLevel).subscribe(n => {
            const nestedStore = currentStore.createSlice("slice", { foo: n.toString() });
            nestedStore.select().pipe(take(1)).subscribe(state => {
                expect(state!.foo).to.equal(n.toString());
            });
            currentStore = nestedStore as Store<SliceState>;
        }, undefined, done);
    })


    it("should trigger a state change on the root store when the initial state on the slice is created", done => {
        store.select(s => s, true).pipe(skip(1), take(1)).subscribe(state => {
            expect(state.slice).not.to.be.undefined;
            expect(state.slice).to.have.property("foo");
            if (state.slice) {
                expect(state.slice.foo).to.equal("bar");
                done();
            }
        })

        store.createSlice("slice", { foo: "bar" });
    });

    it("should overwrite an initial state on the slice if the slice key already has a value", done => {
        const sliceStore = store.createSlice("slice", { foo: "bar" });
        sliceStore.destroy();
        const sliceStore2 = store.createSlice("slice", { foo: "different" });
        sliceStore2.select().subscribe(state => {
            expect(state!.foo).to.equal("different");
            done();
        })
    })

    it("should set the state to the cleanup value undefined but keep the property on the object, when the slice store is destroyed for case 'undefined'", done => {
        const sliceStore = store.createSlice("slice", { foo: "bar" }, "undefined");
        sliceStore.destroy();

        store.select().subscribe(state => {
            expect(state.hasOwnProperty('slice')).to.equal(true);
            expect(state.slice).to.be.undefined;
            done();
        })
    })

    it("should remove the slice property on parent state altogether when the slice store is destroyed for case 'delete'", done => {
        const sliceStore = store.createSlice("slice", { foo: "bar" }, "delete");
        sliceStore.destroy();

        store.select().subscribe(state => {
            expect(state.hasOwnProperty('slice')).to.equal(false);
            expect(Object.getOwnPropertyNames(state)).to.deep.equal([]);
            done();
        })
    })

    it("should set the state to the cleanup value when the slice store is unsubscribed for case null", done => {
        const sliceStore = store.createSlice("slice", { foo: "bar" }, null);
        sliceStore.destroy();

        store.select().subscribe(state => {
            expect(state.slice).to.be.null;
            done();
        })
    })

    it("should set the state to the cleanup value when the slice store is unsubscribed for case any object", done => {
        const sliceStore = store.createSlice("slice", { foo: "bar" }, { foo: "baz" });
        sliceStore.destroy();

        store.select().subscribe(state => {
            expect(state.slice).to.be.deep.equal({ foo: "baz" });
            done();
        })
    })
});