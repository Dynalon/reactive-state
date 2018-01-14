import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';

// This will be a function that dispatches actions, but should not return anything
export type ActionFunction = (...args: any[]) => any;

export type ActionMap<TProps> = {
    [P in keyof TProps]?: ActionFunction | Observer<any>
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

        if (field === undefined) continue;

        if (typeof field === "function") {
            let func = (actionMap as any)[ownProp];
            actionProps[ownProp] = func;
        }
        // check if its an observable
        else if (typeof field.next === "function") {
            actionProps[ownProp] = (arg1: any, ...args: any[]) => field.next(arg1);
        }
    }
    return actionProps;
}
