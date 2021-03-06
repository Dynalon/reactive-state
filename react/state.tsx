// THESE HAVE BEEN REMOVED IN v2.0

// Justification: These helpers encourage usage of observable inside of presentation components. This violates
// the smart/dumb (a.k.a. container/presentational) pattern. To not encourage new users to bad practices, they are not
// exposed anymore. Code is kept for reference and possible future internal use.

// import { Observable, Subscription } from 'rxjs';

// /**
//  * A map specifying which property on the components state should be populated with the value of the map value (=observable)
//  *
//  * @example
//  *     const map = {
//  *        secondsPassed: Observable.interval(1000)
//  *     }
//  */
// export type UnpackMap<TComponentState> = {
//     [P in keyof TComponentState]?: Observable<TComponentState[P]>
// }

// /*
//  * Can be used to bind the last emitted item of multiple observables to a component's internal state.
//  *
//  * @param component - The component of which we set the internal state
//  * @param map - A map for which each key in the map will used as target state property to set the observable item to
//  */
// export function unpackToState<TComponentState extends {}>(
//     component: React.Component<object, TComponentState>,
//     map: UnpackMap<TComponentState>
// ): Subscription {
//     const subscriptions = new Subscription();
//     for (let key in map) {
//         const observable = map[key];
//         if (observable === undefined)
//             continue;

//         if (typeof observable.subscribe !== "function") {
//             throw new Error(`Could not map non-observable for property ${key}`)
//         }
//         subscriptions.add(bindToState(component, observable!, key));
//     }
//     return subscriptions;
// }

// export function mapToState<T, TComponentState, TComponentProps>(
//     component: React.Component<TComponentProps, TComponentState>,
//     source: Observable<T>,
//     setStateFn: (item: T, prevState: TComponentState, props: TComponentProps) => TComponentState
// ): Subscription {

//     return source.subscribe((item: T) => {
//         component.setState((prevState: TComponentState, props: TComponentProps) => {
//             return setStateFn(item, prevState, props);
//         })
//     })
// }

// /**
//  * Sets the emitted values of an observable to a components state using setState(). The
//  * subscription to the source observable is automatically unsubscribed when the component
//  * unmounts.
//  */
// export function bindToState<T, TState extends object>(
//     component: React.Component<any, TState> ,
//     source: Observable<T>,
//     stateKey: keyof TState
// ): Subscription {
//     const subscription = source.subscribe((item: T) => {
//         const patch = { [stateKey]: item };
//         // TODO eliminate any
//         component.setState((prevState: any) => ({ ...prevState, ...patch }))
//     })

//     // unsubscribe then the component is unmounted
//     const originalUnmount = component.componentWillUnmount;
//     component.componentWillUnmount = function() {
//         subscription.unsubscribe();
//         if (originalUnmount) {
//             originalUnmount.call(component);
//         }
//     }.bind(component);

//     return subscription;
// }
