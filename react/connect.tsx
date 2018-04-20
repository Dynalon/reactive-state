import * as React from "react";
import * as PropTypes from "prop-types";
import { Subscription } from "rxjs/Subscription";
import { Store } from "../src/store";

import { ActionMap, assembleActionProps } from "./actions";

// if TS should get Exact Types feature one day (https://github.com/Microsoft/TypeScript/issues/12936)
// we should change Partial<T> to be an Exact<Partial<T>> (so we cannot have excess properties on the returned object
// that do not correspond to any component prop)
export type MapStateToProps<S, P> = (state: S) => Partial<P>;

// TODO better naming
export interface ConnectResult<S, P, N = S> {
    mapStateToProps: MapStateToProps<N, P>;
    actionMap: ActionMap<P>;
    store: Store<N>;
    cleanupSubscription?: Subscription;
}

export type ConnectCallback<S, P, N> = (store: Store<S>) => ConnectResult<S, P, N>;

/**
 * Connects a Component's props to a set of props of the application state coming from a Store object.
 * TODO: Use TS Extract<> type here to remove props from TOriginalProps of the resulting component?
 */
export function connect<TOriginalProps, TAppState extends {}, TSliceState>(
    ComponentToConnect: React.ComponentType<TOriginalProps>,
    connectCallback: ConnectCallback<TAppState, Partial<TOriginalProps>, TSliceState>
) {
    return class ConnectedComponent extends React.Component<Partial<TOriginalProps>, object> {

        subscription: Subscription = new Subscription();
        actionProps: Partial<TOriginalProps> = {};

        static contextTypes = {
            reactiveStateStore: PropTypes.any
        }

        constructor(props: TOriginalProps, context: any) {
            super(props, context);
        }

        componentWillMount() {
            const store = this.context.reactiveStateStore as Store<TAppState>;
            if (!store) {
                throw new Error("Connected component with late-bound store must be passed a store reference as prop");
            }
            const result = connectCallback(store);

            if (result.actionMap) {
                this.actionProps = assembleActionProps(result.actionMap);
            }

            if (result.mapStateToProps) {
                this.subscription.add(result.store.select().subscribe(state => {
                    this.setState((prevState, props) => result.mapStateToProps(state))
                }))
            }

            if (result.cleanupSubscription) {
                this.subscription.add(result.cleanupSubscription);
            }
        }

        componentWillUnmount() {
            this.subscription.unsubscribe()
        }

        render() {
            return <div><ComponentToConnect {...this.props} {...this.state} {...this.actionProps} /></div>
        }
    }
}

export function withStore<TAppState, TComponentProps extends {  store?: Store<TAppState> }>(Component: React.ComponentType<TComponentProps>) {
    return class extends React.Component<TComponentProps, {}> {
        static contextTypes = {
            reactiveStateStore: PropTypes.any
        }

        render() {
            // TODO check that store is set? (i.e. warn user he needs a StoreProvider)
            return <Component { ...this.props} store={this.context.reactiveStateStore} />
        }
    }
}