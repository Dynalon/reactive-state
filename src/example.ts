import { Store, Reducer } from "./index";
import { Subject } from "rxjs";

// you can run this example with node: "node dist/example" from the project root.

// The main (root) state for our example app
interface AppState {
    counter: number;

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
        todos: [{ id: 1, title: "Homework", done: false }, { id: 2, title: "Walk dog", done: false }],
    },
};

// create our root store
const store = Store.create(initialState);

// Log all state changes using the .select() function
store.select().subscribe(newState => console.log(JSON.stringify(newState)));

// Any Observable can be an action - we use a Subject here
const incrementAction = new Subject<void>();
const incrementReducer: Reducer<number, void> = (state: number, payload: void) => state + 1;

const decrementAction = new Subject<void>();
const decrementReducer: Reducer<number, void> = (state: number, payload: void) => state - 1;

// while it looks like a magic string, it is NOT: 'counter' is of type "keyof AppState"; so putting
// any non-property name of AppState here is actually a compilation error!
const counterStore = store.createSlice("counter");

counterStore.addReducer(incrementAction, incrementReducer);
counterStore.addReducer(decrementAction, decrementReducer);

// dispatch some actions - we just call .next() (here with no payload)
incrementAction.next();
incrementAction.next();
decrementAction.next();

// wire up ToDos
const deleteToDoAction = new Subject<number>();
const deleteToDoReducer: Reducer<TodoState, number> = (state, payload) => {
    const filteredTodos = state.todos.filter(todo => todo.id != payload);
    return { ...state, todos: filteredTodos };
};

const markTodoAsDoneAction = new Subject<number>();
// This reducer purposely is more complicated than it needs to be, but shows how you would do it in Redux
// you will find a little easier solution using a more specific slice below

const markTodoAsDoneReducer: Reducer<TodoState, number> = (state: TodoState, payload: number) => {
    const todos = state.todos.map(todo => {
        if (todo.id != payload) return todo;
        return {
            ...todo,
            done: true,
        };
    });
    return { ...state, todos };
};

const todoStore = store.createSlice("todoState");
todoStore.addReducer(deleteToDoAction, deleteToDoReducer);
const reducerSubscription = todoStore.addReducer(markTodoAsDoneAction, markTodoAsDoneReducer);

markTodoAsDoneAction.next(1);
deleteToDoAction.next(1);

// now, using .createSlice() can be used to select the todos array directly and our reducer becomes less complex

// first, disable the previous complex reducer
reducerSubscription.unsubscribe();

// create a slice pointing directly to the todos array
const todosArraySlice = store.createSlice("todoState").createSlice("todos");

// create simpler reducer
const markTodoAsDoneSimpleReducer: Reducer<Todo[], number> = (state: Todo[], payload: number) => {
    return state.map(todo => {
        if (todo.id != payload) return todo;
        return {
            ...todo,
            done: true,
        };
    });
};

todosArraySlice.addReducer(markTodoAsDoneAction, markTodoAsDoneSimpleReducer);
markTodoAsDoneAction.next(2);
deleteToDoAction.next(2);
