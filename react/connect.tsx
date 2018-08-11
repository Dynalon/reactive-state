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

export interface ConnectState<TOriginalProps> {
    connectedProps?: Partial<TOriginalProps>;
    ready: boolean;
}

/**
 * Connects a Component's props to a set of props of the application state coming from a Store object.
 * Note: The returned component is a PureComponent - so make sure to update a prop immutably
 */
export function connect<TAppState, TOriginalProps extends {}>(
    ComponentToConnect: React.ComponentType<TOriginalProps>,
    connectCallback: ConnectCallback<TAppState, Partial<TOriginalProps>>
) {
    class ConnectedComponent extends React.PureComponent<Partial<TOriginalProps> & { reactiveStateStore: Store<TAppState> }, ConnectState<TOriginalProps>> {

        private subscription: Subscription = new Subscription();
        private actionProps: Partial<TOriginalProps> = {};
        private connectResult?: ConnectResult<TAppState, Partial<TOriginalProps>>
        private store: Store<TAppState>;

        /**
         * we might use the connected component  without a store (i.e. in test scenarios). In this case we do
         * not do anything and just behave as if we were not connected at all
         */
        private get passthroughProps() {
            return this.store === undefined;
        }

        state: ConnectState<TOriginalProps> = {
            connectedProps: undefined,
            ready: false
        }

        constructor(props: any) {
            super(props)

            this.store = this.props.reactiveStateStore;
            this.connect();
        }

        private connect() {
            if (this.passthroughProps)
                return;

            this.connectResult = connectCallback(this.store);

            if (this.connectResult.actionMap) {
                this.actionProps = assembleActionProps(this.connectResult.actionMap);
            }

            if (this.connectResult.cleanup) {
                this.subscription.add(this.connectResult.cleanup);
            }
        }

        private subscribeToStateChanges() {
            if (this.passthroughProps)
                return;

            const connectResult = this.connectResult!;
            if (connectResult.mapStateToProps) {
                const stateUpdates = connectResult.mapStateToProps(this.store);
                this.subscription.add(stateUpdates.subscribe(connectedState => {
                    this.setState((prevState: ConnectState<TOriginalProps>) => {
                        return {
                            ...prevState,
                            ready: true,
                            connectedProps: connectedState
                        }
                    });
                }))
            } else {
                this.setState((prevState: ConnectState<TOriginalProps>) => ({ ready: true }))
            }
        }

        /**
         * We need to remove the remoteReacticeState properties from our input props; the remainder input props
         * are passed down to the connected component
         */
        private getProps(): TOriginalProps {
            const props: TOriginalProps & { reactiveStateStore: any } = { ...(this.props as any) };
            delete props.reactiveStateStore;
            return props;
        }

        componentWillUnmount() {
            this.subscription.unsubscribe()
        }

        componentDidMount() {
            this.subscribeToStateChanges();
        }

        render() {
            const props = this.getProps();

            if (this.passthroughProps || this.state.ready === true) {
                return <ComponentToConnect {...this.state.connectedProps} {...this.actionProps} {...props} />
            } else {
                return null;
            }
        }
    };

    return class extends React.PureComponent<Partial<TOriginalProps>, ConnectState<TOriginalProps>> {
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
