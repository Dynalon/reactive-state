import * as React from "react";
import { Subscription, Observable, ReplaySubject } from "rxjs";
import { Store } from "../src/store";
import { StoreConsumer } from "./provider";

import { ActionMap, assembleActionProps } from "./actions";
import { takeUntil } from "rxjs/operators";

// Allows to get the props of a component, or pass the props themselves.
// See: https://stackoverflow.com/questions/50084643/typescript-conditional-types-extract-component-props-type-from-react-component/50084862#50084862
export type ExtractProps<TComponentOrTProps> = TComponentOrTProps extends React.ComponentType<infer TProps>
    ? TProps
    : TComponentOrTProps;

export interface ConnectResult<TAppState, TOriginalProps> {
    props?: Observable<TOriginalProps>;
    actionMap?: ActionMap<TOriginalProps>;
}

export type ConnectCallback<S, P, TInputProps> = (
    store: Store<S>,
    inputProps: Observable<TInputProps>,
) => ConnectResult<S, P>;

export interface ConnectState<TOriginalProps> {
    connectedProps?: Partial<TOriginalProps>;
    ready: boolean;
}

/**
 * Connects a Component's props to a set of props of the application state coming from a Store object.
 */
// TODO: earlier TS version could infer TOriginalProps, why is this not working anymore? Bug in TS?
// possible candidate: https://github.com/Microsoft/TypeScript/issues/21734
export function connect<TAppState, TOriginalProps extends {}, TInputProps extends {} = {}>(
    ComponentToConnect: React.ComponentType<TOriginalProps>,
    connectCallback: ConnectCallback<TAppState, Partial<TOriginalProps>, TInputProps>,
) {
    class ConnectedComponent extends React.Component<
        Partial<TOriginalProps> & { reactiveStateStore: Store<TAppState> },
        ConnectState<TOriginalProps>
    > {
        private subscription: Subscription = new Subscription();
        private actionProps: Partial<TOriginalProps> = {};
        private connectResult?: ConnectResult<TAppState, Partial<TOriginalProps>>;
        private parentDestroyed?: Observable<void>;
        private inputProps = new ReplaySubject<TInputProps>(1);

        /**
         * we might use the connected component  without a store (i.e. in test scenarios). In this case we do
         * not do anything and just behave as if we were not connected at all. So we allow undefined here.
         */
        private store?: Store<TAppState>;

        state: ConnectState<TOriginalProps> = {
            connectedProps: undefined,
            ready: false,
        };

        constructor(props: TInputProps) {
            super(props as any);

            this.inputProps.next(this.getProps());
            this.subscription.add(() => this.inputProps.complete());

            if (this.props.reactiveStateStore) {
                this.store = this.props.reactiveStateStore.clone();
                // TODO this hack is necesseary because we seem to have a bug in the destroy logic for clones
                this.parentDestroyed = this.props.reactiveStateStore.destroyed;
            }
            this.connect();
        }

        private connect() {
            if (this.store === undefined) return;

            this.connectResult = connectCallback(this.store, this.inputProps.asObservable());

            if (this.connectResult.actionMap) {
                this.actionProps = assembleActionProps(this.connectResult.actionMap) as TOriginalProps;
            }
        }

        private subscribeToStateChanges() {
            if (this.store === undefined) return;

            const connectResult = this.connectResult!;
            if (connectResult.props) {
                this.subscription.add(
                    connectResult.props.pipe(takeUntil(this.parentDestroyed!)).subscribe(connectedProps => {
                        this.setState((prevState: ConnectState<TOriginalProps>) => {
                            return {
                                ...prevState,
                                connectedProps,
                                ready: true,
                            };
                        });
                    }),
                );
            } else {
                this.setState((prevState: ConnectState<TOriginalProps>) => ({ ready: true }));
            }
        }

        /**
         * We need to remove the remoteReacticeState properties from our input props; the remainder input props
         * are passed down to the connected component
         */
        private getProps(): TInputProps {
            const props: TInputProps & { reactiveStateStore: any } = { ...(this.props as any) };
            delete props.reactiveStateStore;
            return props;
        }

        componentWillUnmount() {
            if (this.store !== undefined) {
                this.store.destroy();
            }
            this.subscription.unsubscribe();
        }

        componentDidMount() {
            this.subscribeToStateChanges();
        }

        componentDidUpdate(prevProps: any) {
            if (prevProps !== this.props) {
                this.inputProps.next(this.getProps());
            }
        }

        render() {
            const props = this.getProps();

            if (this.store === undefined || this.state.ready === true) {
                return (
                    <ComponentToConnect
                        {...this.state.connectedProps}
                        {...this.actionProps as TOriginalProps}
                        {...props}
                    />
                );
            } else {
                return null;
            }
        }
    }

    return class extends React.Component<TInputProps & Partial<TOriginalProps>, ConnectState<TOriginalProps>> {
        constructor(props: any) {
            super(props);
        }

        render() {
            return (
                <StoreConsumer>
                    {value => <ConnectedComponent reactiveStateStore={value} {...this.props as any} />}
                </StoreConsumer>
            );
        }
    };
}
