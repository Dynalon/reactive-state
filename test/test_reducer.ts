import "mocha";
import { expect } from "chai";
import { Observable } from "rxjs/Rx";

import { Action, Reducer, Store } from "../dist/index";
import { CounterState, SliceState } from "./test_common_types";

describe("Reducer tests", () => {
    let store: Store<CounterState>;
    let slice: Store<number>;

    beforeEach(() => {
        store = Store.create();
        slice = store.createSlice("counter", 0);
    })

    it("should be possible to add a reducer", done => {
        // This is a compile time test: we do not want to give a generic type argument to addReducer
        // but compiling with a incompatible reducer will result in compile errors
        // Note: type arguments not expressed on purpose for this test!
        const addAction = new Action<number>();
        const addReducer = (state, n) => state + n;
        slice.addReducer(addAction, addReducer);

        slice.select(s => s).take(2).toArray().subscribe(s => {
            expect(s).to.deep.equal([0, 1]);
            done();
        })

        addAction.next(1);

    });

    it("should be possible to add a reducer with an Observable as action", done => {
        // Note: type arguments not expressed on purpose for this test!
        const addAction = Observable.of(1);
        const addReducer: Reducer<number, number> = (state, n) => state + n;

        slice.select(s => s).take(2).toArray().subscribe(s => {
            expect(s).to.deep.equal([0, 1]);
            done();
        });

        slice.addReducer(addAction, addReducer);

    });

    it("should be possible to have reducers on lots of slices", done => {
        const nestingLevel = 100;
        const rootStore = Store.create<SliceState>({ foo: "0", slice: undefined });

        let left = nestingLevel;
        const allDone = () => {
            left--;
            if (left == 1) done();
        }

        let currentStore = rootStore;
        Observable.range(1, nestingLevel).subscribe(n => {
            const nestedStore = currentStore.createSlice<SliceState>("slice", { foo: "" });

            const nAsString = n.toString();
            const fooAction = new Action<string>();
            const fooReducer: Reducer<SliceState, string> = (state, payload) => ({ ...state, foo: payload });
            nestedStore.addReducer(fooAction, fooReducer);
            nestedStore.select(s => s).skip(1).take(1).subscribe(s => {
                expect(s.foo).to.equal(nAsString);
                allDone();
            })

            fooAction.next(nAsString);
            currentStore = nestedStore;
        });
    })

})