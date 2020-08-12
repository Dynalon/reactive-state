import { Store } from "../src/index";
import * as React from "react";

const context = React.createContext<Store<any> | undefined>(undefined);
const { Provider, Consumer } = context;

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
    slice: (store: Store<TAppState>) => TKey;
    initialState?: TAppState[TKey];
    cleanupState?: TAppState[TKey] | "delete" | "undefined";
}

export class StoreSlice<TAppState, TKey extends keyof TAppState> extends React.Component<
    StoreSliceProps<TAppState, TKey>,
    {}
> {
    slice?: Store<TAppState[TKey]>;

    componentWillUnmount() {
        this.slice!.destroy();
    }

    render() {
        return (
            <Consumer>
                {(store: Store<TAppState> | undefined) => {
                    if (!store)
                        throw new Error(
                            "StoreSlice used outside of a Store context. Did forget to add a <StoreProvider>?",
                        );

                    // we ignore this else due to a limitation in enzyme - we can't trigger a
                    // forceUpdate here to test the else branch;
                    /* istanbul ignore else */
                    if (this.slice === undefined) {
                        this.slice = store.createSlice(
                            this.props.slice(store),
                            this.props.initialState,
                            this.props.cleanupState,
                        );
                    }
                    return <Provider value={this.slice}>{this.props.children}</Provider>;
                }}
            </Consumer>
        );
    }
}

export interface StoreProjectionProps<TState, TProjected> {
    forwardProjection: (state: TState) => TProjected;
    backwardProjection: (projectedState: TProjected, parentState: TState) => TState;
    cleanup?: (state: TProjected, parentState: TState) => TState;
    initial?: (state: TState) => TProjected;
}

export const StoreProjection = class StoreProjection<TState, TProjected> extends React.Component<
    StoreProjectionProps<TState, TProjected>,
    {}
> {
    slice?: Store<TProjected>;

    componentWillUnmount() {
        this.slice!.destroy();
    }

    render() {
        return (
            <Consumer>
                {(store: Store<TState> | undefined) => {
                    if (!store)
                        throw new Error(
                            "StoreProjection/Slice used outside of a Store context. Did forget to add a <StoreProvider>?",
                        );

                    // we ignore this else due to a limitation in enzyme - we can't trigger a
                    // forceUpdate here to test the else branch;
                    /* istanbul ignore else */
                    if (this.slice === undefined) {
                        this.slice = store.createProjection(
                            this.props.forwardProjection,
                            this.props.backwardProjection,
                            this.props.initial,
                            this.props.cleanup,
                        );
                    }
                    return <Provider value={this.slice}>{this.props.children}</Provider>;
                }}
            </Consumer>
        );
    }
};

export class WithStore extends React.Component<{}, {}> {
    render() {
        return (
            <Consumer>
                {store => {
                    const child = this.props.children as (store: Store<any>) => React.ReactNode;
                    if (!store)
                        throw new Error(
                            "WithStore used but no store could be found in context. Did you suppliy a StoreProvider?",
                        );
                    else if (typeof this.props.children !== "function")
                        throw new Error("WithStore used but its child is not a function.");
                    else return child(store);
                }}
            </Consumer>
        );
    }
}

/**
 * A react hook to obtain the current store, depending on the context.
 */
export function useStore<T = {}>() {
    const store = React.useContext(context);
    if (store === undefined) {
        throw new Error("No store found in context, did you forget to add a Provider for it?");
    }
    return store as Store<T>;
}

/**
 * A react hook to mirror the pattern of connect through a hooks-based interface.
 */
export function useStoreState(): object;
export function useStoreState<TState extends object>(): TState;
export function useStoreState<TState extends object, TSlice extends object>(projection: (state: TState) => TSlice): TSlice;
export function useStoreState<TState extends object, TSlice extends object = TState>(projection?: (state: TState) => TSlice): TSlice {
    const store = useStore<TState>();
    const [slice, setSlice] = React.useState<TSlice>(projection ? projection(store.currentState) : store.currentState as unknown as TSlice);

    React.useEffect(() => {
        const sub = store.watch(projection).subscribe(setSlice);
        return () => sub.unsubscribe();
    }, [store]);

    return slice;
}

/**
 * A react hook to create a fluent interface for producing a hook that makes state slices.
 * Useful mainly for infering the type of the slice; when the type of slice is known, useStoreState is cleaner.
 */
export function useSlicer<TState extends object>(): <TSlice extends object>(projection: (state: TState) => TSlice) => TSlice {
    return function useSlice<TSlice extends object>(projection: (state: TState) => TSlice): TSlice {
        return useStoreState<TState, TSlice>(projection);
    };
}