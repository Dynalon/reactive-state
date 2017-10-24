[![Build Status](https://travis-ci.org/Dynalon/reactive-state.svg?branch=master)](https://travis-ci.org/Dynalon/reactive-state)
[![npm version](https://badge.fury.io/js/reactive-state.svg)](https://badge.fury.io/js/reactive-state)

Reactive State
====

A typed, wrist-friendly state container aimed as an alternative to Redux when using RxJS. Written in TypeScript but usable from plain JavaScript. Originally inspired by the blog posting from [Michael Zalecki](http://michalzalecki.com/use-rxjs-with-react/) but heavily modified and extended since.

Features
----

  * wrist-friendly with no boilerplate code, string constants or endless switch statements
  * typed Actions based on RxJS Subjects
  * dynamically add and remove reducers during runtime (usefull in lazy-loaded application modules)
  * no need for async middlewares such as redux-thunk/redux-saga; actions are Observables and can be composed and transformed asynchronously leveraging RxJS built-in operators
  * single Store concept as in Redux, but with linked standalone stores representing slices/substates for easy reducer composition and sub-tree notifications

Installation
----
```
npm install --save reactive-state
```

Example Usage
----

```typescript
import { Store, Reducer, Action } from "reactive-state";

// The main (root) state for our example app
interface AppState {
    counter: number;
}

const initialState: AppState = {
    counter: 0
}

const store = Store.create(initialState);

// The .select() function returns an Observable that emits every state change; we can subscribe to it
// the second argument true will - for the sake of this example force output - every state change even
// to nested properties
store.select(state => state, true).subscribe(newState => console.log("ROOT STATE:", JSON.stringify(newState)));

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
```

Documentation
----

  * [Wiki](https://github.com/Dynalon/reactive-state/wiki)
  * [Demo App with annotated source](https://github.com/Dynalon/reactive-state-react-example)

Additionally, there is a small [example.ts file](https://github.com/Dynalon/reactive-state/blob/master/src/example.ts) and see also see the included [unit tests](https://github.com/Dynalon/reactive-state/tree/master/test) as well.

Note for Webpack Users
----
For reduced filesize when creating webpack bundles for the web, add these lines to your webpack.config.js in order to reduce filesize of the output bundle:

```javascript
node: {
    Buffer: false
}
```

This will tell webpack not to include any `Buffer` implementation used in our [deep clone implementation](https://github.com/pvorb/clone) which is not required for web bundles. The bundles provided in this library already include this optimization.

License
----

MIT.
