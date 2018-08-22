import { EMPTY, isObservable, Observable, Subject, Subscription } from "rxjs";
import { distinctUntilChanged, filter, map, merge, publishReplay, refCount, scan, takeUntil } from "rxjs/operators";
import { shallowEqual } from "./shallowEqual";
import { ActionDispatch, CleanupState, Reducer, StateChangeNotification, StateMutation } from "./types";

// TODO use typings here
declare var require: any;
const isPlainObject = require("lodash.isplainobject");
const isObject = require("lodash.isobject");

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
export function createState<S>(stateMutators: Observable<StateMutation<S>>, initialState: S): Observable<S> {
    const state = stateMutators.pipe(
        scan((state: S, reducer: StateMutation<S>) => reducer(state), initialState),
        // these two lines make our observable hot and have it emit the last state
        // upon subscription
        publishReplay(1),
        refCount()
    )
    return state;
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
     * A list of transformation functions that will transform the state to different projections
     * and backwards. Use for scoped reducers.
     */
    private readonly forwardProjections: Function[];

    private readonly backwardProjections: Function[];

    /**
     * Is completed when the slice is unsubscribed and no longer needed.
     */
    private readonly _destroyed = new Subject<void>();

    /**
     * Used for manual dispatches without observables
     */
    private readonly actionDispatch: Subject<ActionDispatch<any>>;

    private readonly stateChangeNotificationSubject: Subject<StateChangeNotification>;

    /**
     * Only used for debugging purposes (so we can bridge Redux Devtools to the store)
     * Note: Do not use in day-to-day code, use .select() instead.
     */
    public readonly stateChangedNotification: Observable<StateChangeNotification>;

    private constructor(
        state: Observable<S>,
        stateMutators: Subject<StateMutation<S>>,
        forwardProjections: Function[],
        backwardProjections: Function[],
        onDestroy: () => void,
        notifyRootStateChangedSubject: Subject<StateChangeNotification>,
        actionDispatch: Subject<ActionDispatch<any>>
    ) {
        this.state = state;
        this.stateMutators = stateMutators;
        this.forwardProjections = forwardProjections;
        this.backwardProjections = backwardProjections;

        this._destroyed.subscribe(undefined, undefined, onDestroy);
        this.destroyed = this._destroyed.asObservable();

        this.actionDispatch = actionDispatch;

        this.stateChangeNotificationSubject = notifyRootStateChangedSubject;
        this.stateChangedNotification = this.stateChangeNotificationSubject.asObservable().pipe(takeUntil(this.destroyed));
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
        }

        const stateMutators = new Subject<StateMutation<S>>();

        const state = createState(stateMutators, initialState);

        // to make publishReplay become effective, we need a subscription that lasts
        const stateSubscription = state.subscribe();
        const onDestroy = () => { stateSubscription.unsubscribe(); };

        const store = new Store<S>(state, stateMutators, [], [], onDestroy, new Subject(), new Subject())

        // emit a single state mutation so that we emit the initial state on subscription
        stateMutators.next(s => s);
        return store;
    }

    /**
     * Creates a new linked store, that Selects a slice on the main store.
     * @deprecated
     */
    createSlice<K extends keyof S>(
        key: K,
        initialState?: S[K],
        cleanupState?: CleanupState<S[K]>
    ): Store<S[K]> {

        if (isObject(initialState) && !Array.isArray(initialState) && !isPlainObject(initialState))
            throw new Error("initialState must be a plain object, an array, or a primitive type");
        if (isObject(cleanupState) && !Array.isArray(cleanupState) && !isPlainObject(cleanupState))
            throw new Error("cleanupState must be a plain object, an array, or a primitive type");

        const forward = (state: S) => (state as any)[key] as S[K];
        const backward = (state: S[K], parentState: S) => {
            (parentState as any)[key] = state;
            return parentState;
        };

        const initial = initialState === undefined ? undefined : () => initialState;

        // legacy cleanup for slices
        const cleanup = cleanupState === undefined ? undefined : (state: any, parentState: any) => {
            if (cleanupState === "undefined") {
                parentState[key] = undefined;
            } else if (cleanupState === "delete")
                delete parentState[key];
            else {
                parentState[key] = cleanupState;
            }
            return parentState;
        }

        return this.createProjection(forward, backward, initial, cleanup);
    }

    /**
     * Create a clone of the store which holds the same state. This is an alias to createProjection with
     * the identity functions as forward/backwards projection. Usefull to unsubscribe from select()/watch()
     * subscriptions as the destroy() event is specific to the new cloned instance (=will not destroy the original)
     * Also usefull to scope string-based action dispatches to .dispatch() as action/reducers pairs added to the
     * clone can not be dispatched by the original and vice versa.
     */
    clone() {
        return this.createProjection((s: S) => s, (s: S, p: S) => s)
    }

    /**
     * Creates a new slice of the store. The slice holds a transformed state that is created by applying the
     * forwardProjection function. To transform the slice state back to the parent state, a backward projection
     * function must be given.
     * @param forwardProjection - Projection function that transforms a State S to a new projected state TProjectedState
     * @param backwardProjection - Back-Projection to obtain state S from already projected state TProjectedState
     * @param initial - Function to be called initially with state S that must return an initial state to use for TProjected
     * @param cleanup  - Function to be called when the store is destroyed to return a cleanup state based on parent state S
     */
    createProjection<TProjectedState>(
        forwardProjection: (state: S) => TProjectedState,
        backwardProjection: (state: TProjectedState, parentState: S) => S,
        initial?: (state: S) => TProjectedState,
        cleanup?: (state: TProjectedState, parentState: S) => S,
    ): Store<TProjectedState> {

        const state: Observable<TProjectedState> = this.state.pipe(map(state => forwardProjection(state)));
        const forwardProjections = [...this.forwardProjections, forwardProjection];
        const backwardProjections = [backwardProjection, ...this.backwardProjections];

        if (initial !== undefined) {
            this.stateMutators.next(s => {
                const initialReducer = () => initial(s);
                return mutateRootState(s, forwardProjections, backwardProjections, initialReducer)
            });
        }

        const onDestroy = () => {
            if (cleanup !== undefined) {
                this.stateMutators.next(s => {
                    const backward = [cleanup, ...this.backwardProjections]
                    return mutateRootState(s, forwardProjections, backward, (s: any) => s)
                })
            }
        }

        const sliceStore = new Store<TProjectedState>(
            state,
            this.stateMutators,
            forwardProjections,
            backwardProjections,
            onDestroy,
            this.stateChangeNotificationSubject,
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
     * @param action An observable whose payload will be passed to the reducer on each emit
     * @param reducer function
     * @param actionName An optional name (only used during development/debugging) to assign to the action
     */
    addReducer<P>(action: Observable<P> | string, reducer: Reducer<S, P>, actionName?: string): Subscription {
        if (typeof action === "string" && typeof actionName !== "undefined")
            throw new Error("cannot specify a string-action AND a string alias at the same time")
        if (!isObservable(action) && typeof action !== "string")
            throw new Error("first argument must be an observable or a string");
        if (typeof reducer !== "function")
            throw new Error("reducer argument must be a function");
        if ((typeof actionName === "string" && actionName.length === 0) ||
            (typeof action === "string" && action.length === 0))
            throw new Error("action/actionName must have non-zero length")

        const name = typeof action === "string" ? action : actionName!;

        const actionFromStringBasedDispatch = this.actionDispatch.pipe(
            filter(s => s.actionName === name),
            map(s => s.actionPayload),
            merge(isObservable(action) ? action : EMPTY),
            takeUntil(this.destroyed),
        )

        const rootReducer: RootReducer<S, P> = (payload: P) => (rootState) => {

            // transform the rootstate to a slice by applying all forward projections
            const sliceReducer = (slice: any) => reducer(slice, payload);
            rootState = mutateRootState(rootState, this.forwardProjections, this.backwardProjections, sliceReducer)

            // Send state change notification
            const changeNotification: StateChangeNotification = {
                actionName: name,
                actionPayload: payload,
                newState: rootState
            }
            this.stateChangeNotificationSubject.next(changeNotification);

            return rootState;
        }

        return actionFromStringBasedDispatch.pipe(
            map(payload => rootReducer(payload)),
        ).subscribe(rootStateMutation => {
            this.stateMutators.next(rootStateMutation)
        });

    }

    /**
     * Selects a part of the state using a selector function. If no selector function is given, the identity function
     * is used (which returns the state of type S).
     * Note: The returned observable does only update when the result of the selector function changed
     *       compared to a previous emit. A shallow copy test is performed to detect changes.
     *       This requires that your reducers update all nested properties in
     *       an immutable way, which is required practice with Redux and also with reactive-state.
     *       To make the observable emit any time the state changes, use .select() instead
     *       For correct nested reducer updates, see:
     *         http://redux.js.org/docs/recipes/reducers/ImmutableUpdatePatterns.html#updating-nested-objects
     *
     * @param selectorFn    A selector function which returns a mapped/transformed object based on the state
     * @returns             An observable that emits the result of the selector function after a
     *                      change of the return value of the selector function
     */
    watch<T = S>(selectorFn?: (state: S) => T): Observable<T> {
        return this.select(selectorFn).pipe(
            distinctUntilChanged((a, b) => shallowEqual(a, b)),
        )
    }

    /**
     * Same as .watch() except that EVERY state change is emitted. Use with care, you might want to pipe the output
     * to your own implementation of .distinctUntilChanged() or use only for debugging purposes.
     */
    select<T = S>(selectorFn?: (state: S) => T): Observable<T> {
        if (!selectorFn)
            selectorFn = (state: S) => <T><any>state;

        const mapped = this.state.pipe(
            takeUntil(this._destroyed),
            map(selectorFn),
        )

        return mapped;
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
}

function mutateRootState<S, TSlice>(
    rootState: S,
    forwardProjections: Function[],
    backwardProjections: Function[],
    sliceReducer: (state: TSlice) => TSlice,
) {
    // transform the rootstate to a slice by applying all forward projections
    let forwardState: any = rootState;
    const intermediaryState = [rootState] as any[];
    forwardProjections.map(fp => {
        forwardState = fp.call(undefined, forwardState)
        intermediaryState.push(forwardState)
    })
    // perform the reduction
    const reducedState = sliceReducer(forwardState);

    // apply all backward projections to obtain the root state again
    let backwardState = reducedState;
    [...backwardProjections].map((bp, index) => {
        const intermediaryIndex = intermediaryState.length - index - 2;
        backwardState = bp.call(undefined, backwardState, intermediaryState[intermediaryIndex]);
    })

    return backwardState;
}
