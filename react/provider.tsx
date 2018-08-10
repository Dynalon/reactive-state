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
export interface StoreSliceState<TSliceState> {
    slice: Store<TSliceState>
}

export const StoreSlice = class StoreSlice<TAppState, TSliceState, TKey extends keyof TAppState>
    extends React.Component<StoreSliceProps<TAppState, TKey>, StoreSliceState<TSliceState>> {

    slice?: Store<TSliceState>;

    componentWillUnmount() {
        this.slice!.destroy();
    }

    render() {
        return <Consumer>
            {(store: Store<TAppState> | undefined) => {

                if (!store)
                    throw new Error("StoreSlice used outside of a Store context. Did forget to add a <StoreProvider>?")

                if (this.slice === undefined) {
                    const key: any = this.props.slice(store);
                    this.slice = store.createSlice(key, this.props.initialState as any, this.props.cleanupState as any) as any;
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