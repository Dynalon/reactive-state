import { Store } from "../src/index";
import * as React from "react";
import * as PropTypes from "prop-types"

export interface StoreProviderProps {
    store: Store<{}>;
}

export class StoreProvider extends React.Component<StoreProviderProps, {}> {

    static childContextTypes = {
        reactiveStateStore: PropTypes.any
    }


    getChildContext() {
        return {
            reactiveStateStore: this.props.store as Store<{}>
        }
    }
    render() {
        return <div>{this.props.children}</div>;
    }
}

export interface StoreSliceProps<TAppState> {
    slice: (store: Store<TAppState>) => TAppState[keyof TAppState];
    initialState?: TAppState[keyof TAppState];
    cleanupState?: TAppState[keyof TAppState] | "delete" | "undefined"
}
export interface StoreSliceState<TSliceState> {
    slice: Store<TSliceState>
}

export const StoreSlice = class StoreSlice<TAppState, TSliceState> extends React.Component<StoreSliceProps<TAppState>, StoreSliceState<TSliceState>> {

    // private slice?: Store<keyof TAppState>;
    public slice?: any;

    getChildContext() {
        return {
            reactiveStateStore: this.slice as Store<TSliceState>
        }
    }

    componentWillMount() {
        const store = this.context.reactiveStateStore as Store<TAppState>;
        const key: any = this.props.slice(store);
        this.slice = store.createSlice(key, this.props.initialState as any, this.props.cleanupState as any);
    }

    componentWillUnmount() {
        this.slice.destroy();
    }

    render() {
        return <>{this.props.children}</>
    }
};

// Instead of static fields we use this to make code coverage tool happy
(StoreSlice as any).contextTypes = {
    reactiveStateStore: PropTypes.any
};

(StoreSlice as any).childContextTypes = {
    reactiveStateStore: PropTypes.any
};

export class WithStore extends React.Component<{}, {}> {
    public store?: Store<any>;

    static contextTypes = {
        reactiveStateStore: PropTypes.any
    }

    componentWillMount() {
    }

    render() {
        const store = this.context.reactiveStateStore;
        if (!store)
            throw new Error("WithStore used but no store could be found in context. Did you suppliy a StoreProvider?")
        else if (typeof this.props.children !== "function")
            throw new Error("WithStore used but its child is not a function.")
        else {
            const child = this.props.children as (store: Store<any>) => React.ReactNode;
            return <>{child(store)}</>
        }
    }
}