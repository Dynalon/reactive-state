import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";
import { Subscription } from "rxjs/Subscription";
import { StateMutation, Reducer, CleanupState, NamedObservable, DevTool } from "./types";

import * as clone from "clone";

// TODO use typings here
declare var require: any;
const isPlainObject = require("lodash.isplainobject");
const isObject = require("lodash.isobject");

import "rxjs/add/operator/scan";
import "rxjs/add/operator/map";
import "rxjs/add/operator/publishReplay";
import "rxjs/add/operator/takeUntil";
import "rxjs/add/operator/distinctUntilChanged";

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

    /**
     * Observable that indicated when the stored was destroyed using the .destroy() function.
     */
    public readonly destroyed: Observable<void>;

    /**
     * When set, we signal special debugging/development callbacks to the devtool.
     */
    public devTool?: DevTool;

    private readonly state: Observable<S>;

    /**
     * All reducers always produce a state mutation of the original root store type R;
     * However, we only now type R for the root store; all other stores may have different type
     * so we use any here as the root type.
     */
    private readonly stateMutators: Subject<StateMutation<S>>;

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
        onDestroy: () => void,
        devTool?: DevTool
    ) {

        this.state = state;
        this.stateMutators = stateMutators;
        this.keyChain = keyChain;

        this._destroyed.subscribe(undefined, undefined, onDestroy);
        this.destroyed = this._destroyed.asObservable();
        this.devTool = devTool;
    }

    /**
     * Create a new Store based on an initial state
     */
    static create<S>(initialState?: S): Store<S> {
        if (initialState === undefined)
            initialState = {} as S;
        else {
            if (isObject(initialState) && !Array.isArray(initialState) && !isPlainObject(initialState))
                throw new Error("initialState must be a plain object, an array, or a primitive type");
            initialState = clone(initialState);
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

        if (isObject(initialState) && !Array.isArray(initialState) && !isPlainObject(initialState))
            throw new Error("initialState must be a plain object, an array, or a primitive type");
        if (isObject(cleanupState) && !Array.isArray(cleanupState) && !isPlainObject(cleanupState))
            throw new Error("cleanupState must be a plain object, an array, or a primitive type");

        initialState = clone(initialState);
        cleanupState = clone(cleanupState);

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
        const sliceStore = new Store<K>(state, this.stateMutators, keyChain, onDestroy, this.devTool);

        // destroy the slice if the parent gets destroyed
        this._destroyed.subscribe(undefined, undefined, () => {
            sliceStore.destroy();
        });

        return sliceStore;
    }

    /**
     * Adds an Action/Reducer pair. This will make the reducer become active whenever the action observable emits a
     * value.
     * @param action The action observable whichs payload will be fed to the reducer on each emit
     * @param reducer
     * @param actionName An optional name (only used during development/debugging) to assign to the action. Overrides
     *  possible name set when using a NamedObservable as input
     */
    addReducer<P>(action: NamedObservable<P>, reducer: Reducer<S, P>, actionName?: string): Subscription {

        const rootReducer: RootReducer<any, P> = (payload: P) => (state) => {
            if (this.keyChain.length === 0) {
                // assume R = S; reducer transforms the root state; this is a runtime assumption
                state = reducer(state, payload);

            } else {
                const updateFn = (currentValue: any) => reducer(currentValue, payload);
                setNestedProperty(state, updateFn, this.keyChain);
            }

            if (this.devTool !== undefined) {
                const name = actionName || action.name || '';
                this.devTool.notifyStateChange(name, payload, state);
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
     * Note: The returned observable does not only update the root state changes (=is a new object instance)
     *       This requires that your reducers update all nested properties in
     *       an immutable way, which is required practice with Redux and also with reactive-state. To make the
     *       observable emit any time, every if only a subtree item changes, pass true as forceEmitEveryChange second
     *       argument to this function.
     *       For correct nested reducer updates, see:
     *         http://redux.js.org/docs/recipes/reducers/ImmutableUpdatePatterns.html#updating-nested-objects
     *
     * @param selectorFn    A selector function which returns a mapped/transformed object based on the state
     * @param forceEmitEveryChange  A flag to have updates emitted even if the select'ed
     *                              element is not changed (But i.e. a parent prop on global state)
     * @returns             An observable that emits when the state changes
     */
    select<T = S>(selectorFn?: (state: S) => T, forceEmitEveryChange = false): Observable<T> {
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

    private getOnDestroyFunctionForSlice<K>(key: keyof S, cleanupState?: CleanupState<K>): () => void {
        let onDestroy = () => { };
        if (cleanupState !== undefined) {
            onDestroy = () => {
                if (cleanupState === "undefined")
                    this.stateMutators.next(s => { (s as any)[key] = undefined; return s; });
                else if (cleanupState === "delete")
                    this.stateMutators.next(s => { delete (s as any)[key]; return s; });
                else {
                    this.stateMutators.next(s => { (s as any)[key] = cleanupState; return s; });
                }
            }
        }
        return onDestroy;
    }
}


/**
 * Updates a nested property in an object graph with the return value of a function
 * passed as argument.
 *
 * @param obj The object to apply the value to
 * @param updateFn Function whose return value is set to the prop. Receives the currentValue as first argument.
 * @param keychain A list of keys that are used to walk down the object graph from 0..n
 */
function setNestedProperty(obj: any, updateFn: (currentValue: any) => any, keyChain: string[]): void {
    let s = obj;
    for (let i = 0; i < keyChain.length - 1; i++) {
        s = s[keyChain[i]];
    }
    let lastKey = keyChain.slice(-1)[0];
    s[lastKey] = updateFn(s[lastKey]);
}

/**
 * Updates a nested property in an object graph with a value
 *
 * @param obj The object to apply the value to
 * @param value The value that is assigned to the nested property
 * @param keychain A list of keys that are used to walk down the object graph from 0..n
 */
function setNestedPropertyToValue(obj: any, value: any, keyChain: string[]): void {
    return setNestedProperty(obj, () => value, keyChain);
}