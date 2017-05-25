import "mocha";
import { expect } from "chai";
import { Subscription } from "rxjs/Rx";

import { Store, Action, Reducer } from "../dist/index";

import { CounterState } from "./test_common_types";

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