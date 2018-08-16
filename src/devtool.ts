import { createStore, StoreEnhancer, compose, Action as ReduxAction } from "redux";
import { Store } from "./store";
import { Subject } from "rxjs";
import { take } from "rxjs/operators"
import { StateChangeNotification } from "./types";

/* istanbul ignore next */

// symbols only for debugging and devtools
export { StateChangeNotification } from "./types"

export function enableDevTool<S extends object>(store: Store<S>) {

    console.warn("enableDevTool requires the browser extension. Note: the 'skip action' feature is not supported (but 'jump' works as expected')");

    if (typeof window === "undefined") {
        // nodejs deployments?
        return;
    }

    const extension = (window as any)["__REDUX_DEVTOOLS_EXTENSION__"] || (window as any)["devToolsExtension"];
    if (!extension) {
        console.warn("devToolsExtension not found in window (extension not installed?). Could not enable devTool");
        return;
    }

    const devtoolExtension: StoreEnhancer<S> = extension();
    const reduxToReactiveSync = new Subject<S>();
    const reactiveStateUpdate = new Subject<any>();

    // TODO: initialState: S should be auto-infered, maybe a bug in TS or RxJS?
    store.select().pipe(take(1)).subscribe((initialState: S) => {

        const enhancer: StoreEnhancer<any, any> = (next) => {
            return (reducer, preloadedState) => {

                // run any other store enhancers
                const reduxStore = next(reducer, initialState);

                // write back the state from DevTools/Redux to our ReactiveState
                reduxStore.subscribe(() => {
                    // const reduxState = reduxStore.getState();
                    // console.info("RDX UPD STATE: ", reduxState)
                    // console.info("JUMP/SKIP not supported, do not use or you get undefined behaviour!")
                    // reduxToReactiveSync.next(reduxState);
                })

                reactiveStateUpdate.subscribe((p: any) => {
                    // console.info("RDX DISP", p)
                    reduxStore.dispatch({ type: p.actionName, payload: p.payload, state: p.state } as any);
                });
                return reduxStore;
            };
        };

        // TODO: State should be type S, but TS does not yet support it
        // maybe after TS 2.7: https://github.com/Microsoft/TypeScript/issues/10727
        const reduxReducer = (state: any, action: ReduxAction & { state: any }) => {
            // TODO: "skip" in devtools does not work here. In plain redux, we could call our reducers with the state
            // and the action payload of the (replayed-) action. But we can"t to it with our store, as even if we
            // could reset it to a state and replay the action, the operation is async. But we must return a state
            // here in a sync manner... :(

            if (action.type === "@@INIT") {
                // redux internal action
                return { ...state };
            }
            // What we actually do is instead of returning reduce(state, action) we return the result-state we have
            // attached to action, that is kept in the log
            return { ...action.state };
        }

        createStore(
            reduxReducer as any,
            initialState,
            compose(enhancer, devtoolExtension)
        );
    });


    store.stateChangedNotification.subscribe((notification: StateChangeNotification<S>) => {
        const { actionName, actionPayload, newState } = notification;
        if (actionName !== "__INTERNAL_SYNC")
            reactiveStateUpdate.next({ actionName: actionName || "UNNAMED", payload: actionPayload, state: newState });
    })

    const syncReducer = (state: S, payload: any) => {
        return { ...payload };
    };
    store.addReducer(reduxToReactiveSync, syncReducer, "__INTERNAL_SYNC");
};

