v3.5
 * Fix a typing bug that made it impossible to use hooks-based (functional) Components with react bridge
 * Bump dependencies to latest version
 * Due to a change in @types/react we can no longer use ActionMap<TComponent> - use ActionMap<typeof TComponent> instead

v3.4

* Make current state of a store available in `store.currentState` just as in a BehaviorSubject. This helps in synchronous code (i.e. react state init).

v3.3

* add useStore() hook to consume a store provided via <StoreProvider> through new Hooks API

v3.2

* react bridge: Removed `mapStatetoProps` function and use much simpler `props` which is just an Observable emitting
  the props of the connected component
* react bridge: Pass down an Observable of the input props given to a connected component
* react bridge: Remove `cleanup` return property in connect: subscribe to the store.destroy observable instead which
  gets called upon unmount
* react bridge: The `store` argument passed as the `ConnectCallback` in the `connect()` function now calls .clone()
  on the store internally and automatically calls .destroy() on the clone when the component is unmount. That way we
  don't need custom cleanup logic inside `connect()`.

v3.0

* Removed `Action` type (use Subject and specify a name as 3rd argument to .addReducer() instead)
* New way of creating slices: Projections. Use .createProjection() to map any properties from a state to another (sliced) state.
* Add .clone() method to Store which is like a slice without any transformation but uses the same state object.
  Useful to scope .select()/.watch() subscriptions, as .destroy() will end all subscriptions of the clone but
  will not affect the original.
* We do not create immutable copies for initial states anymore but re-use the object passed in
  as initial state. Create immutable copies yourself if needed before creating a store.
* Remove fully bundled UMD module from published package, you should use your own bundler like webpack.
* Requires React >=16.4 for react bridge
* Switch to reacts new context API for react bridge StoreProvider
* Drop deprecated lifecycle hooks to be ready for React v17
* Drop `undefined` as a valid return type for the `ConnectCallback` (you can use empty object `{}` though)

v2.0.0

* fully RxJS 6 based (without need for rxjs-compat)
* store.select() now emits on every state change, no matter if the result in the selection function is affected by
  the changes (disregards shallow identity)
* introduce store.watch() that works as .select(), but performs a shallow equal check on each state change, not emitting
  a state if it is shallow-equal to the previous state
* react bridge: complete change of react connect() API: usage of Components as wrapper now discouraged, everything can
  be wired inside a single function now passed to connect()
* react bridge: very strict typing of MapStateToProps and ActionMap types using TypeScript 2.8 conditional types
* react bridge: is now a first-class citizen: Enzyme based tests with full DOM rendering implemented; react bridge tests
  contribute to overall code coverage
* react bridge: Use <StoreProvider store={store}> to provide a store instance via React's context API
* react bridge: Introduce <StoreSlice slice={state => "keyOfState"}> to create store slices in a declarative way

v1.0.0

* Fix type-inference for .createSlice() - this breaks existing code (just remove the type argument from
  .createSlice() to fix). Contributed by Sebastian Nemeth.

v0.5.0
* React bridge now considered mature and can be imported from 'reactive-state/react'
* Do not overwrite any initialstate on a slice if that prop is not undefined
* Breaking change: Do not clone initialState/cleanupState for stores/slices. This means that whatever you pass
  as initial state object can be modified by the store, and modifications will be visisble to whoever uses that
  instance. The non-clone behaviour is no coherent with Redux behaviour and allows us to drop a cloneDeep()
  implementation which save a lot of kilobytes in the output bundle.
* Better devtool integration with notifyStateChange observable on the store


v0.4.0
* Use lettable operators from RxJS 5.5
* Change API for devtool

v0.2.2

* Fixed tslib only being a dev dependency, although it is needed as runtime dep
  when included from another project

v0.2.1

* Fixed .select() not correctly infering the type when given no arguments
* Fixed behaviour of special cleanup state string "undefined" which would delete they key -
  This will now set the key on the state to real undefined (non-string) upon cleanup
* Added a "delete" special cleanup state string that will behave as "undefined" as before
   (remove the key from the parent state alltogether)
* Started a changelog.
