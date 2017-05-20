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

    beforeEach(() => {
        const initialState = {
            counter: 0
        };
        store = Store.create(initialState);
        incrementAction = new Action<void>();
        incrementReducer = (state) => ({ ...state, counter: state.counter + 1 });
    });

    it("should apply incrementReducer with incrementAction", done => {
        store.addReducer(incrementAction, incrementReducer);
        store.select(state => state).skip(1).take(1).subscribe(state => {
            expect(state.counter).to.equal(1);
            done();
        });
        incrementAction.next();
    });

    it("should use identity function as default if no selector is passed to default", done => {
        store.addReducer(incrementAction, incrementReducer);
        store.select<CounterState>().skip(1).take(1).subscribe(state => {
            expect(state).to.be.an("Object");
            expect(state.counter).not.to.be.undefined;
            done();
        })

        incrementAction.next();
    })

    it("should emit the initial state for first subscription", done => {
        store.addReducer(incrementAction, incrementReducer);
        store.select(state => state).take(1).subscribe(state => {
            expect(state.counter).to.equal(0);
            done();
        })
    })

    it("should emit the last state immediately when selecting", done => {
        store.addReducer(incrementAction, incrementReducer);
        incrementAction.next();

        store.select(state => state).take(1).subscribe(state => {
            expect(state.counter).to.equal(1);
            done();
        })
    })
})

describe("Store slicing tests", () => {
    let store: Store<CounterState>;
    let counterStore: Store<CounterState, number>;
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
})