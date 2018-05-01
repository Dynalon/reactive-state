import { Observable, Subject, Subscription } from "rxjs";
import {
    StateMutation, StateChangeNotification, RootStateChangeNotification, Reducer,
    CleanupState, NamedObservable, ActionDispatch
} from "./types";
import { shallowEqual } from "./shallowEqual";

// TODO use typings here
declare var require: any;
const isPlainObject = require("lodash.isplainobject");
const isObject = require("lodash.isobject");

import {
    filter,
    merge,
    scan,
    map,
    takeWhile,
    takeUntil,
    distinctUntilChanged,
    publishReplay,
    refCount
} from "rxjs/operators";
import { EMPTY } from "rxjs"

// TODO: We currently do not allow Symbol properties on the root state. This types asserts that all properties
// on the state object are strings (numbers get transformed to strings anyway)
export type SObject = { [key: string]: any };

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
    let initialStateCopy = createImmutableCopy(initialState);
    const state = stateMutators.pipe(
        scan((state: S, reducer: StateMutation<S>) => reducer(state), initialStateCopy),
        // these two lines make our observable hot and have it emit the last state
        // upon subscription
        publishReplay(1),
        refCount()
    )
    return state;
}

function createImmutableCopy(state: any) {
    if (isObject(state) && isPlainObject(state)) {
        return { ...state };
    } else if (Array.isArray(state))
        return [ ...state ];
    else {
        return state;
    }
}

export class Store<S> {

    /**
     * Observable that emits when the store was destroyed using the .destroy() function.
     */
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

    /**
     * Used for manual dispatches without observables
     */
    private readonly actionDispatch: Subject<ActionDispatch<any>>;

    private readonly rootStateChangedNotificationSubject: Subject<RootStateChangeNotification>;

    /**
     * Only used for debugging purposes (so we can bridge Redux Devtools to the store)
     * Note: Do not use in day-to-day code, use .select() instead.
     */
    public rootStateChangedNotification: Observable<RootStateChangeNotification>;

    private constructor(
        state: Observable<S>,
        stateMutators: Subject<StateMutation<S>>,
        keyChain: string[],
        onDestroy: () => void,
        notifyRootStateChangedSubject: Subject<RootStateChangeNotification>,
        actionDispatch: Subject<ActionDispatch<any>>
    ) {
        this.state = state;
        this.stateMutators = stateMutators;
        this.keyChain = keyChain;

        this._destroyed.subscribe(undefined, undefined, onDestroy);
        this.destroyed = this._destroyed.asObservable();

        this.actionDispatch = actionDispatch;

        this.rootStateChangedNotificationSubject = notifyRootStateChangedSubject;
        this.rootStateChangedNotification = this.rootStateChangedNotificationSubject.asObservable().pipe(takeUntil(this.destroyed));
    }

    /**
     * Create a new Store based on an initial state
     */
    static create<S>(initialState?: S): Store<S> {
        initialState = createImmutableCopy(initialState);
        if (initialState === undefined)
            initialState = {} as S;
        else {
            if (isObject(initialState) && !Array.isArray(initialState) && !isPlainObject(initialState))
                throw new Error("initialState must be a plain object, an array, or a primitive type");
        }

        const stateMutators = new Subject<StateMutation<S>>();

        const state = createState(stateMutators, initialState);

        // to make publishReplay become effective, we need a subscription that lasts
        const stateSubscription = state.subscribe();
        const onDestroy = () => { stateSubscription.unsubscribe(); };

        const store = new Store<S>(state, stateMutators, [], onDestroy, new Subject(), new Subject());

        // emit a single state mutation so that we emit the initial state on subscription
        stateMutators.next(s => s);
        return store;
    }

    /**
     * Creates a new linked store, that Selects a slice on the main store.
     */
    createSlice<K extends keyof S>(key: K, initialState?: S[K], cleanupState?: CleanupState<S[K]>): Store<S[K]> {
        initialState = createImmutableCopy(initialState);
        if (isObject(initialState) && !Array.isArray(initialState) && !isPlainObject(initialState))
            throw new Error("initialState must be a plain object, an array, or a primitive type");
        if (isObject(cleanupState) && !Array.isArray(cleanupState) && !isPlainObject(cleanupState))
            throw new Error("cleanupState must be a plain object, an array, or a primitive type");

        // S[keyof S] is assumed to be of type K; this is a runtime assumption
        const state: Observable<S[K]> = this.state.pipe(map(state => state[key]));
        const keyChain = [...this.keyChain, key];

        if (initialState !== undefined) {
            this.stateMutators.next(s => {
                setNestedPropertyToValue(s, initialState, keyChain);
                return s;
            });
        }

        const onDestroy = this.getOnDestroyFunctionForSlice(key, cleanupState);
        const sliceStore = new Store<S[K]>(
            state,
            this.stateMutators,
            keyChain,
            onDestroy,
            this.rootStateChangedNotificationSubject,
            this.actionDispatch
        );

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
    addReducer<P>(action: NamedObservable<P> | string, reducer: Reducer<S, P>, actionName?: string): Subscription {
        if (typeof action === "string" && typeof actionName === "string") {
            throw new Error("Can not specify action as string and actionName as string as same time");
        }

        let name: string | undefined;
        if (typeof action === "string") {
            if (action.length === 0) {
                throw new Error("When passing an action string, it must have non-zero length");
            }
            name = action;
        } else {
            name = actionName || action.name || undefined;
        }

        let realAction = <NamedObservable<P>>this.actionDispatch.pipe(
            takeWhile(s => name !== undefined && name.length > 0),
            takeUntil(this.destroyed),
            filter(s => s.actionName === name),
            map(s => s.actionPayload),
            merge(typeof action !== "string" ? action : EMPTY)
        )

        const rootReducer: RootReducer<S, P> = (payload: P) => (rootState) => {

            let nextEqualsPreviousState = false;

            if (this.keyChain.length === 0) {
                // assume R = S; reducer transforms the root state; this is a runtime assumption
                const previousState = rootState;
                rootState = reducer(rootState, payload);
                nextEqualsPreviousState = previousState === rootState;
            } else {
                const updateFn = (currentValue: S) => reducer(currentValue, payload);
                const { previousValue, nextValue } = setNestedProperty(rootState, updateFn, this.keyChain);
                nextEqualsPreviousState = previousValue === nextValue;
            }

            if (!nextEqualsPreviousState) {
                // Send state change notification
                const changeNotification: RootStateChangeNotification = {
                    actionName: name,
                    actionPayload: payload,
                    path: this.keyChain,
                    newState: rootState
                }
                this.rootStateChangedNotificationSubject.next(changeNotification);
            }

            return rootState;
        }

        return realAction.pipe(
            map(payload => rootReducer(payload)),
            takeUntil(this._destroyed)
        ).subscribe(rootStateMutation => {
            this.stateMutators.next(rootStateMutation)
        });

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

        const mapped = this.state.pipe(
            takeUntil(this._destroyed),
            map(selectorFn),
        )

        if (forceEmitEveryChange)
            return mapped;
        else
            return mapped.pipe(
                distinctUntilChanged((a, b) => shallowEqual(a, b)),
            )
    }

    /**
     * Destroys the Store/Slice. All Observables obtained via .select() will complete when called.
     */
    destroy(): void {
        this._destroyed.next();
        this._destroyed.complete();
    }

    /**
     * Manually dispatch an action by its actionName and actionPayload.
     *
     * This function exists for compatibility reasons, development and devtools. It is not adviced to use
     * this function extensively.
     *
     * Note: While the observable-based actions
     * dispatches only reducers registered for that slice, the string based action dispatch here will forward the
     * action to ALL stores, (sub-)slice and parent alike so make sure you separate your actions based on the strings.
     */
    public dispatch<P>(actionName: string, actionPayload: P) {
        this.actionDispatch.next({ actionName, actionPayload });
    }

    private getOnDestroyFunctionForSlice<K>(key: keyof S, cleanupState?: CleanupState<K>): () => void {
        let onDestroy = () => { };
        if (cleanupState !== undefined) {
            onDestroy = () => {
                if (cleanupState === "undefined")
                    this.stateMutators.next(s => { s[key] = undefined; return s; });
                else if (cleanupState === "delete")
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
 * Updates a nested property in an object graph with the return value of a function
 * passed as argument.
 *
 * @param obj The object to apply the value to
 * @param updateFn Function whose return value is set to the prop. Receives the currentValue as first argument.
 * @param keychain A list of keys that are used to walk down the object graph from 0..n
 */
function setNestedProperty(obj: SObject, updateFn: (currentValue: any) => any, keyChain: string[]) {
    for (let i = 0; i < keyChain.length - 1; i++) {
        obj = obj[keyChain[i]];
    }
    let lastKey = keyChain.slice(-1)[0];
    const previousValue = obj[lastKey];
    const nextValue = updateFn(previousValue);
    obj[lastKey] = nextValue;
    return { previousValue, nextValue }
}

/**
 * Updates a nested property in an object graph with a value
 *
 * @param obj The object to apply the value to
 * @param value The value that is assigned to the nested property
 * @param keychain A list of keys that are used to walk down the object graph from 0..n
 */
function setNestedPropertyToValue(obj: SObject, value: any, keyChain: string[]) {
    return setNestedProperty(obj, () => value, keyChain);
}

export function getNestedProperty(obj: SObject, keyChain: string[]) {
    let current: any = obj;
    keyChain.map(property => {
        current = current[property]
    })
    return current;
}

export function notifyOnStateChange<S>(store: Store<S>)
    : Observable<StateChangeNotification<S>> {

    // return store.notifyAction;
    return store.rootStateChangedNotification.pipe(
        map(an => ({
            actionName: an.actionName,
            actionPayload: an.actionPayload,
            rootState: an.newState,

            // WARNING: path and sliceState refer to the reducer of the slice that triggered the action
            // It is NOT guaranteed that this is the slice's state you are subscribing to.
            path: an.path,
            sliceState: getNestedProperty(an.newState, an.path)
        }))
    )
}
