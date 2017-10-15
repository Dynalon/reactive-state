import "mocha";
import { expect } from "chai";
import { Subscription } from "rxjs/Rx";

import { Store, Action, Reducer } from "../dist/index";

import { CounterState, RootState, SliceState } from "./test_common_types";

describe("Store slicing tests", () => {
    let store: Store<CounterState>;
    let counterStore: Store<number>;
    let incrementAction: Action<void>;
    let incrementReducer: Reducer<number, void>;
    let incrementSubscription: Subscription;

    beforeEach(() => {
        incrementAction = new Action<void>();
        incrementReducer = (state) => state + 1;
        store = Store.create({ counter: 0 });
        counterStore = store.createSlice("counter");
        incrementSubscription = counterStore.addReducer(incrementAction, incrementReducer);
    });

    it("should emit the initial state when subscribing to a freshly sliced store", done => {
        counterStore.select().subscribe(counter => {
            expect(counter).to.equal(0);
            done();
        })
    });

    it("should select a slice and emit the slice value", done => {
        incrementAction.next();

        counterStore.select().subscribe(counter => {
            expect(counter).to.equal(1);
            done();
        })
    })

    it("should be possible to pass a projection function to .select()", done => {
        store.select(state => state.counter).take(4).toArray().subscribe(values => {
            expect(values).to.deep.equal([0, 1, 2, 3]);
            done();
        })

        incrementAction.next();
        incrementAction.next();
        incrementAction.next();
    })

    it("should not invoke reducers which have been unsubscribed", done => {
        incrementSubscription.unsubscribe();

        counterStore.select().skip(1).subscribe(state => {
            done("Error: This should have not been called");
        })

        incrementAction.next();
        done();
    })

    it("should emit a state change on the slice if the root store changes even when the subtree is not affected and forceEmitEveryChange is set", done => {
        const simpleAction = new Action<void>();
        const simpleMutation: Reducer<CounterState, void> = (state) => ({ ...state });
        store.addReducer(simpleAction, simpleMutation);

        counterStore.select(s => s, true).skip(1).take(1).subscribe(counter => {
            expect(counter).to.equal(0);
            done();
        });

        simpleAction.next();
    })

    it("should not emit a state change on the slice if the root store changes and forceEmitEveryChange is not set", done => {
        const simpleAction = new Action<void>();
        const simpleMutation: Reducer<CounterState, void> = (state) => ({ ...state });
        store.addReducer(simpleAction, simpleMutation);

        counterStore.select(s => s, false).skip(1).toArray().subscribe(changes => {
            expect(changes).to.deep.equal([]);
            done();
        });

        simpleAction.next();
        store.destroy();
    })

    it("should trigger state changes on slice siblings", done => {
        const siblingStore = store.createSlice("counter");

        siblingStore.select().skip(1).subscribe(n => {
            expect(n).to.equal(1);
            done();
        })

        incrementAction.next();
    })

    it("should trigger state changes on slice siblings for complex states", done => {
        const rootStore: Store<RootState> = Store.create<RootState>({
            slice: { foo: "bar" }
        });
        const action = new Action<void>();
        const reducer: Reducer<SliceState, void> = (state, payload) => {
            return { ...state, foo: "baz" }
        };

        const slice1 = rootStore.createSlice<SliceState>("slice", { foo: "bar" });
        slice1.addReducer(action, reducer);

        const slice2 = rootStore.createSlice<SliceState>("slice", { foo: "bar2" });
        slice2.select().skip(1).subscribe(slice => {
            if (!slice) {
                done("ERROR");
                return;
            } else {
                expect(slice.foo).to.equal("baz");
                done();
            }
        })

        action.next();
    })
})