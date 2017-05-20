"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./index");
var initialState = {
    counter: 0,
    todoState: {
        todos: [
            { id: 1, title: 'Homework', done: false },
            { id: 2, title: 'Walk dog', done: false }
        ]
    },
};
// create our root store
var store = index_1.Store.create(initialState);
// Log all state changes using the .select() function
store.select(function (state) { return state; }).subscribe(function (newState) { return console.log(JSON.stringify(newState)); });
// wire up counter
// Actions are just extended RxJS Subjects
var incrementAction = new index_1.Action();
var incrementReducer = function (state, payload) { return state + 1; };
// actions can have optional names to identify them for logging, debugging, replaying etc.
var decrementAction = new index_1.Action('DECREMENT');
var decrementReducer = function (state, payload) { return state - 1; };
// while it looks like a magic string, it is NOT: 'counter' is of type "keyof AppState"; so putting
// any non-property name of AppState here is actually a compilation error! This makes it safe during
// refactorings!
var counterStore = store.createSlice('counter');
counterStore.addReducer(incrementAction, incrementReducer);
counterStore.addReducer(decrementAction, decrementReducer);
// dispatch some actions - we just call .next() (here with no payload)
incrementAction.next();
incrementAction.next();
decrementAction.next();
// wire up ToDos
var deleteToDoAction = new index_1.Action('DELETE_TODO');
var deleteToDoReducer = function (state, payload) {
    var filteredTodos = state.todos.filter(function (todo) { return todo.id != payload; });
    return __assign({}, state, { todos: filteredTodos });
};
var markTodoAsDoneAction = new index_1.Action('MARK_AS_DONE');
// This reducer purposely is more complicated than it needs to be, but shows how you would do it in Redux
// where you need to create immutable copies for all nested fields - see further below how this can be done
// easier using a more specific slice.
var markTodoAsDoneReducer = function (state, payload) {
    var todo = state.todos.filter(function (t) { return t.id == payload; })[0];
    var index = state.todos.indexOf(todo);
    var newTodo = __assign({}, todo, { done: true });
    state.todos[index] = newTodo;
    // we need to create immutable copy of the array, too
    var todos = state.todos.slice();
    return __assign({}, state, { todos: todos });
};
var todoStore = store.createSlice('todoState');
todoStore.addReducer(deleteToDoAction, deleteToDoReducer);
var reducerSubscription = todoStore.addReducer(markTodoAsDoneAction, markTodoAsDoneReducer);
markTodoAsDoneAction.next(1);
deleteToDoAction.next(1);
// now, using .createSlice() can be used to select the todos array directly and our reducer becomes less complex
// first, disable the previous complex reducer
reducerSubscription.unsubscribe();
// create a slice pointing directly to the todos array
var todosArraySlice = store.createSlice('todoState').createSlice('todos');
// create simpler reducer
var markTodoAsDoneSimpleReducer = function (state, payload) {
    var todo = state.filter(function (t) { return t.id == payload; })[0];
    var newTodo = __assign({}, todo, { done: true });
    var index = state.indexOf(todo);
    state[index] = newTodo;
    return state.slice();
};
todosArraySlice.addReducer(markTodoAsDoneAction, markTodoAsDoneSimpleReducer);
markTodoAsDoneAction.next(2);
deleteToDoAction.next(2);
//# sourceMappingURL=example.js.map