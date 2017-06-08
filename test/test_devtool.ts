import "mocha";
import { expect } from "chai";
import { Subscription } from "rxjs/Rx";

import { Store, Action, Reducer } from "../dist/index";

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
        incrementReducer = (state, payload = 1) => ({ ...state, counter: state.counter + payload });
        incrementReducerSubscription = store.addReducer(incrementAction, incrementReducer);
    });

    afterEach(() => {
        store.destroy();
    });

    it("should call the devtool callback function when a state change occurs", done => {
        store.devTool = {
            notifyStateChange: (actionName, payload, state) => {
                expect(state).to.deep.equal({ counter: 1 });
                done();
            }
        };
        incrementAction.next();
    });

    it("should call the devtool callback function with the correct payload when a state change occurs", done => {
        store.devTool = {
            notifyStateChange: (actionName, payload, state) => {
                expect(payload).to.equal(3);
                done();
            }
        };
        incrementAction.next(3);
    });

    it("should give the action name from the NamedObservable in the devtool notification", done => {
        incrementAction.name = "INCREMENT_ACTION";
        store.devTool = {
            notifyStateChange: (actionName, payload, state) => {
                expect(actionName).to.equal(incrementAction.name);
                done();
            }
        };
        incrementAction.next();
    });

    it("should use the overriden action name when one is given to addReducer", done => {
        incrementReducerSubscription.unsubscribe();

        store.devTool = {
            notifyStateChange: (actionName, payload, state) => {
                expect(actionName).to.equal("CUSTOM_ACTION_NAME");
                done();
            }
        };

        store.addReducer(incrementAction, incrementReducer, "CUSTOM_ACTION_NAME");
        incrementAction.next();
    });

    it("should use the overriden action name when one is given to addReducer", done => {
        incrementReducerSubscription.unsubscribe();

        store.devTool = {
            notifyStateChange: (actionName, payload, state) => {
                expect(actionName).to.equal("CUSTOM_ACTION_NAME");
                done();
            }
        };

        store.addReducer(incrementAction, incrementReducer, "CUSTOM_ACTION_NAME");
        incrementAction.next();
    });
});