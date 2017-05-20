import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Subscription } from "rxjs/Subscription";
import "rxjs/add/operator/scan";
import "rxjs/add/operator/map";
import "rxjs/add/operator/publishReplay";
import "rxjs/add/operator/distinctUntilChanged";

/**
 * A function which takes a State S and performs a transformation into a new state. The state mutation must be pure.
 * @returns A new state of type S
 */
export type StateMutation<S> = (state: S) => S;

/**
 * A reducer takes a state S, a payload P, applies a transformation using the payload to the state and
 * returns a new State. Reducers must be pure.
 */
export type Reducer<S, P> = (state: S, actionPayload: P) => S;

/**
 * A function which takes a Payload and return a state mutation function.
 */
type RootReducer<R, P> = (payload: P) => StateMutation<R>

/**
 * Actions basically just extend Subject that emit a Payload P and can have a string name to identify
 * the action. This can be used in future versions to produce action logs, replay them from a log/storage, etc.
 */
export class Action<P> extends Subject<P> {
    constructor(public name: string | undefined = undefined) {
        super();
    }
}

/**
 * Creates a state based on a stream of StateMutation functions and an initial state. The returned observable
 * is hot and caches the last emitted value (will emit the last emitted value immediately upon subscription).
 * @param stateMutators
 * @param initialState
 */
function createState<S>(stateMutators: Observable<StateMutation<S>>, initialState: S): Observable<S> {
    return stateMutators
        .scan((state: S, reducer: StateMutation<S>) => reducer(state), initialState)
        // these two lines make our observable hot and have it emit the last state
        // upon subscription
        .publishReplay(1)
        .refCount();
}

export class Store<R, S> {

    private readonly state: Observable<S>;
    private readonly stateMutators: Subject<StateMutation<R>>;
    private readonly keyChain: string[];

    private constructor(state: Observable<S>, stateMutators: Subject<StateMutation<R>>, keyChain: string[] = []) {
        this.state = state;
        this.stateMutators = stateMutators;
        this.keyChain = keyChain;
    }

    /**
     * Create a new Store based on an initial state
     */
    static create<R>(initialState: R): Store<R, R> {
        const stateMutators = new Subject<StateMutation<R>>();
        const state = createState(stateMutators, initialState);
        const store = new Store<R, R>(state, stateMutators, []);
        return store;
    }

    /**
     * Creates a new linked store, that Selects a slice on the main store.
     */
    createSlice<K>(key: keyof S): Store<R, K> {
        // S[keyof S] is assumed to be of type K; this is a runtime assumption
        const state: Observable<K> = this.state.map(s => <K><any>s[key]);
        const keyChain = [...this.keyChain, key];

        return new Store<R, K>(state, this.stateMutators, keyChain);
    }

    addReducer<P>(action: Observable<P>, reducer: Reducer<S, P>): Subscription {
        const rootReducer: RootReducer<R, P> = (payload: P) => (state: R) => {
            if (this.keyChain.length === 0) {
                // assume R = S; reducer transforms the root state; this is a runtime assumption
                const typedReducer: Reducer<R, P> = <any>reducer;
                state = typedReducer(state, payload);
            } else {
                let slice = <any>state;
                for (let i = 0; i < this.keyChain.length - 1; i++) {
                    slice = slice[this.keyChain[i]];
                }
                let lastKey = this.keyChain.slice(-1)[0];
                slice[lastKey] = reducer(slice[lastKey], payload);
            }
            return state;
        }
        return action.map(rootReducer).subscribe(rootStateMutation => this.stateMutators.next(rootStateMutation));
    }

    /**
     * Selects a part of the state using a selector function. If no selector function is given, the identity function
     * is used (which returns the state of type S).
     * Note: The returned observable always emits when the root state changes - evne when the selected subtree has
     *       no changes. You can use .distinctUntilChanges() on the returned observable to only get updates
     *       when the selected subtree changes. This requires that your reducers update all nested properties in
     *       an immutable way, which is required practice with Redux and also with Reactive-State.
     *       (see http://redux.js.org/docs/recipes/reducers/ImmutableUpdatePatterns.html#updating-nested-objects)
     *
     * @param selectorFn    A selector function which returns a nested property of the state
     * @returns             An observable that emits any time the state changes
     */
    select<T>(selectorFn?: (state: S) => T): Observable<T> {
        if (!selectorFn)
            selectorFn = (state: S) => <T><any>state;

        return this.state.map(selectorFn);
    }
}
