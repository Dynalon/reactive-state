v1.0.0 (to be released)
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
