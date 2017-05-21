import "mocha";
import { expect } from "chai";

import { Observable, Subscription, Subject } from "rxjs/Rx";
import { Store, Action, Reducer } from "../dist/index";

interface CounterState {
    counter: number;
}

interface SliceState {
    foo: string;
}
interface RootState {
    slice?: SliceState;
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

describe("initial state chaining", () => {


    let store: Store<RootState>;
    beforeEach(() => {
        store = Store.create<RootState>();
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
        store.select(s => s).subscribe(undefined, undefined, done);

        store.destroy();
    })

    it("should trigger the onCompleted on the state observable returned by select for any child slice when the parent store is destroyed", done => {
        const sliceStore = store.createSlice("slice");

        sliceStore.select(s => s).subscribe(undefined, undefined, done);

        store.destroy();
    });

    it("should unsubscribe any reducer subscription when the store is destroyed for the root store", done => {
        const store = Store.create<CounterState>({ counter: 0 });
        const incrementAction = new Action<void>();
        const incrementReducer: Reducer<CounterState, void> =
            (state, payload) => ({ ...state, counter: state.counter + 1});

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
        const sliceStore = store.createSlice<number>("counter");
        const incrementAction = new Action<void>();
        const incrementReducer: Reducer<number, void> = (state) => state + 1;

        const subscription = sliceStore.addReducer(incrementAction, incrementReducer);
        subscription.add(done);

        store.destroy();

    })
})

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

// testExample();