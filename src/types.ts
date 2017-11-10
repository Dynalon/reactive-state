import { Observable } from "rxjs/Observable";
/**
 * A function which takes a State S and performs a transformation into a new state. The state mutation must be pure.
 * @returns A new state of type S
 */
export type StateMutation<S> = (state: S) => S;

/**
 * A reducer takes a state S, a payload P, applies a transformation using the payload to the state and
 * returns a new State. Reducers must be pure.
 */
export type Reducer<S, P = void> = (state: S, actionPayload: P) => S;

/**
 * Type of a "cleanup" state object that will be set to the slice when the sliceStore gets destroyed
 *
 * The special string "undefined" means the slice prop should be set to undefined (but the props remains there)
 * Using "delete" will remove the whole prop key from the state object (use this to leave no traces)
 */
export type CleanupState<K> = K |  null | "undefined" | "delete";

export interface NamedObservable<T> extends Observable<T> {
    name?: string;
}

export interface RootStateChangeNotification {
    actionName: string | undefined;
    actionPayload: any;

    // always the rootState object
    newState: any;

    // path on the state object relative to the root (an array of property names)
    path: string[]
}

export interface StateChangeNotification<S> {
    actionName: string | undefined;
    actionPayload: any;

    // NOTE: This is not necessarily the same slice state as the slice which triggered the state change!
    // if unsure, use the rootState and path to obtain your slices state
    sliceState: S;
    rootState: any;
    path: string[];
}