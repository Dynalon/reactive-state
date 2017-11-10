import { Action } from "./action";
import { Store, notifyOnStateChange } from "./store";
import { Reducer, StateChangeNotification, RootStateChangeNotification } from "./types";


function getNestedProperty(obj: object, keyChain: string[]) {
    let current: any = obj;
    keyChain.map(property => {
        current = (obj as any)[property]
    })
    return current;
}

export {
    Action,
    Store,
    Reducer,

    // symbols only for debugging and devtools
    RootStateChangeNotification,
    StateChangeNotification,
    notifyOnStateChange,
    getNestedProperty
}
