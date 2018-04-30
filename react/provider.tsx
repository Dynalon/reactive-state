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
    slice: (store: Store<TAppState>) => keyof TAppState
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
        const key: keyof TAppState = this.props.slice(store);
        this.slice = store.createSlice(key);
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
