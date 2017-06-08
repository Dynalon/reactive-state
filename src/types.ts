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
export type Reducer<S, P> = (state: S, actionPayload: P) => S;

/**
 * Type of a "cleanup" state object that will be set to the slice when the sliceStore gets destroyed
 */
export type CleanupState<K> = K |  null | "undefined";

export interface NamedObservable<T> extends Observable<T> {
    name?: string;
}

export interface DevTool {
    notifyStateChange: (actionName: string, payload: any, newState: any) => void;
}