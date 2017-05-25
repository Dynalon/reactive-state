import { Subject } from "rxjs/Rx";

/**
 * Actions basically just extend Subject that emit a Payload P and can have a string name to identify
 * the action. This can be used in future versions to produce action logs, replay them from a log/storage, etc.
 */
export class Action<P> extends Subject<P> {
    constructor(public name: string | undefined = undefined) {
        super();
    }
}