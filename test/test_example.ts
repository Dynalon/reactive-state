import "mocha";
import { Observable } from "rxjs/Rx";
import { Store, Action, Reducer } from "../dist/index";

// make sure the example in the README.md actually works and compiles
// use this test as playground
export function testExample() {

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

export function testComputedValuesExample() {
    interface Todo {
        id: number;
        title: string;
        done: boolean;
    }

    interface TodoState {
        todos: Todo[];
    }

    const store: Store<TodoState> = Store.create({
        todos: [
            {
                id: 0,
                title: "Walk the dog",
                done: false
            },
            {
                id: 1,
                title: "Homework",
                done: false
            },
            {
                id: 2,
                title: "Do laundry",
                done: false
            }
        ]
    });

    const markTodoAsDone = new Action<number>();
    const markTodoAsDoneReducer: Reducer<Todo[], number> = (state, id) => {
        let todo = state.filter(t => t.id === id)[0];
        todo = { ...todo, done: true };
        return [...state.filter(t => t.id !== id), todo];
    };

    const todoStore = store.createSlice<Todo[]>("todos");
    todoStore.addReducer(markTodoAsDone, markTodoAsDoneReducer);

    const todos = todoStore.select(s => s)
        // only update when the todo list has changed (i.e. a reducer became active)
        .distinctUntilChanged();

    // create an auto computed observables using RxJS basic operators

    const openTodos = todos.map(todos => todos.filter(t => t.done == false).length);
    const completedTodos = todos.map(todos => todos.filter(t => t.done == true).length);

    // whenever the number of open or completed todos changes, log a message
    console.log("foo");
    Observable.zip(openTodos, completedTodos)
        .subscribe(([open, completed]) => console.log(`I have ${open} open todos and ${completed} completed todos`));

    markTodoAsDone.next(0);
    markTodoAsDone.next(1);
    markTodoAsDone.next(2);
}

testComputedValuesExample();
