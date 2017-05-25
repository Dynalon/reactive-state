import "mocha";

import { Store, Action, Reducer } from "../dist/index";

// make sure the example in the README.md actually works and compiles
// use this test as playground
function testExample() {

    // The main (root) state for our example app
    interface AppState {
        counter: number;
    }

    const initialState: AppState = {
        counter: 0
    }

    const store = Store.create(initialState);

    // The .select() function returns an Observable that emits every state change; we can subscribe to it
    store.select(state => state).subscribe(newState => console.log("ROOT STATE:", JSON.stringify(newState)));

    // the state Observable always caches the last emitted state, so we will immediately get printed the inital state:
    // [CONSOLE.LOG] ROOT STATE: {"counter":0}

    // Actions are just extended RxJS Subjects
    const incrementAction = new Action<number>();
    const incrementReducer: Reducer<AppState, number> = (state, payload) => {
        return { ...state, counter: state.counter + payload };
    };

    // register reducer for an action
    const incrementSubscription = store.addReducer(incrementAction, incrementReducer);

    // dispatch actions

    incrementAction.next(1);
    // [CONSOLE.LOG]: ROOT STATE: {"counter":1}
    incrementAction.next(1);
    // [CONSOLE.LOG]: ROOT STATE: {"counter":2}

    // reducers can be unsubscribed dynamically - that means they won't react to the action anymore
    incrementSubscription.unsubscribe();

    // Now, here is the more powerfull part of Reactive State: lets use a slice to simplifiy our code!

    const sliceStore = store.createSlice("counter");
    // Note: while the first argument "counter" above may look like a magic string it is not: it is
    // of type "keyof Appstate"; using any other string that is not a valid property name of AppState will thus
    // trigger a TypeScript compilation error. This make it safe for refactorings :)

    const incrementSliceReducer: Reducer<number, number> = (state, payload) => state + payload;
    sliceStore.addReducer(incrementAction, incrementSliceReducer);

    sliceStore.select().subscribe(counter => console.log("COUNTER STATE:", counter));
    // [CONSOLE.LOG] COUNTER STATE: 2

    incrementAction.next(1);
    // [CONSOLE.LOG] ROOT STATE: {"counter":3}
    // [CONSOLE.LOG] COUNTER STATE: 3

    incrementAction.next(1);
    // [CONSOLE.LOG] ROOT STATE: {"counter":4}
    // [CONSOLE.LOG] COUNTER STATE: 4

    // Note how the ROOT STATE change subscription still is active; even if we operate on a slice, it is still
    // linked to a single root store. The slice is just a "view" on the state, and replace reducer composition.
}

testExample();