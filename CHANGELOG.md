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