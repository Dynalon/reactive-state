import "mocha";
import { expect } from "chai";

import { Store } from "../dist/index";

import { RootState, SliceState } from "./test_common_types";

describe("initial state chaining", () => {


    let store: Store<RootState>;
    beforeEach(() => {
        store = Store.create<RootState>();
    })

    it("should accept an initial state of undefined and create and empty object as root state", done => {
        const store = Store.create<object>();

        store.select().take(1).subscribe(state => {
            expect(state).to.be.an("Object");
            expect(Object.getOwnPropertyNames(state)).to.have.lengthOf(0);
            done();
        })
    })

    it("should accept an initial state object when creating a slice", () => {

        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" });

        sliceStore.select(s => s).take(1).subscribe(slice => {
            expect(slice).to.be.an("Object");
            expect(Object.getOwnPropertyNames(slice)).to.deep.equal(["foo"]);
            expect(slice.foo).to.equal("bar");
        })
    })

    it("should set the initial state for a slice of a slice on the sliced state", done => {
        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" });

        store.select(s => s).skip(1).subscribe(s => {
            if (!s.slice || !s.slice.slice) {
                done("Error");
                return;
            }
            expect(s.slice.slice.foo).to.equal("baz");
            expect(Object.getOwnPropertyNames(s.slice)).to.deep.equal([ "foo", "slice"]);
            expect(Object.getOwnPropertyNames(s.slice.slice)).to.deep.equal([ "foo" ]);
            done();
        })

        sliceStore.createSlice("slice", { foo: "baz" });

    })


    it("should trigger a state change on the root store when the initial state on the slice is created", done => {
        store.select(s => s).skip(1).take(1).subscribe(state => {
            expect(state.slice).not.to.be.undefined;
            expect(state.slice).to.have.property("foo");
            if (state.slice) {
                expect(state.slice.foo).to.equal("bar");
                done();
            }
        })

        store.createSlice("slice", { foo: "bar" });
    });

    it("should set the state to the cleanup value when the slice store is unsubscribed for case 'undefined'", done => {
        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" }, "undefined");
        sliceStore.destroy();

        store.select(s => s).subscribe(state => {
            expect(Object.getOwnPropertyNames(state)).to.deep.equal([]);
            done();
        })
    })

    it("should set the state to the cleanup value when the slice store is unsubscribed for case null", done => {
        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" }, null);
        sliceStore.destroy();

        store.select(s => s).subscribe(state => {
            expect(state.slice).to.be.null;
            done();
        })
    })

    it("should set the state to the cleanup value when the slice store is unsubscribed for case any object", done => {
        const sliceStore = store.createSlice<SliceState>("slice", { foo: "bar" }, { foo: "baz" });
        sliceStore.destroy();

        store.select(s => s).subscribe(state => {
            expect(state.slice).to.be.deep.equal({ foo: "baz" });
            done();
        })
    })
});