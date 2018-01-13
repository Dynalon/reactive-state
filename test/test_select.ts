import "mocha";
import { expect } from "chai";

import { Store, Action, Reducer } from "../src/index";

import { CounterState } from "./test_common_types";

describe("Store .select() tests", () => {

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
        store.addReducer(incrementAction, incrementReducer);
    });

    afterEach(() => {
        store.destroy();
    })

    it("should emit a state change on select", done => {
        store.select().skip(1).take(1).subscribe(state => {
            expect(state.counter).to.equal(1);
            done();
        });
        incrementAction.next();
    });

    it("should use the identity function as default if no selector function is passed", done => {
        store.select().skip(1).take(1).subscribe(state => {
            expect(state).to.be.an("Object");
            expect(state.counter).not.to.be.undefined;
            done();
        })

        incrementAction.next();
    })

    it("should immediately emit the last-emitted (might be initial) state when subscription happens", done => {
        store.select().take(1).subscribe(state => {
            expect(state.counter).to.equal(0);
            done();
        })
    })

    it("should emit the last state immediately when selecting", done => {
        incrementAction.next();

        store.select().take(1).subscribe(state => {
            expect(state.counter).to.equal(1);
            done();
        })
    })

    it("should not emit a state change when the reducer returns the unmofified, previous state", done => {
        const initialState = {}
        const store = Store.create<{}>(initialState);
        const dummyAction = new Action<void>();
        const shallowCopyAction = new Action<void>();
        store.addReducer(dummyAction, state => state);
        store.addReducer(shallowCopyAction, state => ({ ...state }));

        store.select().skip(1).toArray().subscribe(state => {
            expect(state.length).to.equal(1);
            expect(state[0]).not.to.equal(initialState);
            done();
        })

        dummyAction.next(undefined);
        shallowCopyAction.next(undefined);
        store.destroy();
    })


})