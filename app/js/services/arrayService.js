angular.module('app').service('arrayService', [ function () {
  let svc = this
  this.signedModulate = (modulus, value) => value % modulus === 0 ? 0 : value < 0 ? modulus - (-value % modulus) : value % modulus
  this.signedIndicate = (array, index) => array[svc.signedModulate(array.length, index)]
  this.containsArray = (superArray, targetArray) => superArray.some((subArray) => svc.match(subArray, targetArray))
  this.match = (array1, array2) => array1.length === array2.length && array1.every((value, index) => value === array2[index])
  this.concatenate = (array) => array.reduce((sum, value) => sum.concat(value), [])
}])
