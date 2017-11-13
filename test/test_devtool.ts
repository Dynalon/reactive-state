import "mocha";
import { expect } from "chai";
import { Subscription } from "rxjs/Rx";
import { Subject } from "rxjs/Subject";
import { range } from "rxjs/observable/range";
import { Store, Action, Reducer } from "../dist/index";
import { notifyOnStateChange } from "../dist/store"
import { CounterState } from "./test_common_types";

describe("Devtool notification tests", () => {

    let store: Store<CounterState>;
    let incrementAction: Action<number>;
    let incrementReducer: Reducer<CounterState, number>;
    let incrementReducerSubscription: Subscription;

    beforeEach(() => {
        const initialState = {
            counter: 0
        };
        store = Store.create(initialState);
        incrementAction = new Action<number>();
        incrementAction.name = "INCREMENT_ACTION";
        incrementReducer = (state, payload = 1) => ({ ...state, counter: state.counter + payload });
        incrementReducerSubscription = store.addReducer(incrementAction, incrementReducer);
    });

    afterEach(() => {
        store.destroy();
    });

    it("should call the devtool callback function when a state change occurs", done => {
        notifyOnStateChange(store).subscribe(({ rootState }) => {
            expect(rootState).to.deep.equal({ counter: 1 });
            done();
        })
        incrementAction.next();
    });

    it("should call the devtool callback function with the correct payload when a state change occurs", done => {
        notifyOnStateChange(store).subscribe(({ actionName, actionPayload, rootState }) => {
            expect(actionPayload).to.equal(3);
            done();
        });
        incrementAction.next(3);
    });

    it("should give the action name from the NamedObservable in the devtool notification", done => {
        incrementAction.name = "INCREMENT_ACTION";
        notifyOnStateChange(store).subscribe(({ actionName, actionPayload, rootState }) => {
            expect(actionName).to.equal(incrementAction.name);
            done();
        });
        incrementAction.next();
    });

    it("should use the overriden action name when one is given to addReducer", done => {
        incrementReducerSubscription.unsubscribe();

        notifyOnStateChange(store).subscribe(({ actionName, actionPayload, rootState }) => {
            expect(rootState).to.deep.equal({ counter: 1 });
            expect(actionName).to.equal("CUSTOM_ACTION_NAME");
            done();
        });

        store.addReducer(incrementAction, incrementReducer, "CUSTOM_ACTION_NAME");
        incrementAction.next();
    });

    it("should trigger a state change notification on a slice", done => {
        const slice = store.createSlice<number>("counter");

        notifyOnStateChange(slice).subscribe(({ actionName, actionPayload, rootState }) => {
            expect(rootState).to.deep.equal({ counter: 1 });
            expect(actionName).to.equal(incrementAction.name);
            expect(actionPayload).to.equal(1);
            done();
        });

        const incrementAction = new Action<number>("INCREMENT_ACTION");
        const incrementReducer: Reducer<number, number> = (state, payload = 1) => state + payload;
        slice.addReducer(incrementAction, incrementReducer);

        incrementAction.next(1);
    })

    it("should trigger a state change notification on the parent if a slice changes", done => {

        const store = Store.create({ counter: 0 })
        notifyOnStateChange(store).subscribe(notification => {
            expect(notification.actionName).to.equal("INCREMENT_ACTION");
            expect(notification.actionPayload).to.equal(1);
            expect(notification.rootState).to.deep.equal({ counter: 1 })
            done();
        })
        const slice = store.createSlice<number>("counter");
        const incrementAction = new Action<number>("INCREMENT_ACTION");
        const incrementReducer: Reducer<number, number> = (state, payload = 1) => state + payload;
        slice.addReducer(incrementAction, incrementReducer);

        incrementAction.next(1);
    })

    it("should trigger the correct actions matching to the state", done => {
        const setValueAction = new Action<number>("SET_VALUE");
        const store = Store.create({ value: 0 })
        const N_ACTIONS = 100000;
        store.addReducer(setValueAction, (state, value) => ({ value }));

        const counter1 = new Subject<any>();
        const counter2 = new Subject<any>();
        // finish after 100 actions dispatched
        counter1.zip(counter2).take(N_ACTIONS).toArray().subscribe(() => done());

        notifyOnStateChange(store).subscribe(({ actionName, actionPayload, rootState }) => {
            expect(rootState.value).to.equal(actionPayload);
            expect(actionName).to.equal("SET_VALUE");
            counter2.next();
        });

        range(1, N_ACTIONS).subscribe(n => {
            // random wait between 1 ms and 500ms
            const wait = Math.ceil(Math.random() * 500);
            setTimeout(() => {
                setValueAction.next(n);
                counter1.next();
            }, wait);
        })

    }).timeout(10000)

});
