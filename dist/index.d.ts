import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Subscription } from "rxjs/Subscription";
import "rxjs/add/operator/scan";
import "rxjs/add/operator/map";
import "rxjs/add/operator/publishReplay";
/**
 * A function which takes a State S and performs a transformation into a new state. The state mutation must be pure.
 * @returns A new state of type S
 */
export declare type StateMutation<S> = (state: S) => S;
/**
 * A reducer takes a state S, a payload P, applies a transformation using the payload to the state and
 * returns a new State. Reducers must be pure.
 */
export declare type Reducer<S, P> = (state: S, actionPayload: P) => S;
/**
 * Actions basically just extend Subject that emit a Payload P and can have a string name to identify
 * the action. This can be used in future versions to produce action logs, replay them from a log/storage, etc.
 */
export declare class Action<P> extends Subject<P> {
    name: string | undefined;
    constructor(name?: string | undefined);
}
export declare class Store<R, S> {
    private readonly state;
    private readonly stateMutators;
    private readonly keyChain;
    private constructor(state, stateMutators, keyChain?);
    /**
     * Create a new Store based on an initial state
     */
    static create<R>(initialState: R): Store<R, R>;
    /**
     * Creates a new linked store, that Selects a slice on the main store.
     */
    createSlice<K>(key: keyof S): Store<R, K>;
    addReducer<P>(action: Observable<P>, reducer: Reducer<S, P>): Subscription;
    /**
     * Selects a part of the state using a selector function. If no selector function is given, the identity function
     * is used (which returns the state of type S).
     * Note: The returned observable emits every time the state changes, even if the state does not affect
     *       the part selected by the selection function.
     *
     * @param fn
     * @returns An observable that emits any time the state changes
     */
    select<T>(selectorFn?: (state: S) => T): Observable<T>;
}
