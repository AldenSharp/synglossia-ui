angular.module('app').service('validityService', [ function () {
  let svc = this

  this.verifyValueInPhonotactics = function (language, value, index, valueLocation) {
    if (language.phonotactics[index + language.vowelCore].every((option) => option.value !== value)) {
      console.error(valueLocation + ': Value is not in the phonotactics at position index ' + index)
    }
  }

  this.verifyValueSomewhereInPhonotactics = function (language, value, valueLocation) {
    if (language.phonotactics.every((position) => position.every((option) => option.value !== value))) {
      console.error(valueLocation + ': Value is not in the phonotactics at any position.')
    }
  }

  this.verifyIndexInPhonotactics = function (language, index, indexLocation) {
    if (index < -language.vowelCore || index >= language.phonotactics.length - language.vowelCore) {
      console.error(indexLocation + ': Value is out of bounds of the language phonotactics. Found: ' + index)
    }
  }

  this.verifyNotNull = function(value, valueLocation) {
    if (value === undefined) {
      console.error(valueLocation + ': Value is undefined.')
    }
  }

  this.verifyPropertiesExist = function (value, valueLocation, properties) {
    for (let property of properties) {
      if (value[property] === undefined) {
        console.error(valueLocation + ': Value is missing \'' + property + '\' property.')
      }
    }
  }

  this.verifyNonemptyArray = function (value, valueLocation) {
    if (value.length === 0) {
      console.error(valueLocation + ': Array is empty.')
    }
  }

  this.verifyPositive = function (value, valueLocation) {
    if (value <= 0) {
      console.error(valueLocation + ': Value must be positive. Instead found: ' + value)
    }
  }

}])
