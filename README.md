Reactive State
====

A typed, wrist-friendly state container aimed as an alternative to Redux when using RxJS. Written in TypeScript but usable from plain JavaScript. Originally inspired by the blog posting from [Michael Zalecki](http://michalzalecki.com/use-rxjs-with-react/) but heavily modified and extended since.

Features
----

  * wrist-friendly with no boilerplate code, string constants or endless switch statements
  * typed Actions based on RxJS Subjects
  * dynamically add and remove reducers during runtime (usefull in lazy-loaded application modules)
  * single Store concept as in Redux, but with linked standalone stores representing slices/substates for easy reducer composition and sub-tree notifications

Example Usage
----

```typescript
import { Store, Reducer, Action } from "reactive-state";

// The main (root) state for our example app
interface AppState {
    counter: 0;

    // Example of a typed substate/slice
    todoState: TodoState;
}

interface Todo {
    id: number;
    title: string;
    done: boolean;
}

interface TodoState {
    todos: Todo[];
}

const initialState: AppState = {
    counter: 0,
    todoState: {
        todos: [
            { id: 1, title: 'Homework', done: false },
            { id: 2, title: 'Walk dog', done: false }
        ]
    },
};

// create our root store
const store = Store.create(initialState);

// Log all state changes using the .select() function
store.select(state => state).subscribe(newState => console.log(JSON.stringify(newState)));

// wire up counter

// Actions are just extended RxJS Subjects
const incrementAction = new Action<void>();
const incrementReducer: Reducer<number, void> = (state, payload) => state + 1;

// actions can have optional names to identify them for logging, debugging, replaying etc.
const decrementAction = new Action<void>('DECREMENT');
const decrementReducer: Reducer<number, void> = (state, payload) => state - 1;

// Select a slice on the root state and create a linked sub-store
// while it looks like a magic string, it is NOT: 'counter' is of type "keyof AppState"; so putting
// any non-property name of AppState here is actually a compilation error! This makes it safe during
// refactorings!
const counterStore = store.createSlice<number>('counter');

counterStore.addReducer(incrementAction, incrementReducer);
counterStore.addReducer(decrementAction, decrementReducer);

// dispatch some actions - we just call .next() (here with no payload)
incrementAction.next();
incrementAction.next();
decrementAction.next();

// wire up ToDos
const deleteToDoAction = new Action<number>('DELETE_TODO');
const deleteToDoReducer: Reducer<TodoState, number> = (state, payload) => {
    const filteredTodos = state.todos.filter(todo => todo.id != payload);
    return { ...state, todos: filteredTodos };
};

const markTodoAsDoneAction = new Action<number>('MARK_AS_DONE');
// This reducer purposely is more complicated than it needs to be, but shows how you would do it in Redux
// where you need to create immutable copies for all nested fields - see further below how this can be done
// easier using a more specific slice.
const markTodoAsDoneReducer: Reducer<TodoState, number> = (state: TodoState, payload: number) => {
    const todo = state.todos.filter(t => t.id == payload)[0];
    const index = state.todos.indexOf(todo);
    const newTodo = { ...todo, done: true };
    state.todos[index] = newTodo;
    // we need to create immutable copy of the array, too
    const todos = [ ...state.todos ];
    return { ...state, todos };
};

const todoStore = store.createSlice<TodoState>('todoState');
todoStore.addReducer(deleteToDoAction, deleteToDoReducer);
const reducerSubscription = todoStore.addReducer(markTodoAsDoneAction, markTodoAsDoneReducer);

markTodoAsDoneAction.next(1);
deleteToDoAction.next(1);

// now, using .createSlice() can be used to select the todos array directly and our reducer becomes less complex

// first, disable the previous complex reducer
reducerSubscription.unsubscribe();

// create a slice pointing directly to the todos array
const todosArraySlice = store.createSlice<TodoState>('todoState').createSlice<Todo[]>('todos');

// create simpler reducer
const markTodoAsDoneSimpleReducer: Reducer<Todo[], number> = (state: Todo[], payload: number) => {
    const todo = state.filter(t => t.id == payload)[0];
    const newTodo = { ...todo, done: true};
    const index = state.indexOf(todo);
    state[index] = newTodo;
    return [ ...state ];
}

todosArraySlice.addReducer(markTodoAsDoneAction, markTodoAsDoneSimpleReducer);
markTodoAsDoneAction.next(2);
deleteToDoAction.next(2);
```

Documentation
----

TBD.

License
----

MIT