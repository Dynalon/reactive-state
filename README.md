[![Build Status](https://travis-ci.org/Dynalon/reactive-state.svg?branch=master)](https://travis-ci.org/Dynalon/reactive-state)
[![npm version](https://badge.fury.io/js/reactive-state.svg)](https://badge.fury.io/js/reactive-state)
![code coverage](https://coveralls.io/repos/Dynalon/reactive-state/badge.svg?branch=master&service=github)

Reactive State
====

A typed, wrist-friendly state container aimed as an alternative to Redux when using RxJS. Written with RxJS in TypeScript but perfectly usable from plain JavaScript. Originally inspired by the blog posting from [Michael Zalecki](http://michalzalecki.com/use-rxjs-with-react/) but heavily modified and extended since.

Features
----

  * type-safe actions: no boilerplate code, no mandatory string constants, and not a single switch statement
  * Actions are just Observables, so are Subjects. Just call `.next()` to dispatch an action.
  * dynamically add and remove reducers during runtime
  * no need for async middlewares such as redux-thunk/redux-saga; actions are Observables and can be composed and transformed async using RxJS operators
  * no need for selector libraries like MobX or Reselect, RxJS already ships it
  * single, application-wide Store concept as in Redux. Possibility to create slices/substates for decoupling (easier reducer composition and state separation by module)
  * Strictly typed to find errors during compile time
  * Heavily unit tested, 100+ tests for ~250 lines of code
  * React bridge (like `react-redux`) included, though using React is not mandatory
  * Support for React-Devtool Extension

Installation
----
```
npm install reactive-state
```

Documentation
----

  * [Wiki](https://github.com/Dynalon/reactive-state/wiki)
  * [Demo App with annotated source](https://github.com/Dynalon/reactive-state-react-example) (includes react bridge examples)

Additionally, there is a small [example.ts file](https://github.com/Dynalon/reactive-state/blob/master/src/example.ts) and see also see the included [unit tests](https://github.com/Dynalon/reactive-state/tree/master/test) as well.


Example Usage
----

```typescript
import { Store } from "reactive-state";
import { Subject } from "rxjs";
import { take } from "rxjs/operators";

// The state for our example app
interface AppState {
    counter: number;
}

const initialState: AppState = { counter: 0 }

const store = Store.create(initialState);

// The .watch() function returns an Observable that emits the selected state change, so we can subscribe to it
store.watch().subscribe(newState => console.log("STATE:", JSON.stringify(newState)));

// the watch() observable always caches the last emitted state, so we will immediately print our inital state:
// [CONSOLE.LOG]: STATE: {"counter":0}

// use a RxJS Subjects as an action
const incrementAction = new Subject<number>();

// A reducer is a function that takes a state and an optional payload, and returns a new state
function incrementReducer(state, payload) {
    return { ...state, counter: state.counter + payload };
};

store.addReducer(incrementAction, incrementReducer);

// lets dispatch some actions

incrementAction.next(1);
// [CONSOLE.LOG]: STATE: {"counter":1}
incrementAction.next(1);
// [CONSOLE.LOG]: STATE: {"counter":2}

// async actions? No problem, no need for a "middleware", just use RxJS
interval(1000).pipe(take(3)).subscribe(() => incrementAction.next(1));
// <PAUSE 1sec>
// [CONSOLE.LOG]: STATE: {"counter":3}
// <PAUSE 1sec>
// [CONSOLE.LOG]: STATE: {"counter":4}
// <PAUSE 1sec>
// [CONSOLE.LOG]: STATE: {"counter":5}
```

License
----

MIT.
