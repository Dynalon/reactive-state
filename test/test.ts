import "mocha";
import { expect } from "chai";

import { Observable, Subscription } from "rxjs/Rx";
import { Store, Action, Reducer } from "../dist/index";

interface CounterState {
    counter: number;
}

describe("Basic counter state tests", () => {

    let store: Store<CounterState>;
    let incrementAction: Action<void>;
    let incrementReducer: Reducer<CounterState, void>;
    let incrementReducerSubscription: Subscription;

    beforeEach(() => {
        const initialState = {
            counter: 0
        };
        store = Store.create(initialState);
        incrementAction = new Action<void>();
        incrementReducer = (state) => ({ ...state, counter: state.counter + 1 });
        incrementReducerSubscription = store.addReducer(incrementAction, incrementReducer);
    });

    it("should apply incrementReducer with incrementAction", done => {
        store.select(state => state).skip(1).take(1).subscribe(state => {
            expect(state.counter).to.equal(1);
            done();
        });
        incrementAction.next();
    });

    it("should use identity function as default if no selector is passed to default", done => {
        store.select<CounterState>().skip(1).take(1).subscribe(state => {
            expect(state).to.be.an("Object");
            expect(state.counter).not.to.be.undefined;
            done();
        })

        incrementAction.next();
    })

    it("should emit the initial state for first subscription", done => {
        store.select(state => state).take(1).subscribe(state => {
            expect(state.counter).to.equal(0);
            done();
        })
    })

    it("should emit the last state immediately when selecting", done => {
        incrementAction.next();

        store.select(state => state).take(1).subscribe(state => {
            expect(state.counter).to.equal(1);
            done();
        })
    })

    it("should not invoke reducers which have been unsubscribed", done => {
        incrementReducerSubscription.unsubscribe();

        store.select(state => state).skip(1).subscribe(state => {
            done("Error: This should have not been called");
        })

        incrementAction.next();
        done();
    })
})

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

        counterStore.select(n => n).subscribe(counter => {
            expect(counter).to.equal(1);
            done();
        })
    })

    it("should not invoke reducers which have been unsubscribed", done => {
        incrementSubscription.unsubscribe();

        counterStore.select(state => state).skip(1).subscribe(state => {
            done("Error: This should have not been called");
        })

        incrementAction.next();
        done();
    })

    it("should emit a state change on the slice if the root store changes even when the subtree is not affected", done => {
        const simpleAction = new Action<void>();
        const simpleMutation: Reducer<CounterState, void> = (state) => ({ ...state });
        store.addReducer(simpleAction, simpleMutation);

        counterStore.select().skip(1).take(1).subscribe(counter => {
            expect(counter).to.equal(0);
            done();
        });

        simpleAction.next();
    })

    it("should not emit a state change on the slice if we use .distinctUntilChanged() on the select", done => {

        // this is a very usefull pattern: By default every state mutation to the root state triggers subscriptions
        // on ALL slices, even if nothing changed on that slice. To only be notified if the specific slice changes,
        // we use RxJS built-in .distinctUntilChanged() operator.

        // Note that this only works if you correctly imjplement your Reducers to update every nested entry upon
        // modification. See the Redux docs on this topic for more info:
        // http://redux.js.org/docs/recipes/reducers/ImmutableUpdatePatterns.html#updating-nested-objects)

        const simpleAction = new Action<void>();
        const simpleMutation: Reducer<CounterState, void> = (state) => ({ ...state });
        store.addReducer(simpleAction, simpleMutation);

        // Note that the first time subscribe is called is the initialState that we skip
        counterStore.select().distinctUntilChanged().skip(1).subscribe(counter => {
            done("This should have not been called");
        });

        simpleAction.next();
        simpleAction.next();
        simpleAction.next();

        done();
    })
})