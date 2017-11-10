import { createStore, StoreEnhancer, compose, Action as ReduxAction } from "redux";
import { Store, notifyOnStateChange } from "./store";
import { Subject } from "rxjs/Subject";

import { take } from "rxjs/operators"

/* istanbul ignore next */


export function enableDevTool<S extends object>(store: Store<S>) {

    console.warn(" enableDevTool is work in progress; its not fully working and require the browser extension!");

    if (typeof window === "undefined" || !(window as any)["devToolsExtension"]) {
        console.warn("devToolsExtension not found in window (extension not installed?). Could not enable devTool");
        return;
    }

    const devtoolExtension: StoreEnhancer<S> = (window as any)["devToolsExtension"]();
    const reduxToReactiveSync = new Subject<S>();
    const reactiveStateUpdate = new Subject<any>();

    // TODO get typing when s=> is undefined
    store.select(s => s, true).pipe(take(1)).subscribe(initialState => {
        let currentState: S = initialState;

        const enhancer = (next: any) => {
            return (reducer: any, initialState: any) => {
                const store = next(reducer, initialState);

                // write back the state from DevTools/Redux to our ReactiveState
                store.subscribe(() => {
                    const reduxState = store.getState();
                    reduxToReactiveSync.next(reduxState);
                })

                reactiveStateUpdate.subscribe(p => {
                    currentState = p.state;
                    store.dispatch({ type: p.actionName, payload: p.payload, state: p.state });
                });
                return store;
            };
        };

        const reduxReducer = (state: S, action: ReduxAction & { state: any }) => {
            return { ...action.state };
        }

        createStore(
            reduxReducer as any,
            initialState,
            compose(enhancer, devtoolExtension)
        );
    });


    notifyOnStateChange(store).subscribe(notification => {
        const { actionName, actionPayload, rootState } = notification;
        if (actionName !== "__INTERNAL_SYNC")
            reactiveStateUpdate.next({ actionName, payload: actionPayload, state: rootState });
    })

    const syncReducer = (state: S, payload: any) => {
        return { ...payload };
    };
    store.addReducer(reduxToReactiveSync, syncReducer, "__INTERNAL_SYNC");
};