import * as React from "react";
import { Subscription, Observable } from "rxjs";
import { Store } from "../src/store";
import { StoreConsumer } from "./provider"

import { ActionMap, assembleActionProps } from "./actions";

// Allows to get the props of a component, or pass the props themselves.
// See: https://stackoverflow.com/questions/50084643/typescript-conditional-types-extract-component-props-type-from-react-component/50084862#50084862
export type ExtractProps<TComponentOrTProps> = TComponentOrTProps extends React.Component<infer TProps, any> ? TProps : TComponentOrTProps;

// if TS should get Exact Types feature one day (https://github.com/Microsoft/TypeScript/issues/12936)
// we should change Partial<T> to be an Exact<Partial<T>> (so we cannot have excess properties on the returned object
// that do not correspond to any component prop)
export type MapStateToProps<TComponentOrProps, TState = any> = (store: Store<TState>) => Observable<Partial<ExtractProps<TComponentOrProps>>>;

// TODO better naming
export interface ConnectResult<TAppState, TOriginalProps> {
    mapStateToProps?: MapStateToProps<TOriginalProps, TAppState>;
    actionMap?: ActionMap<TOriginalProps>;
    cleanup?: Subscription;
}

export type ConnectCallback<S, P> = (store: Store<S>) => ConnectResult<S, P>;

export interface ConnectState {
    originalProps: object;
    connectedProps: object;
}

/**
 * Connects a Component's props to a set of props of the application state coming from a Store object.
 * Note: The returned component is a PureComponent - so make sure to update a prop immutably
 */
export function connect<TAppState, TOriginalProps extends {}>(
    ComponentToConnect: React.ComponentType<TOriginalProps>,
    connectCallback: ConnectCallback<TAppState, Partial<TOriginalProps>>
) {
    class ConnectedComponent extends React.PureComponent<Partial<TOriginalProps> & { reactiveStateStore: Store<TAppState> }, ConnectState> {

        subscription: Subscription = new Subscription();
        actionProps: Partial<TOriginalProps> = {};

        constructor(props: any) {
            super(props)
        }

        componentWillMount() {
            this.setState((prevState) => ({ ...prevState, originalProps: this.props }));

            const store = this.props.reactiveStateStore;

            // we might use the connected component  without a store (i.e. in test scenarios). In this case we do
            // not do anything and just behave as if we were not connected at all
            const weHaveNoStoreEnvironmentAndBehaveAsTheOriginalComponent = store === undefined;
            if (weHaveNoStoreEnvironmentAndBehaveAsTheOriginalComponent) {
                return;
            }

            const result = connectCallback(store);

            if (result.actionMap) {
                this.actionProps = assembleActionProps(result.actionMap);
            }

            if (result.mapStateToProps) {
                const stateUpdates = result.mapStateToProps(store);
                this.subscription.add(stateUpdates.subscribe(connectedState => {
                    this.setState((prevState: ConnectState) => {
                        return {
                            ...prevState,
                            connectedProps: connectedState
                        }
                    });
                }))
            }

            if (result.cleanup) {
                this.subscription.add(result.cleanup);
            }
        }

        componentDidUpdate(prevProps: any, prevState: any) {
            if (prevState === this.state) {
                this.setState((prevState: ConnectState) => ({ ...prevState, originalProps: this.props }))
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
    };

    return class extends React.PureComponent<Partial<TOriginalProps>, ConnectState> {
        constructor(props: any) {
            super(props);
        }

        render() {
            return <StoreConsumer>
                {value => <ConnectedComponent reactiveStateStore={value} {...this.props as any} />}
            </StoreConsumer>
        }
    }
}
