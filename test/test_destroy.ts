import "mocha";

import { Store, Action, Reducer } from "../src/index";

import { CounterState } from "./test_common_types";

describe("destroy logic", () => {
    interface SliceState {
        foo: string;
    }
    interface RootState {
        slice?: SliceState;
    }
    let store: Store<RootState>;

    beforeEach(() => {
        store = Store.create<RootState>();
    })

    it("should trigger the onCompleted subscription for the state observable returned by .select() when the store is destroyed", done => {
        store.select().subscribe(undefined, undefined, done);

        store.destroy();
    })

    it("should trigger the onCompleted on the state observable returned by select for any child slice when the parent store is destroyed", done => {
        const sliceStore = store.createSlice("slice");

        sliceStore.select().subscribe(undefined, undefined, done);

        store.destroy();
    });

    it("should unsubscribe any reducer subscription when the store is destroyed for the root store", done => {
        const store = Store.create<CounterState>({ counter: 0 });
        const incrementAction = new Action<void>();
        const incrementReducer: Reducer<CounterState, void> =
            (state, payload) => ({ ...state, counter: state.counter + 1 });

        const subscription = store.addReducer(incrementAction, incrementReducer);
        subscription.add(done);

        store.destroy();
    })

    it("should unsubscribe any reducer subscription when a sliceStore is destroyed", done => {
        const store = Store.create<CounterState>({ counter: 0 });
        const sliceStore = store.createSlice("counter");
        const incrementReducer: Reducer<number, void> = (state) => state + 1;

        const subscription = sliceStore.addReducer(new Action<void>(), incrementReducer);
        subscription.add(done);

        sliceStore.destroy();
    })

    it("should unsubscribe any reducer subscription for a sliceStore when the root store is destroyed", done => {
        const store = Store.create<CounterState>({ counter: 0 });
        const sliceStore = store.createSlice("counter");
        const incrementAction = new Action<void>();
        const incrementReducer: Reducer<number, void> = (state) => state + 1;

        const subscription = sliceStore.addReducer(incrementAction, incrementReducer);
        subscription.add(done);

        store.destroy();

    })

    it("should trigger the public destroyed observable when destroyed", done => {
        const sliceStore = store.createSlice("slice");

        sliceStore.destroyed.subscribe(done);

        store.destroy();
    });
})
