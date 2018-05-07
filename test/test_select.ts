import "mocha";
import { expect } from "chai";
import { skip, take, toArray } from "rxjs/operators";
import { Store, Action, Reducer } from "../src/index";

import { ExampleState } from "./test_common_types";

describe("Store .select() and .watch() tests", () => {

    let store: Store<ExampleState>;
    let incrementAction: Action<void>;
    let incrementReducer: Reducer<ExampleState, void>;
    let mergeAction: Action<Partial<ExampleState>>;
    let noChangesAction: Action<void>;
    let shallowCopyAction: Action<void>;

    const mergeReducer = (state, patch) => {
        const newState: ExampleState = {
            ...state,
            someArray: patch.someArray ? [...state.someArray, ...patch.someArray] : state.someArray,
            someObject: patch.someObject ? { ...state.someObject, ...patch.someObject } : state.someObject
        }
        return newState;
    }
    const noChangesReducer = state => state;
    const shallowCopyReducer = (state) => ({ ...state });

    const initialState = Object.freeze({
        counter: 0,
        message: "initialMessage",
        bool: false,
        someArray: ["Apple", "Banana", "Cucumber"],
        someObject: {
            foo: "bar"
        }
    });

    beforeEach(() => {

        store = Store.create(initialState);
        incrementAction = new Action<void>();
        incrementReducer = (state) => ({ ...state, counter: state.counter + 1 });
        store.addReducer(incrementAction, incrementReducer);

        mergeAction = new Action<Partial<ExampleState>>();
        store.addReducer(mergeAction, mergeReducer);
        noChangesAction = new Action<void>();
        store.addReducer(noChangesAction, noChangesReducer);
        shallowCopyAction = new Action<void>();
        store.addReducer(shallowCopyAction, shallowCopyReducer);
    });

    afterEach(() => {
        store.destroy();
    })

    describe("select(): ", () => {

        it("should emit a state change on select", done => {
            store.select().pipe(skip(1), take(1)).subscribe(state => {
                expect(state.counter).to.equal(1);
                done();
            });
            incrementAction.next();
        });

        it("should use the identity function as default if no selector function is passed", done => {
            store.select().pipe(skip(1), take(1)).subscribe(state => {
                expect(state).to.be.an("Object");
                expect(state.counter).not.to.be.undefined;
                done();
            })

            incrementAction.next();
        })

        it("should immediately emit the last-emitted (might be initial) state when subscription happens", done => {
            store.select().pipe(take(1)).subscribe(state => {
                expect(state.counter).to.equal(0);
                done();
            })
        })

        it("should emit the last state immediately when selecting when its not initial state", done => {
            incrementAction.next();

            store.select().pipe(take(1)).subscribe(state => {
                expect(state.counter).to.equal(1);
                done();
            })
        })

        it("should emit a state change when the state changes, even when the selector result is shallow-equal to the previous value", done => {
            store.select(state => state.message).pipe(skip(1), take(1)).subscribe(msg => {
                expect(msg).to.equal(initialState.message);
                done();
            });
            incrementAction.next();
        })
    });

    describe(".watch(): ", () => {

        it("should not emit a state change for .watch() when the reducer returns the unmofified, previous state or a shallow copy of it", done => {
            store.watch().pipe(skip(1), toArray()).subscribe(state => {
                expect(state.length).to.equal(0);
                done();
            })

            noChangesAction.next();
            shallowCopyAction.next();
            store.destroy();
        })
        it(".watch() should not emit a state change when a the state changes but not the selected value", done => {
            store.watch(state => state.counter).pipe(skip(1), toArray()).subscribe(state => {
                expect(state.length).to.equal(0);
                done();
            })

            noChangesAction.next();
            shallowCopyAction.next();
            store.destroy();
        })

        it(".watch() should emit a state change when a primitive type in a selector changes", done => {
            store.watch(state => state.counter).pipe(skip(1), toArray()).subscribe(state => {
                expect(state.length).to.equal(1);
                done();
            })

            incrementAction.next();
            store.destroy();
        })

        it(".watch() should emit a state change when an array is changed immutably", done => {
            store.watch(state => state.someArray).pipe(skip(1), take(1)).subscribe(state => {
                expect(state).to.deep.equal([...initialState.someArray, "Dades"]);
                done();
            })

            mergeAction.next({ someArray: ["Dades"] });
        })

        it(".watch() should emit a state change when an object is changed immutably", done => {
            store.watch(state => state.someObject).pipe(skip(1), take(1)).subscribe(state => {
                expect(state).to.deep.equal({ ...initialState.someObject, foo: "foo" });
                done();
            })

            mergeAction.next({ someObject: { foo: "foo" } });
        })
    })
})