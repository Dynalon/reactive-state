import "mocha";
import { zip, interval } from "rxjs";
import  {  map, take } from "rxjs/operators";
import { Store, Action, Reducer } from "../src/index";

// make sure the example in the README.md actually works and compiles
// use this test as playground
export function testExample() {

    // The main (root) state for our example app
    interface AppState {
        counter: number;
    }

    const initialState: AppState = { counter: 0 }

    const store = Store.create(initialState);

    // The .select() function returns an Observable that emits every state change, so we can subscribe to it
    store.select().subscribe(newState => console.log("ROOT STATE:", JSON.stringify(newState)));

    // the state Observable always caches the last emitted state, so we will immediately print our inital state:
    // [CONSOLE.LOG]: ROOT STATE: {"counter":0}

    // Actions are just extended RxJS Subjects
    const incrementAction = new Action<number>();

    // A reducer is a function that takes a state and an optional payload, and returns a new state
    function incrementReducer(state, payload) {
        return { ...state, counter: state.counter + payload };
    };

    store.addReducer(incrementAction, incrementReducer);

    // lets dispatch some actions

    incrementAction.next(1);
    // [CONSOLE.LOG]: ROOT STATE: {"counter":1}
    incrementAction.next(1);
    // [CONSOLE.LOG]: ROOT STATE: {"counter":2}

    // async actions? No problem, no need for a "middleware", just use RxJS
    interval(1000).pipe(take(3)).subscribe(() => incrementAction.next(1));
    // <PAUSE 1sec>
    // [CONSOLE.LOG]: ROOT STATE: {"counter":3}
    // <PAUSE 1sec>
    // [CONSOLE.LOG]: ROOT STATE: {"counter":4}
    // <PAUSE 1sec>
    // [CONSOLE.LOG]: ROOT STATE: {"counter":5}
}

describe.skip("example", () => {
    it("should run the example", done => {
        testExample();
        setTimeout(() => {
            done();
        }, 10000);

    })
})

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

    const todoStore = store.createSlice("todos");
    todoStore.addReducer(markTodoAsDone, markTodoAsDoneReducer);

    const todos = todoStore.select()

    // create an auto computed observables using RxJS basic operators

    const openTodos = todos.pipe(map(todos => todos.filter(t => t.done == false).length));
    const completedTodos = todos.pipe(map(todos => todos.filter(t => t.done == true).length));

    // whenever the number of open or completed todos changes, log a message
    zip(openTodos, completedTodos)
        .subscribe(([open, completed]) => console.log(`I have ${open} open todos and ${completed} completed todos`));

    markTodoAsDone.next(0);
    markTodoAsDone.next(1);
    markTodoAsDone.next(2);
}

// testComputedValuesExample();
