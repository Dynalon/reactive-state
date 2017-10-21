import * as React from "react";
import { Subscription } from "rxjs/Subscription";
import { Observer } from "rxjs/Observer";
import { Observable } from "rxjs/Observable";

import { Store } from "./store";

function assembleActionProps<TOriginalProps>(actionMap: ActionMap<TOriginalProps>): Partial<TOriginalProps> {
    const actionProps: any = {};
    for (let ownProp in actionMap) {
        const field = (actionMap as any)[ownProp];

        if (typeof field === "function") {
            let func = (actionMap as any)[ownProp];
           actionProps[ownProp] = func;
        }
        else if (typeof field.next === "function") {
            actionProps[ownProp] = (arg1: any, ...args: any[]) => field.next(arg1);
        }
    }
    return actionProps;
}

// This will be a function that dispatches actions, but should not return anything
export type ActionFunction = (...args: any[]) => any;

export type ActionMap<TProps> = {
    [P in keyof TProps]?: ActionFunction | Observer<any>
}

export type ComponentConstructor<TProps, TState> = new (...args: any[]) => React.Component<TProps, TState>;

// if TS should get Exact Types feature one day (https://github.com/Microsoft/TypeScript/issues/12936)
// we should change Partial<T> to be an Exact<Partial<T>> (so we cannot have excess properties on the returned object
// that do not correspond to any component prop)

/**
 * Connects a Component's props to a set of props of the application state coming from a Store object.
 *
 * @param ComponentToConnect
 * @param store
 * @param mapStateToProps
 * @param actionMap
 */
export function connect<TOriginalProps, TAppState>(
    ComponentToConnect: ComponentConstructor<TOriginalProps, object>,
    store: Store<TAppState>,
    mapStateToProps: (state: TAppState) => Partial<TOriginalProps> = (state) => ({}),
    actionMap: ActionMap<TOriginalProps> = {}
): React.ComponentClass<TOriginalProps> {

    return class ConnectedComponent extends React.Component<TOriginalProps, object> {

        private subscription: Subscription
        private actionProps: Partial<TOriginalProps>;

        constructor(...args: any[]) {
            super(...args);
            this.actionProps = assembleActionProps(actionMap);
        }

        componentWillMount() {
            this.subscription = store.select(s => s).subscribe(state => {
                this.setState((prevState, props) => mapStateToProps(state))
            })
        }

        componentWillUnmount() {
            this.subscription.unsubscribe()
        }

        render() {
            return <ComponentToConnect {...this.props} {...this.state } { ...this.actionProps } />
        }
    }
}

/**
 * A map specifying which property on the components state should be populated with the value of the map value (=observable)
 *
 * @example
 *     const map = {
 *        secondsPassed: Observable.interval(1000)
 *     }
 */
export type ObservableToStateMap<TComponentState> = {
    [P in keyof TComponentState]?: Observable<TComponentState[P]>
}

/**
 * Can be used to bind the last emitted item of an observable to a component's internal state.
 *
 * @param component - The component of which we set the internal state
 * @param map - A map for which each key in the map will used as target state property to set the observable item to
 */
export function observablesToState<TComponentState extends {}>(
    component: React.Component<object, TComponentState>,
    map: ObservableToStateMap<TComponentState>
): void {
    for (let key in map) {
        const value = map[key];
        if (value === undefined)
            continue;

        if (typeof value.subscribe === "function") {
            // TODO get rid of any
            value.subscribe(item => component.setState((prevState: any) => {
                const newState = { ...prevState };
                newState[key] = item;
                return newState;
            }));
        } else {
            throw new Error(`Could not map non-observable for property ${key}`)
        }
    }
}

export function mapToState<T, TComponentState, TComponentProps>(
    component: React.Component<TComponentProps, TComponentState>,
    observable: Observable<T>,
    setStateFn: (item: T, prevState: TComponentState, props: TComponentProps) => TComponentState) {
        return observable.subscribe(item => {
            component.setState((prevState: any, props) => {
                return setStateFn(item, prevState, props);
            })
        })
}