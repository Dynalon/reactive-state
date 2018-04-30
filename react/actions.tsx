import { Observer, Observable } from 'rxjs';
import { ExtractProps } from "./connect";

// Taken from the TypeScript docs, allows to extract all functions of a type
export type FunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];
export type FunctionProperties<T> = Pick<T, FunctionPropertyNames<T>>;

// Type that can be used to extract the first argument type of a function
export type UnaryFunction<T> = (t: T, ...args: any[]) => any;

// This will be a function that dispatches actions, but should not return anything
export type ActionFunction = (...args: any[]) => any;

// An ActionMap is a map with a list of properties, that are functions in the component props, and assigns these properties
// either a ActionFunction or an Observer
export type ActionMap<TComponentOrProps> = {
    [P in keyof FunctionProperties<ExtractProps<TComponentOrProps>>]?: ActionFunction | Observer<FunctionProperties<ExtractProps<TComponentOrProps>>[P] extends UnaryFunction<infer A> ? A : never>
}

/**
 * A map specifying which property on the components state should be populated with
 * the value of the map value (=Observable)
 *
 * @example
 *     const map = {
 *        secondsPassed: Observable.interval(1000)
 *     }
 */
export type UnpackMap<TComponentState> = {
    [P in keyof TComponentState]?: Observable<TComponentState[P]>
}

export function assembleActionProps<TOriginalProps>(actionMap: ActionMap<TOriginalProps>): Partial<TOriginalProps> {
    const actionProps: any = {};
    for (let ownProp in actionMap) {
        const field = (actionMap as any)[ownProp];
        const observerField = field as Observer<any>;

        if (field === undefined) continue;

        if (typeof field === "function") {
            let func = (actionMap as any)[ownProp];
            actionProps[ownProp] = func;
        }
        // check if its an observable - TODO typeguard?
        else if (typeof observerField.next === "function") {
            actionProps[ownProp] = (arg1: any, ...args: any[]) => observerField.next(arg1);
        } else {
            throw new Error(`unknown property value for property named "${ownProp}" in action map. Expected function or Observer`)
        }
    }
    return actionProps;
}
