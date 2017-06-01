import { Observable, Subject, Subscription } from "rxjs/Rx";
import { StateMutation, Reducer, CleanupState, NamedObservable } from "./types";
import { cloneDeep, isPlainObject, isObject, isArray } from "lodash";

/**
 * A function which takes a Payload and return a state mutation function.
 */
type RootReducer<R, P> = (payload: P) => StateMutation<R>

/**
 * Creates a state based on a stream of StateMutation functions and an initial state. The returned observable
 * is hot and caches the last emitted value (will emit the last emitted value immediately upon subscription).
 * @param stateMutators
 * @param initialState
 */
function createState<S>(stateMutators: Observable<StateMutation<S>>, initialState: S): Observable<S> {
    const state = stateMutators
        .scan((state: S, reducer: StateMutation<S>) => reducer(state), initialState)
        // these two lines make our observable hot and have it emit the last state
        // upon subscription
        .publishReplay(1)
        .refCount()

    return state;
}


export class Store<S> {

    public readonly destroyed: Observable<void>;

    private readonly state: Observable<S>;

    /**
     * All reducers always produce a state mutation of the original root store type R;
     * However, we only now type R for the root store; all other stores may have different type
     * so we use any here as the root type.
     */

    private readonly stateMutators: Subject<StateMutation<any>>;

    /**
     * A list of strings that represenet property names that lead to a given slice
     * i.e. if keyChain = [ 'a', 'b', 'c' ] the slice points to ROOT['a']['b']['c']
     */
    private readonly keyChain: string[];

    /**
     * Is completed when the slice is unsubscribed and no longer needed.
     */
    private readonly _destroyed = new Subject<void>();

    private constructor(
        state: Observable<S>,
        stateMutators: Subject<StateMutation<any>>,
        keyChain: string[],
        onDestroy: () => void
    ) {

        this.state = state;
        this.stateMutators = stateMutators;
        this.keyChain = keyChain;

        this._destroyed.subscribe(undefined, undefined, onDestroy);
        this.destroyed = this._destroyed.asObservable();
    }

    /**
     * Create a new Store based on an initial state
     */
    static create<S>(initialState?: S): Store<S> {
        if (initialState === undefined)
            initialState = <S>{};
        else {
            if (isObject(initialState) && !isArray(initialState) && !isPlainObject(initialState))
                throw new Error("initialState must be a plain object, an array, or a primitive type");
            initialState = cloneDeep(initialState);
        }

        const stateMutators = new Subject<StateMutation<S>>();
        const state = createState(stateMutators, initialState);

        // to make publishReplay become effective, we need a subscription that lasts
        const stateSubscription = state.subscribe();
        const onDestroy = () => { stateSubscription.unsubscribe(); };

        const store = new Store<S>(state, stateMutators, [], onDestroy);

        // emit a single state mutation so that we emit the initial state on subscription
        stateMutators.next(s => s);
        return store;
    }

    /**
     * Creates a new linked store, that Selects a slice on the main store.
     */
    createSlice<K>(key: keyof S, initialState?: K, cleanupState?: CleanupState<K>): Store<K> {

        if (isObject(initialState) && !isArray(initialState) && !isPlainObject(initialState))
            throw new Error("initialState must be a plain object, an array, or a primitive type");
        if (isObject(cleanupState) && !isArray(cleanupState) && !isPlainObject(cleanupState))
            throw new Error("cleanupState must be a plain object, an array, or a primitive type");

        initialState = cloneDeep(initialState);
        cleanupState = cloneDeep(cleanupState);

        // S[keyof S] is assumed to be of type K; this is a runtime assumption
        const state: Observable<K> = this.state.map(s => <K><any>s[key]);
        const keyChain = [...this.keyChain, key];

        if (initialState !== undefined) {
            this.stateMutators.next(s => {
                setNestedPropertyToValue(s, initialState, keyChain);
                return s;
            });
        }

        const onDestroy = this.getOnDestroyFunctionForSlice(key, cleanupState);
        const sliceStore = new Store<K>(state, this.stateMutators, keyChain, onDestroy);

        // destroy the slice if the parent gets destroyed
        this._destroyed.subscribe(undefined, undefined, () => {
            sliceStore.destroy();
        });

        return sliceStore;
    }

    addReducer<P>(action: NamedObservable<P>, reducer: Reducer<S, P>): Subscription {
        const rootReducer: RootReducer<any, P> = (payload: P) => (state) => {
            if (this.keyChain.length === 0) {
                // assume R = S; reducer transforms the root state; this is a runtime assumption
                const typedReducer: Reducer<any, P> = <any>reducer;
                state = typedReducer(state, payload);
            } else {
                let slice = state;
                for (let i = 0; i < this.keyChain.length - 1; i++) {
                    slice = slice[this.keyChain[i]];
                }
                let lastKey = this.keyChain.slice(-1)[0];
                slice[lastKey] = reducer(slice[lastKey], payload);
            }
            return state;
        }
        return action.map(rootReducer)
            .takeUntil(this._destroyed)
            .subscribe(rootStateMutation => this.stateMutators.next(rootStateMutation));
    }

    /**
     * Selects a part of the state using a selector function. If no selector function is given, the identity function
     * is used (which returns the state of type S).
     * Note: The returned observable always emits when the root state changes - evne when the selected subtree has
     *       no changes. You can use .distinctUntilChanged() on the returned observable to only get updates
     *       when the selected subtree changes. This requires that your reducers update all nested properties in
     *       an immutable way, which is required practice with Redux and also with Reactive-State.
     *       (see http://redux.js.org/docs/recipes/reducers/ImmutableUpdatePatterns.html#updating-nested-objects)
     *
     * @param selectorFn    A selector function which returns a nested property of the state
     * @param forceEmitEveryChange  A flag to have updates emitted even if the select'ed
     *                              element is not changed (But i.e. a parent prop on global state)
     * @returns             An observable that emits any time the state changes
     */
    select<T>(selectorFn?: (state: S) => T, forceEmitEveryChange = false): Observable<T> {
        if (!selectorFn)
            selectorFn = (state: S) => <T><any>state;

        const mapped = this.state
            .takeUntil(this._destroyed)
            .map(selectorFn);

        if (forceEmitEveryChange)
            return mapped;
        else
            return mapped.distinctUntilChanged();
    }

    destroy(): void {
        this._destroyed.next();
        this._destroyed.complete();
    }

    private getOnDestroyFunctionForSlice<K>(key: string, cleanupState?: CleanupState<K>): () => void {
        let onDestroy = () => { };
        if (cleanupState || cleanupState === null) {
            onDestroy = () => {
                if (cleanupState === "undefined")
                    this.stateMutators.next(s => { delete s[key]; return s; });
                else {
                    this.stateMutators.next(s => { s[key] = cleanupState; return s; });
                }
            }
        }
        return onDestroy;
    }
}

/**
 * Updates a nested property in an object graph with a value
 *
 * @param s The object to apply the value to
 * @param keychain A list of keys that are used to walk down the object graph from 0..n
 */
function setNestedPropertyToValue(obj: any, value: any, keyChain: string[]): void {
    let s = obj;
    for (let i = 0; i < keyChain.length - 1; i++) {
        s = s[keyChain[i]];
    }
    let lastKey = keyChain.slice(-1)[0];
    s[lastKey] = value;
}