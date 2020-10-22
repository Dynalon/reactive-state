import { ActionFunction, ActionMap } from "./actions";
import { connect, ConnectResult } from "./connect";
import { StoreProvider, StoreSlice, StoreProjection, WithStore, useStore, useStoreState, useStoreSlices } from "./provider";

export {
    // action
    ActionFunction,
    ActionMap,
    // connect
    connect,
    ConnectResult,
    // provider
    useStore,
    StoreProvider,
    StoreSlice,
    StoreProjection,
    WithStore,
    useStoreState,
    useStoreSlices,
};
