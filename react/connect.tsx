import * as React from "react";
import * as PropTypes from "prop-types";
import { Subscription } from "rxjs";
import { Store } from "../src/store";

import { ActionMap, assembleActionProps } from "./actions";

// Allows to get the props of a component, or pass the props themselves.
// See: https://stackoverflow.com/questions/50084643/typescript-conditional-types-extract-component-props-type-from-react-component/50084862#50084862
export type ExtractProps<TComponentOrTProps> = TComponentOrTProps extends React.Component<infer TProps, any> ? TProps : TComponentOrTProps;

// if TS should get Exact Types feature one day (https://github.com/Microsoft/TypeScript/issues/12936)
// we should change Partial<T> to be an Exact<Partial<T>> (so we cannot have excess properties on the returned object
// that do not correspond to any component prop)
export type MapStateToProps<S, TComponentOrProps> = (state: S) => Partial<ExtractProps<TComponentOrProps>> | undefined | void;

// TODO better naming
export interface ConnectResult<TAppState, TOriginalProps, TSliceState = TAppState> {
    mapStateToProps?: MapStateToProps<TSliceState, TOriginalProps>;
    actionMap?: ActionMap<TOriginalProps>;
    cleanupSubscription?: Subscription;
}

export type ConnectCallback<S, P, N> = (store: Store<S>) => ConnectResult<S, P, N> | undefined;

export interface ConnectState {
    originalProps: object;
    connectedProps: object;
}
/**
 * Connects a Component's props to a set of props of the application state coming from a Store object.
 * TODO: Use TS Extract<> type here to remove props from TOriginalProps of the resulting component?
 */
export function connect<TOriginalProps extends {}, TAppState extends {}, TSliceState>(
    ComponentToConnect: React.ComponentType<TOriginalProps>,
    connectCallback: ConnectCallback<TAppState, Partial<TOriginalProps>, TSliceState>
) {
    return class ConnectedComponent extends React.Component<Partial<TOriginalProps>, ConnectState> {

        subscription: Subscription = new Subscription();
        actionProps: Partial<TOriginalProps> = {};

        static contextTypes = {
            reactiveStateStore: PropTypes.any
        }

        constructor(props: TOriginalProps, context: any) {
            super(props, context);
        }

        componentWillMount() {
            this.setState((prevState) => ({ ...prevState, originalProps: this.props }));

            const store = this.context.reactiveStateStore as Store<TAppState>;

            if (store) {
                let result = connectCallback(store);
                if (result === undefined) {
                    result = {};
                }
                if (result.actionMap) {
                    this.actionProps = assembleActionProps(result.actionMap);
                }
                if (result.mapStateToProps) {
                    this.subscription.add(store.select().subscribe(state => {
                        this.setState((prevState) => {
                            const connectedProps: object = result!.mapStateToProps!(state as any) || {};
                            return {
                                ...prevState,
                                connectedProps,
                            }
                        });
                    }))
                }
                if (result.cleanupSubscription) {
                    this.subscription.add(result.cleanupSubscription);
                }
            }
        }

        componentDidUpdate(prevProps: any, prevState: any) {
            if (prevState === this.state) {
                this.setState((prevState) => ({ ...prevState, originalProps: this.props }))
            }
        }

        componentWillUnmount() {
            this.subscription.unsubscribe()
        }

        render() {
            return <div>
                <ComponentToConnect {...this.state.connectedProps} {...this.actionProps} {...this.state.originalProps} />
            </div>
        }

    }
}

// TODO decide what to keep
// export function withStoreAlternate<S, P>(fn: (store: Store<S>) => JSX.Element) {
//     return class extends React.Component<Exclude<P, { store: Store<S> }>, {}> {
//         static contextTypes = {
//             reactiveStateStore: PropTypes.any
//         }

//         render() {
//             // TODO check that store is set? (i.e. warn user he needs a StoreProvider)
//             return fn(this.context.reactiveStateStore);
//         }
//     }
// }

// export function withStore<S, P extends { store: Store<S> }>(OriginalComponent: React.ComponentType<P>) {
//     return class extends React.Component<P, {}> {
//         static contextTypes = {
//             reactiveStateStore: PropTypes.any
//         }

//         render() {
//             // TODO check that store is set? (i.e. warn user he needs a StoreProvider)
//             return <OriginalComponent store={this.context.reactiveStateStore} { ...this.props} />
//         }
//     }
// }