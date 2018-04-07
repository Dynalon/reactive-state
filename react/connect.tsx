import * as React from "react";
import { Subscription } from "rxjs/Subscription";
import { Store } from "../src/store";

import { ActionMap, assembleActionProps } from "./actions";

// if TS should get Exact Types feature one day (https://github.com/Microsoft/TypeScript/issues/12936)
// we should change Partial<T> to be an Exact<Partial<T>> (so we cannot have excess properties on the returned object
// that do not correspond to any component prop)
export type MapStateToProps<S, P> = (state: S) => Partial<P>;

export interface ConnectOptions<TState, TProps> {
    store?: Store<TState>;
    actionMap?: ActionMap<TProps>;
    mapStateToProps?: MapStateToProps<TState, TProps>
}

/**
 * Connects a Component's props to a set of props of the application state coming from a Store object.
 * Note that all props of the original component will become optional props (their value may be undefined).
 */
export function connect<TOriginalProps, TAppState>(
    ComponentToConnect: React.ComponentType<TOriginalProps>,
    options?: ConnectOptions<TAppState, TOriginalProps>,
): React.ComponentClass<Partial<TOriginalProps> & ConnectOptions<TAppState, TOriginalProps>> {

    if (!options) {
        options = {};
    }

    const { actionMap, store, mapStateToProps } = options;
    type ComponentProps = Partial<TOriginalProps> & ConnectOptions<TAppState, TOriginalProps>;

    return class ConnectedComponent extends React.Component<ComponentProps, object> {

        private subscription?: Subscription
        private actionProps?: Partial<TOriginalProps>;

        constructor(props: ComponentProps, context: any) {
            super(props, context);
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
            this.subscription!.unsubscribe()
        }

        render() {
            return <ComponentToConnect {...this.props} {...this.state } { ...this.actionProps } />
        }
    }
}

// TODO decide if this should be exported/public api or removed at all?
export const connectComponent = <TState, TProps>(
    Comp: React.ComponentType<TProps>,
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
