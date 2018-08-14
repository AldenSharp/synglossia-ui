angular.module('app').service('validityService', [ function () {
  let svc = this

  this.verifyValueInPhonotactics = function (language, value, index, valueLocation) {
    let syllableCenter = language.phonology.syllableCores[0]
    if (language.phonology.phonotactics[index + syllableCenter].every((option) => option.value !== value)) {
      console.error(valueLocation + ': Value ' + value + ' is not in the phonotactics at position index ' + index)
    }
  }

  this.verifyValueSomewhereInPhonotactics = function (language, value, valueLocation) {
    if (language.phonology.phonotactics.every((position) => position.every((option) => option.value !== value))) {
      console.error(valueLocation + ': Value ' + value + ' is not in the phonotactics at any position.')
    }
  }

  this.verifyIndexInPhonotactics = function (language, index, indexLocation) {
    let syllableCenter = language.phonology.syllableCores[0]
    if (index < -syllableCenter || index >= language.phonology.phonotactics.length - syllableCenter) {
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
