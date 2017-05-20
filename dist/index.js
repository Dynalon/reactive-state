"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Subject_1 = require("rxjs/Subject");
require("rxjs/add/operator/scan");
require("rxjs/add/operator/map");
require("rxjs/add/operator/publishReplay");
/**
 * Actions basically just extend Subject that emit a Payload P and can have a string name to identify
 * the action. This can be used in future versions to produce action logs, replay them from a log/storage, etc.
 */
var Action = (function (_super) {
    __extends(Action, _super);
    function Action(name) {
        if (name === void 0) { name = undefined; }
        var _this = _super.call(this) || this;
        _this.name = name;
        return _this;
    }
    return Action;
}(Subject_1.Subject));
exports.Action = Action;
/**
 * Creates a state based on a stream of StateMutation functions and an initial state. The returned observable
 * is hot and caches the last emitted value (will emit the last emitted value immediately upon subscription).
 * @param stateMutators
 * @param initialState
 */
function createState(stateMutators, initialState) {
    return stateMutators
        .scan(function (state, reducer) { return reducer(state); }, initialState)
        .publishReplay(1)
        .refCount();
}
var Store = (function () {
    function Store(state, stateMutators, keyChain) {
        if (keyChain === void 0) { keyChain = []; }
        this.state = state;
        this.stateMutators = stateMutators;
        this.keyChain = keyChain;
    }
    /**
     * Create a new Store based on an initial state
     */
    Store.create = function (initialState) {
        var stateMutators = new Subject_1.Subject();
        var state = createState(stateMutators, initialState);
        var store = new Store(state, stateMutators, []);
        return store;
    };
    /**
     * Creates a new linked store, that Selects a slice on the main store.
     */
    Store.prototype.createSlice = function (key) {
        // S[keyof S] is assumed to be of type K; this is a runtime assumption
        var state = this.state.map(function (s) { return s[key]; });
        var keyChain = this.keyChain.concat([key]);
        return new Store(state, this.stateMutators, keyChain);
    };
    Store.prototype.addReducer = function (action, reducer) {
        var _this = this;
        var rootReducer = function (payload) { return function (state) {
            if (_this.keyChain.length === 0) {
                // assume R = S; reducer transforms the root state; this is a runtime assumption
                var typedReducer = reducer;
                state = typedReducer(state, payload);
            }
            else {
                var slice = state;
                for (var i = 0; i < _this.keyChain.length - 1; i++) {
                    slice = slice[_this.keyChain[i]];
                }
                var lastKey = _this.keyChain.slice(-1)[0];
                slice[lastKey] = reducer(slice[lastKey], payload);
            }
            return state;
        }; };
        return action.map(rootReducer).subscribe(function (rootStateMutation) { return _this.stateMutators.next(rootStateMutation); });
    };
    /**
     * Selects a part of the state using a selector function. If no selector function is given, the identity function
     * is used (which returns the state of type S).
     * Note: The returned observable emits every time the state changes, even if the state does not affect
     *       the part selected by the selection function.
     *
     * @param fn
     * @returns An observable that emits any time the state changes
     */
    Store.prototype.select = function (selectorFn) {
        if (!selectorFn)
            selectorFn = function (state) { return state; };
        return this.state.map(selectorFn);
    };
    return Store;
}());
exports.Store = Store;
//# sourceMappingURL=index.js.map