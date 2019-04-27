import { expect } from "chai";
import "mocha";
import { of, range, Subject } from "rxjs";
import { skip, take, toArray } from "rxjs/operators";
import { Reducer, Store } from "../src/index";
import { ExampleState, SliceState } from "./test_common_types";

describe("Reducer tests", () => {
    let store: Store<ExampleState>;
    let slice: Store<number>;

    beforeEach(() => {
        store = Store.create();
        slice = store.createSlice("counter", 0);
    });

    afterEach(() => {
        store.destroy();
    });

    it("should be possible to add a reducer", done => {
        // This is a compile time test: we do not want to give a generic type argument to addReducer
        // but compiling with a incompatible reducer will result in compile errors
        // Note: type arguments not expressed on purpose for this test!
        const addAction = new Subject<number>();
        const addReducer = (state, n) => state + n;
        slice.addReducer(addAction, addReducer);

        slice
            .select()
            .pipe(
                take(2),
                toArray(),
            )
            .subscribe(s => {
                expect(s).to.deep.equal([0, 1]);
                done();
            });

        addAction.next(1);
    });

    it("should be possible to add a reducer with an Observable as action", done => {
        // Note: type arguments not expressed on purpose for this test!
        const addAction = of(1);
        const addReducer: Reducer<number, number> = (state, n) => state + n;

        slice
            .select()
            .pipe(
                take(2),
                toArray(),
            )
            .subscribe(s => {
                expect(s).to.deep.equal([0, 1]);
                done();
            });

        slice.addReducer(addAction, addReducer);
    });

    it("should not be possible to pass anything else but observable/string as first argument to addReducer", () => {
        expect(() => {
            store.addReducer(5 as any, state => state);
        }).to.throw();
    });

    it("should not be possible to pass non-function argument as reducer to addReducer", () => {
        expect(() => {
            store.addReducer("foo", 5 as any);
        }).to.throw();
    });

    it("should not invoke reducers which have been unsubscribed", done => {
        const incrementAction = new Subject<number>();
        const subscription = store.addReducer(incrementAction, (state, payload) => {
            return { ...state, counter: state.counter + payload };
        });

        store
            .select()
            .pipe(
                skip(1),
                toArray(),
            )
            .subscribe(states => {
                expect(states[0].counter).to.equal(1);
                expect(states.length).to.equal(1);
                done();
            });

        incrementAction.next(1);
        subscription.unsubscribe();
        incrementAction.next(1);
        store.destroy();
    });

    it("should be possible to omit the payload type argument in reducers", done => {
        // This is a compile-time only test to verify the API works nicely.

        const incrementReducer: Reducer<number> = state => state + 1;
        const incrementAction = new Subject<void>();
        slice.addReducer(incrementAction, incrementReducer);
        slice
            .select()
            .pipe(skip(1))
            .subscribe(n => {
                expect(n).to.equal(1);
                done();
            });
        incrementAction.next();
    });

    it("should be possible to have reducers on lots of slices and have each reducer act on a slice", done => {
        const nestingLevel = 100;
        const rootStore = Store.create<SliceState>({ foo: "0", slice: undefined });

        let left = nestingLevel;
        const allDone = () => {
            left--;
            if (left == 1) done();
        };

        let currentStore = rootStore;
        range(1, nestingLevel).subscribe(n => {
            const nestedStore = currentStore.createSlice("slice", { foo: "" }) as Store<SliceState>;

            const nAsString = n.toString();
            const fooAction = new Subject<string>();
            const fooReducer: Reducer<SliceState, string> = (state, payload) => ({ ...state, foo: payload });
            nestedStore.addReducer(fooAction, fooReducer);
            nestedStore
                .select()
                .pipe(
                    skip(1),
                    take(1),
                )
                .subscribe(s => {
                    expect(s!.foo).to.equal(nAsString);
                    allDone();
                });

            fooAction.next(nAsString);
            currentStore = nestedStore;
        });
    });
});
