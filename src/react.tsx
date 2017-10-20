import * as React from "react";
import { Subscription } from "rxjs/Subscription";
import { Observer } from "rxjs/Observer";

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
