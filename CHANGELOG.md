v2.0.0 (unreleased)

* fully RxJS 6 based (without need for rxjs-compat)
* complete change of react connect() API: usage of Components as wrapper now discouraged, everything can be wired inside a
  single function now
* very strict typing of MapStateToProps and ActionMap types using TypeScript 2.8 conditional types
* react bridge is now a first-class citizen: Enzyme based tests with full DOM rendering implemented; react bridge 
  tests contribute to overall code coverage

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
