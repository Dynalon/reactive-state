import * as React from "react";
import { Subscription } from "rxjs/Subscription";
import { Observer } from "rxjs/Observer";
import { Observable } from "rxjs/Observable";

import { Store } from "./store";

function assembleActionProps<TOriginalProps>(actionMap: ActionMap<TOriginalProps>): Partial<TOriginalProps> {
    const actionProps: any = {};
    for (let ownProp in actionMap) {
        const field = actionMap[ownProp];

        if (field === undefined) continue;

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
export type MapStateToProps<S, P> = (state: S) => Partial<P>;

export type ComponentConstructor<TProps, TState> = new (...args: any[]) => React.Component<TProps, TState>;

export interface ConnectOptions<TState, TProps> {
    store?: Store<TState>;
    actionMap?: ActionMap<TProps>;
    mapStateToProps?: MapStateToProps<TState, TProps>
}
// if TS should get Exact Types feature one day (https://github.com/Microsoft/TypeScript/issues/12936)
// we should change Partial<T> to be an Exact<Partial<T>> (so we cannot have excess properties on the returned object
// that do not correspond to any component prop)

export type Optional<T> = { [P in keyof T]?: T[P] | undefined }

/**
 * Connects a Component's props to a set of props of the application state coming from a Store object.
 * Note that all props of the original component will become optional props (their value may be undefined).
 */
export function connect<TOriginalProps, TAppState>(
    ComponentToConnect: ComponentConstructor<TOriginalProps, object>,
    options?: ConnectOptions<TAppState, TOriginalProps>,
): React.ComponentClass<Partial<TOriginalProps> & ConnectOptions<TAppState, TOriginalProps>> {

    if (!options) {
        options = {};
    }

    const { actionMap, store, mapStateToProps } = options;
    type ComponentProps = TOriginalProps & ConnectOptions<TAppState, TOriginalProps>;

    return class ConnectedComponent extends React.Component<ComponentProps, object> {

        private subscription: Subscription
        private actionProps: Partial<TOriginalProps>;

        constructor(...args: any[]) {
            super(...args);
        }

        componentWillMount() {
            if (!!this.props.store && !!store) {
                throw new Error("Connected component with late-bound store must be passed a store reference as prop");
            }
            const boundStore = (this.props.store || store) as Store<TAppState>;

            const empty = (state: any) => ({});
            const boundMapStateToProps = (
                this.props.mapStateToProps || mapStateToProps || empty
            ) as MapStateToProps<TAppState, TOriginalProps>;

            const boundActionMap = (this.props.actionMap || actionMap || {}) as ActionMap<TOriginalProps>;
            this.actionProps = assembleActionProps(boundActionMap);

            this.subscription = boundStore.select().subscribe(state => {
                this.setState((prevState, props) => boundMapStateToProps(state))
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

// TODO decide if this should be exported/public api or removed at all?
export const connectComponent = <TState, TProps>(
    Comp: React.ComponentClass<TProps>,
    store?: Store<TState> | ConnectOptions<TState, TProps>,
    mapStateToProps?: MapStateToProps<TState, TProps>,
    actionMap?: ActionMap<TProps>
) => {
    return (props: TProps & ConnectOptions<TState, TProps>) => {
        let connectProps: ConnectOptions<TState, TProps> = {};
        if (store && store instanceof Store) {
            connectProps = { store, mapStateToProps, actionMap };
        } else if (store) {
            connectProps = store;
        } else {
            throw new Error("second argument must be a store or options object");
        }
        const Wrapped = connect(Comp, connectProps);
        return <Wrapped {...props as any} />
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
export type unpackMap<TComponentState> = {
    [P in keyof TComponentState]?: Observable<TComponentState[P]>
}

/**
 * Can be used to bind the last emitted item of multiple observables to a component's internal state.
 *
 * @param component - The component of which we set the internal state
 * @param map - A map for which each key in the map will used as target state property to set the observable item to
 */
export function unpackToState<TComponentState extends {}>(
    component: React.Component<object, TComponentState>,
    map: unpackMap<TComponentState>
): Subscription {
    const subscriptions = new Subscription();
    for (let key in map) {
        const observable = map[key];
        if (observable === undefined)
            continue;

        if (typeof observable.subscribe !== "function") {
            throw new Error(`Could not map non-observable for property ${key}`)
        }
        subscriptions.add(bindToState(component, observable, key));
    }
    return subscriptions;
}

export function mapToState<T, TComponentState, TComponentProps>(
    component: React.Component<TComponentProps, TComponentState>,
    source: Observable<T>,
    setStateFn: (item: T, prevState: TComponentState, props: TComponentProps) => TComponentState
): Subscription {

    return source.subscribe(item => {
        component.setState((prevState: TComponentState, props: TComponentProps) => {
            return setStateFn(item, prevState, props);
        })
    })
}

/**
 * Sets the emitted values of an observable to a components state using setState()
 */
export function bindToState<T, TState extends object>(
    component: React.Component<any, TState> ,
    source: Observable<T>,
    stateKey: keyof TState
): Subscription {
    return source.subscribe(item => {
        const patch = { [stateKey]: item };
        component.setState((prevState: object) => ({ ...prevState, ...patch }))
    })
}
