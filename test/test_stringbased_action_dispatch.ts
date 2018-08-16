import "mocha";
import { expect } from "chai";
import { Store, Action, Reducer } from "../src/index";
import { ExampleState } from "./test_common_types";
import { Subject } from "rxjs";

describe("String based action dispatch", () => {

    let store: Store<ExampleState>;
    let incrementReducer: Reducer<ExampleState, number>;
    const INCREMENT_ACTION = "INCREMENT_ACTION";

    beforeEach(() => {
        const initialState = {
            counter: 0
        }
        store = Store.create(initialState);
        incrementReducer = (state, payload = 1) => ({ ...state, counter: state.counter + payload });
    });

    afterEach(() => {
        store.destroy();
    });

    describe(" unsliced ", () => {
        it("should be possible to add an action string identifier instead of an observable", () => {
            expect(() => {
                store.addReducer(INCREMENT_ACTION, incrementReducer);
            }).not.to.throw();
        });

        it("should not be possible to add an action string identifier and an additional action name at the same time", () => {
            expect(() => {
                store.addReducer(INCREMENT_ACTION, incrementReducer, "FOO");
            }).to.throw();
        });

        it("should not be possible to add an empty string as action name", () => {
            expect(() => {
                store.addReducer('', incrementReducer);
            }).to.throw();
        });

        it("should be possible to add an action by string and trigger a manual dispatch on it", done => {
            store.addReducer(INCREMENT_ACTION, incrementReducer);
            store.dispatch(INCREMENT_ACTION, 1)
            store.select().subscribe(state => {
                expect(state.counter).to.equal(1);
                done();
            })
        });

        it("should be possible to add an action as NamedObservable and trigger a manual dispatch on it", done => {
            const incrementAction = new Action<number>(INCREMENT_ACTION)
            store.addReducer(incrementAction, incrementReducer);
            store.dispatch(INCREMENT_ACTION, 1)
            store.select().subscribe(state => {
                expect(state.counter).to.equal(1);
                done();
            })
        });

        it("should be possible to add an action as unnamed observable with additional action identifier and trigger a manual dispatch on it", done => {
            const incrementAction = new Subject<number>()
            store.addReducer(incrementAction, incrementReducer, INCREMENT_ACTION);
            store.dispatch(INCREMENT_ACTION, 1)
            store.select().subscribe(state => {
                expect(state.counter).to.equal(1);
                done();
            })
        });

        it("should be possible to add an action completely unnamed and nothing should happend when dispatching undefined", done => {
            const incrementAction = new Subject<number>()
            store.addReducer(incrementAction, incrementReducer);
            store.dispatch(INCREMENT_ACTION, undefined)
            store.select().subscribe(state => {
                expect(state.counter).to.equal(0);
                done();
            })
        });
    })

    describe(" sliced ", () => {
        let sliceStore: Store<number>;
        let sliceIncrementReducer: Reducer<number, number>;

        beforeEach(() => {
            sliceStore = store.createSlice("counter")
            sliceIncrementReducer = (state, payload) => state + payload;
        })

        afterEach(() => {
            sliceStore.destroy();
        })

        it("should be possible to add an action by string and trigger a manual dispatch on it, and slice and root receive the change", done => {
            sliceStore.addReducer(INCREMENT_ACTION, sliceIncrementReducer);
            sliceStore.dispatch(INCREMENT_ACTION, 1)
            store.select().subscribe(state => {
                expect(state.counter).to.equal(1);
                sliceStore.select().subscribe(counter => {
                    expect(counter).to.equal(1);
                    done();
                });
            })
        });

        it("should not be possible to add an action by string on a slice and dispatch it on the root store", done => {
            sliceStore.addReducer(INCREMENT_ACTION, sliceIncrementReducer);
            store.dispatch(INCREMENT_ACTION, 1)
            store.select().subscribe(state => {
                expect(state.counter).to.equal(0);
                sliceStore.select().subscribe(counter => {
                    expect(counter).to.equal(0);
                    done();
                });
            })
        });

        it("should not be possible to add an action by string on the root and dispatch it on the slice", done => {
            store.addReducer(INCREMENT_ACTION, incrementReducer);
            sliceStore.dispatch(INCREMENT_ACTION, 1)
            store.select().subscribe(state => {
                expect(state.counter).to.equal(0);
                sliceStore.select().subscribe(counter => {
                    expect(counter).to.equal(0);
                    done();
                });
            })
        });

    })

});
