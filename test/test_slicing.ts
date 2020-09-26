import "mocha";
import { expect } from "chai";
import { Subscription, zip as zipStatic, Subject } from "rxjs";
import { take, skip, toArray } from "rxjs/operators";
import { Store, Reducer } from "../src/index";

import { ExampleState, RootState, SliceState } from "./test_common_types";

describe("Store slicing tests", () => {
    let store: Store<ExampleState>;
    let counterSlice: Store<number>;
    let incrementAction: Subject<void>;
    let incrementReducer: Reducer<number, void>;
    let incrementSubscription: Subscription;

    beforeEach(() => {
        incrementAction = new Subject<void>();
        incrementReducer = (state) => state + 1;
        store = Store.create({ counter: 0 });
    });

    afterEach(() => {
        store.destroy();
    });

    describe(" using legacy string-based key slicing", () => {
        beforeEach(() => {
            counterSlice = store.createSlice("counter");
            incrementSubscription = counterSlice.addReducer(incrementAction, incrementReducer);
        });

        it("should emit the initial state when subscribing to a freshly sliced store", (done) => {
            // sync
            expect(counterSlice.currentState).to.equal(0);

            // async
            counterSlice.select().subscribe((counter) => {
                expect(counter).to.equal(0);
                done();
            });
        });

        it("should select a slice and emit the slice value", (done) => {
            incrementAction.next();
            // sync
            expect(counterSlice.currentState).to.equal(1);

            // async
            counterSlice.select().subscribe((counter) => {
                expect(counter).to.equal(1);
                done();
            });
        });

        it("should be possible to pass a projection function to .select()", (done) => {
            store
                .select((state) => state.counter)
                .pipe(take(4), toArray())
                .subscribe((values) => {
                    expect(values).to.deep.equal([0, 1, 2, 3]);
                    done();
                });

            incrementAction.next();
            expect(counterSlice.currentState).to.equal(1);
            incrementAction.next();
            expect(counterSlice.currentState).to.equal(2);
            incrementAction.next();
            expect(counterSlice.currentState).to.equal(3);
        });

        it("should not invoke reducers which have been unsubscribed", (done) => {
            incrementSubscription.unsubscribe();

            counterSlice
                .select()
                .pipe(skip(1))
                .subscribe((state) => {
                    done("Error: This should have not been called");
                });

            incrementAction.next();
            done();
        });

        it("should emit a state change on the slice if the root store changes even when the subtree is not affected and forceEmitEveryChange is set", (done) => {
            const simpleSubject = new Subject<void>();
            const simpleMutation: Reducer<ExampleState, void> = (state) => ({ ...state });
            store.addReducer(simpleSubject, simpleMutation);

            counterSlice
                .select()
                .pipe(skip(1), take(1))
                .subscribe((counter) => {
                    expect(counter).to.equal(0);
                    done();
                });

            simpleSubject.next();
        });

        it("should not emit a state change on the slice if the root store changes and forceEmitEveryChange is not set", (done) => {
            const simpleSubject = new Subject<void>();
            const simpleMutation: Reducer<ExampleState, void> = (state) => ({ ...state });
            store.addReducer(simpleSubject, simpleMutation);

            counterSlice
                .watch()
                .pipe(skip(1), toArray())
                .subscribe((changes) => {
                    expect(changes).to.deep.equal([]);
                    done();
                });

            simpleSubject.next();
            store.destroy();
        });

        it("should trigger state changes on slice siblings", (done) => {
            const siblingStore = store.createSlice("counter");

            // async
            siblingStore
                .select()
                .pipe(skip(1))
                .subscribe((n) => {
                    expect(n).to.equal(1);
                    done();
                });

            incrementAction.next();

            // sync
            expect(siblingStore.currentState).to.equal(1);
        });

        it("should trigger state changes on slice siblings for complex states", (done) => {
            const rootStore: Store<RootState> = Store.create<RootState>({
                slice: { foo: "bar" },
            });
            const action = new Subject<void>();
            const reducer: Reducer<SliceState, void> = (state) => {
                return { ...state, foo: "baz" };
            };

            const slice1 = rootStore.createSlice("slice", { foo: "bar" });
            // TODO eliminate any
            slice1.addReducer(action, reducer as any);

            const slice2 = rootStore.createSlice("slice", { foo: "bar2" });
            slice2
                .select()
                .pipe(skip(1))
                .subscribe((slice) => {
                    if (!slice) {
                        done("ERROR");
                        return;
                    } else {
                        expect(slice.foo).to.equal("baz");
                        done();
                    }
                });

            action.next();
        });
    });

    describe(" using projection based slicing", () => {
        it("should be possible to create a clone (with identity projections) and their states should be equal", (done) => {
            const slice = store.clone();

            store.select().subscribe((storeState) => {
                slice.select().subscribe((sliceState) => {
                    expect(storeState).to.equal(sliceState);
                    expect(storeState).to.deep.equal(sliceState);
                    done();
                });
            });
        });

        it("should be possible to create a clone (with identity projections) and after reducing, their states should be equal", (done) => {
            const slice = store.clone();
            slice.addReducer(incrementAction, (state) => ({ counter: state.counter + 1 }));

            incrementAction.next();

            // sync
            expect(slice.currentState).to.equal(store.currentState);

            store.select().subscribe((storeState) => {
                // async
                slice.select().subscribe((sliceState) => {
                    expect(storeState).to.equal(sliceState);
                    expect(storeState).to.deep.equal(sliceState);
                    done();
                });
            });
        });

        it("should change both states in clone and original but fire a NamedObservable Subject only on the store that registers it", (done) => {
            const slice = store.clone();
            store.addReducer(incrementAction, (state) => ({ ...state, counter: state.counter + 1 }));

            zipStatic(store.select().pipe(skip(1)), slice.select().pipe(skip(1))).subscribe(
                ([originalState, cloneState]) => {
                    expect(originalState.counter).to.equal(1);
                    expect(cloneState.counter).to.equal(1);
                    expect(cloneState).to.deep.equal(originalState);
                    done();
                },
            );

            incrementAction.next();
        });

        it("should change both states in clone and original but fire a NamedObservable Subject only on the store that registers it", (done) => {
            const slice = store.clone();
            store.addReducer("INCREMENT_Subject", (state) => ({ ...state, counter: state.counter + 1 }));

            zipStatic(store.select().pipe(skip(1)), slice.select().pipe(skip(1))).subscribe(
                ([originalState, cloneState]) => {
                    expect(originalState.counter).to.equal(1);
                    expect(cloneState.counter).to.equal(1);
                    expect(cloneState).to.deep.equal(originalState);
                    done();
                },
            );

            store.dispatch("INCREMENT_Subject", undefined);
        });

        // was a regression
        it("should correctly apply recursive state transformations", (done) => {
            const action = new Subject<void>();
            const is = {
                prop: {
                    someArray: [] as number[],
                },
            };
            const rootStore = Store.create(is);
            const slice1 = rootStore.createProjection(
                (state) => state.prop,
                (state, parent) => ({ ...parent, prop: state }),
            );
            // const slice1 = rootStore.createSlice("prop");
            const slice2 = slice1.createSlice("someArray");

            const reducer: Reducer<number[]> = (state) => {
                expect(state).to.deep.equal([]);
                return [1];
            };
            slice2.addReducer(action, reducer);

            rootStore
                .select()
                .pipe(skip(1))
                .subscribe((state) => {
                    expect(state).to.deep.equal({
                        prop: {
                            someArray: [1],
                        },
                    });
                    rootStore.destroy();
                    done();
                });

            action.next(undefined);
        });
    });
});
