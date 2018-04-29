import { Observer, Observable } from 'rxjs';
import { ExtractProps } from "./connect";
// This will be a function that dispatches actions, but should not return anything
export type ActionFunction = (...args: any[]) => any;

export type ActionMap<TComponentOrProps> = {
    [P in keyof ExtractProps<TComponentOrProps>]?: ActionFunction | Observer<any>
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
        const field = actionMap[ownProp];
        const observerField = field as Observer<any>;

        if (field === undefined) continue;

        if (typeof field === "function") {
            let func = actionMap[ownProp];
            actionProps[ownProp] = func;
        }
        // check if its an observable - TODO typeguard?
        else if (typeof observerField.next === "function") {
            actionProps[ownProp] = (arg1: any, ...args: any[]) => observerField.next(arg1);
        }
    }
    return actionProps;
}
