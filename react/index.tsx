import { ActionFunction, ActionMap } from './actions';
import { connect, MapStateToProps, ConnectResult } from './connect';
import { StoreProvider, StoreSlice } from './provider'

export {
    // Action
    ActionFunction,
    ActionMap,

    // connect
    MapStateToProps,
    connect,
    ConnectResult,

    StoreProvider,
    StoreSlice,
    // withStore,
    // withStoreAlternate,
}