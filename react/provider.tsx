import { Store } from "../src/index";
import * as React from "react";

const { Provider, Consumer } = React.createContext<Store<any> | undefined>(undefined);

export interface StoreProviderProps {
    store: Store<{}>;
}

export class StoreProvider extends React.Component<StoreProviderProps, {}> {
    render() {
        return <Provider value={this.props.store}>{this.props.children}</Provider>;
    }
}

export const StoreConsumer = Consumer;

export interface StoreSliceProps<TAppState, TKey extends keyof TAppState> {
    slice: (store: Store<TAppState>) => TKey
    initialState?: TAppState[TKey]
    cleanupState?: TAppState[TKey] | "delete" | "undefined"
}

export class StoreSlice<TAppState, TKey extends keyof TAppState> extends React.Component<StoreSliceProps<TAppState, TKey>, {}> {

    slice?: Store<TAppState[TKey]>

    componentWillUnmount() {
        this.slice!.destroy();
    }

    render() {
        return <Consumer>
            {
                (store: Store<TAppState> | undefined) => {

                    if (!store)
                        throw new Error("StoreSlice used outside of a Store context. Did forget to add a <StoreProvider>?")

                    if (this.slice === undefined) {
                        this.slice = store.createSlice(
                            this.props.slice(store),
                            this.props.initialState,
                            this.props.cleanupState
                        )
                    }
                    return <Provider value={this.slice}>{this.props.children}</Provider>
                }
            }
        </Consumer>
    }
}

export interface StoreProjectionProps<TState, TProjected> {
    forwardProjection: (state: TState) => TProjected;
    backwardProjection: (projectedState: TProjected, parentState: TState) => TState;
    cleanup?: (state: TProjected, parentState: TState) => TState;
    initial?: (state: TState) => TProjected;
}

export const StoreProjection = class StoreProjection<TState, TProjected>
    extends React.Component<StoreProjectionProps<TState, TProjected>, {}> {

    slice?: Store<TProjected>;

    componentWillUnmount() {
        this.slice!.destroy();
    }

    render() {
        return <Consumer>
            {
                (store: Store<TState> | undefined) => {

                    if (!store)
                        throw new Error("StoreProjection/Slice used outside of a Store context. Did forget to add a <StoreProvider>?")

                    if (this.slice === undefined) {
                        this.slice = store.createProjection(
                            this.props.forwardProjection,
                            this.props.backwardProjection,
                            this.props.initial,
                            this.props.cleanup
                        )
                    }
                    return <Provider value={this.slice}>{this.props.children}</Provider>
                }
            }
        </Consumer>
    }
}

export class WithStore extends React.Component<{}, {}> {
    render() {
        return <Consumer>{store => {
            const child = this.props.children as (store: Store<any>) => React.ReactNode;
            if (!store)
                throw new Error("WithStore used but no store could be found in context. Did you suppliy a StoreProvider?")
            else if (typeof this.props.children !== "function")
                throw new Error("WithStore used but its child is not a function.")
            else
                return child(store)
        }
        }</Consumer>
    }
}