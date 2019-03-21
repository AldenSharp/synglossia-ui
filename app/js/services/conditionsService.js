/* global angular */
angular.module('app').service('conditionsService', ['phonologyService', 'arrayService', 'validityService',
  function (phonology, array, validity) {
    let svc = this

    this.meetsCondition = function (language, word, syllableIndex, phonemeIndex, condition) {
      if (syllableIndex < 0 || syllableIndex >= word.syllables.length) {
        return false
      }
      if (phonemeIndex < 0 || phonemeIndex >= word.syllables[syllableIndex].phonemes.length) {
        return false
      }

      if (condition.type === 'DEFAULT') {
        return true
      }
      if (condition.type === 'AND') {
        return meetsAndCondition(language, word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'OR') {
        return meetsOrCondition(language, word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'NOT') {
        return meetsNotCondition(language, word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'BEFORE') {
        return meetsBeforeCondition(language, word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'AFTER') {
        return meetsAfterCondition(language, word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'CONSONANTAL') {
        return meetsConsonantalCondition(language, phonemeIndex, condition)
      }
      if (condition.type === 'SYLLABIC') {
        return meetsSyllabicCondition(language, phonemeIndex, condition)
      }
      if (condition.type === 'WORD_INITIAL') {
        return meetsWordInitialCondition(word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'WORD_FINAL') {
        return meetsWordFinalCondition(word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'SYLLABLE_INITIAL') {
        return meetsSyllableInitialCondition(word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'SYLLABLE_FINAL') {
        return meetsSyllableFinalCondition(word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'SOUND_VALUES') {
        return meetsSoundValuesCondition(word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'EMPTY') {
        return meetsEmptyCondition(word, syllableIndex, phonemeIndex, condition)
      }
      if (condition.type === 'SYLLABLE_COUNT') {
        return meetsSyllableCountCondition(word, condition)
      }
    }

    this.checkCondition = function (language, condition, conditionLocation) {
      validity.verifyNotNull(condition, conditionLocation)
      validity.verifyPropertiesExist(condition, conditionLocation, ['type'])
      if (condition.type === 'AND') {
        checkAndCondition(language, condition, conditionLocation)
      } else if (condition.type === 'OR') {
        checkOrCondition(language, condition, conditionLocation)
      } else if (condition.type === 'NOT') {
        checkNotCondition(language, condition, conditionLocation)
      } else if (condition.type === 'BEFORE') {
        checkBeforeCondition(language, condition, conditionLocation)
      } else if (condition.type === 'AFTER') {
        checkAfterCondition(language, condition, conditionLocation)
      } else if (condition.type === 'SOUND_VALUES') {
        checkSoundValuesCondition(language, condition, conditionLocation)
      } else if (condition.type === 'SYLLABLE_COUNT') {
        checkSyllableCountCondition(condition, conditionLocation)
      }
    }

    function meetsAndCondition (language, word, syllableIndex, phonemeIndex, condition) {
      return condition.conditions.every(
        (conjunctCondition) => svc.meetsCondition(
          language, word, syllableIndex, phonemeIndex, conjunctCondition
        )
      )
    }

    function checkAndCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['conditions'])

      // conditions
      if (condition.conditions.length < 2) {
        console.error(conditionLocation + ': Sound condition of type \'AND\' has a \'conditions\' array of insufficient size. The array must have length 2 or greater.')
      }
      for (let conditionIndex in condition.conditions) {
        let conjunctCondition = condition.conditions[conditionIndex]
        svc.checkCondition(language, conjunctCondition, conditionLocation + ': Conjunct condition #' + conditionIndex)
      }
    }

    function meetsOrCondition (language, word, syllableIndex, phonemeIndex, condition) {
      return condition.conditions.some(
        (disjunctCondition) => svc.meetsCondition(
          language, word, syllableIndex, phonemeIndex, disjunctCondition
        )
      )
    }

    function checkOrCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['conditions'])

      // conditions
      if (condition.conditions.length < 2) {
        console.error(conditionLocation + ': Sound condition of type \'OR\' has a \'conditions\' array of insufficient size. The array must have length 2 or greater.')
      }
      for (let conditionIndex in condition.conditions) {
        let disjunctCondition = condition.conditions[conditionIndex]
        svc.checkCondition(language, disjunctCondition, conditionLocation + ': Disjunct condition #' + conditionIndex)
      }
    }

    function meetsNotCondition (language, word, syllableIndex, phonemeIndex, condition) {
      return !svc.meetsCondition(language, word, syllableIndex, phonemeIndex, condition.condition)
    }

    function checkNotCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['condition'])

      // condition
      svc.checkCondition(language, condition.condition, conditionLocation + 'Negated condition')
    }

    function meetsBeforeCondition (language, word, syllableIndex, phonemeIndex, condition) {
      let actualAdjacentPhoneme = phonology.nextPhoneme(word, syllableIndex, phonemeIndex)
      if (!condition.adjacentSound.possiblySyllabic && language.phonology.syllableCores.indexOf(actualAdjacentPhoneme.index) > -1) {
        return false
      }
      return (
        condition.adjacentSound.values.some((value) => actualAdjacentPhoneme.value === value)
      )
    }

    function checkBeforeCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['adjacentSound'])

      // adjacentSound
      validity.verifyPropertiesExist(condition.adjacentSound, conditionLocation + ': Field \'adjacentSound\'', ['possiblySyllabic', 'values'])

      // adjacentSound.values
      for (let value of condition.adjacentSound.values) {
        validity.verifyValueSomewhereInPhonotactics(language, value, conditionLocation + ': Field \'adjacentSound\', field \'value\' of value ' + value)
      }
    }

    function meetsAfterCondition (language, word, syllableIndex, phonemeIndex, condition) {
      let actualAdjacentPhoneme = phonology.previousPhoneme(word, syllableIndex, phonemeIndex)
      if (!condition.adjacentSound.possiblySyllabic && language.phonology.syllableCores.indexOf(actualAdjacentPhoneme.index) > -1) {
        return false
      }
      return (
        condition.adjacentSound.values.some((value) => actualAdjacentPhoneme.value === value)
      )
    }

    function checkAfterCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['adjacentSound'])

      // adjacentSound
      validity.verifyPropertiesExist(condition.adjacentSound, conditionLocation + ': Field \'adjacentSound\'', ['possiblySyllabic', 'values'])

      // adjacentSound.values
      for (let value of condition.adjacentSound.values) {
        validity.verifyValueSomewhereInPhonotactics(language, value, conditionLocation + ': Field \'adjacentSound\', field \'value\' of value ' + value)
      }
    }

    function meetsConsonantalCondition (language, phonemeIndex, condition) {
      return language.phonology.syllableCores.indexOf(phonemeIndex) === -1
    }

    function meetsSyllabicCondition (language, phonemeIndex, condition) {
      return language.phonology.syllableCores.indexOf(phonemeIndex) > -1
    }

    function meetsWordInitialCondition (word, syllableIndex, phonemeIndex, condition) {
      return phonology.wordInitial(word, syllableIndex, phonemeIndex)
    }

    function meetsWordFinalCondition (word, syllableIndex, phonemeIndex, condition) {
      return phonology.wordFinal(word, syllableIndex, phonemeIndex)
    }

    function meetsSyllableInitialCondition (word, syllableIndex, phonemeIndex, condition) {
      return phonology.syllableInitial(word.syllables[syllableIndex], phonemeIndex)
    }

    function meetsSyllableFinalCondition (word, syllableIndex, phonemeIndex, condition) {
      return phonology.syllableFinal(word.syllables[syllableIndex], phonemeIndex)
    }

    function meetsSoundValuesCondition (word, syllableIndex, phonemeIndex, condition) {
      return condition.values.some(
        (value) => word.syllables[syllableIndex].phonemes[phonemeIndex] === value
      )
    }

    function checkSoundValuesCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['values'])

      // values
      validity.verifyNonemptyArray(condition.values, conditionLocation + ': Field \'values\'')
      for (let valueIndex in condition.values) {
        let value = condition.values[valueIndex]
        validity.verifyValueSomewhereInPhonotactics(language, value, conditionLocation + ': Field \'values\', index ' + valueIndex)
      }
    }

    function meetsEmptyCondition (word, syllableIndex, phonemeIndex, condition) {
      return word.syllables[syllableIndex].phonemes[phonemeIndex] === ''
    }

    function meetsSyllableCountCondition (word, condition) {
      if (condition.comparison === 'GREATER_THAN') {
        return word.syllables.length > condition.count
      }
      if (condition.comparison === 'LESS_THAN') {
        return word.syllables.length < condition.count
      }
      if (condition.comparison === 'EQUALS') {
        return word.syllables.length === condition.count
      }
    }

    function checkSyllableCountCondition (condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['comparison', 'count'])

      // count
      validity.verifyPositive(condition.count, conditionLocation + ': Field \'count\'')
    }

    this.meetsSyllableCondition = function (language, word, signedSyllableIndex, condition, previousStepRun) {
      let syllableIndex = array.signedModulate(word.syllables.length, signedSyllableIndex)

      if (condition.type === 'DEFAULT') {
        return true
      }
      if (condition.type === 'NOT') {
        return meetsNotSyllableCondition(language, word, syllableIndex, condition, previousStepRun)
      }
      if (condition.type === 'AND') {
        return meetsAndSyllableCondition(language, word, syllableIndex, condition, previousStepRun)
      }
      if (condition.type === 'OR') {
        return meetsOrSyllableCondition(language, word, syllableIndex, condition, previousStepRun)
      }
      if (condition.type === 'WORD_MEDIAL_CLUSTERS') {
        return meetsWordMedialClustersSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'WORD_INITIAL_CLUSTERS') {
        return meetsWordInitialClustersSyllableCondition(word, condition)
      }
      if (condition.type === 'WORD_FINAL_CLUSTERS') {
        return meetsWordFinalClustersSyllableCondition(language, word, condition)
      }
      if (condition.type === 'SYLLABLE_INITIAL_CLUSTERS') {
        return meetsSyllableInitialClustersSyllableCondition(word, signedSyllableIndex, condition)
      }
      if (condition.type === 'SYLLABLE_FINAL_CLUSTERS') {
        return meetsSyllableFinalClustersSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'BEFORE') {
        return meetsBeforeSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'AFTER') {
        return meetsAfterSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'SOUND_VALUES') {
        return meetsSoundValuesSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'EMPTY') {
        return meetsEmptySyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'EMPTY_AT_ALL') {
        return meetsEmptyAtAllSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'EMPTY_AT_SOME') {
        return meetsEmptyAtSomeSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'OPEN') {
        return meetsOpenSyllableCondition(language, word, syllableIndex, condition)
      }
      if (condition.type === 'BEFORE_HIATUS') {
        return meetsBeforeHiatusSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'SYLLABLE_POSITION') {
        return meetsSyllablePositionSyllableCondition(word, syllableIndex, condition)
      }
      if (condition.type === 'SHORT_VOWEL') {
        return meetsShortVowelSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'LONG_VOWEL') {
        return meetsLongVowelSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'MATCH') {
        return meetsMatchSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'SOUND_ARRAY_MATCH') {
        return meetsSoundArrayMatchSyllableCondition(language, word, signedSyllableIndex, condition)
      }
      if (condition.type === 'LENGTH') {
        return meetsLengthSyllableCondition(word, condition)
      }
      if (condition.type === 'STRESSED') {
        return meetsStressedSyllableCondition(word, syllableIndex, condition)
      }
      if (condition.type === 'BEFORE_STRESS') {
        return meetsBeforeStressSyllableCondition(word, syllableIndex, condition)
      }
      if (condition.type === 'AFTER_STRESS') {
        return meetsAfterStressSyllableCondition(word, syllableIndex, condition)
      }
      if (condition.type === 'STRESS_EXISTENCE') {
        return meetsStressExistenceSyllableCondition(language, word, condition)
      }
      if (condition.type === 'STRESS_UNIQUENESS') {
        return meetsStressUniquenessSyllableCondition(language, word, condition)
      }
      if (condition.type === 'STRESS_PARADIGM') {
        return meetsStressParadigmSyllableCondition(language, word, syllableIndex, condition)
      }
      if (condition.type === 'SYLLABLE_COUNT') {
        return meetsSyllableCountCondition(word, condition)
      }
      if (condition.type === 'FOLLOWS_FROM_LAST_STEP') {
        return previousStepRun
      }
    }

    this.checkSyllableCondition = function (language, condition, conditionLocation) {
      validity.verifyNotNull(condition, conditionLocation)
      validity.verifyPropertiesExist(condition, conditionLocation, ['type'])
      if (condition.type === 'NOT') {
        checkNotSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'AND') {
        checkAndSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'OR') {
        checkOrSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'WORD_MEDIAL_CLUSTERS') {
        checkWordMedialClustersSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'WORD_INITIAL_CLUSTERS') {
        checkWordInitialClustersSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'WORD_FINAL_CLUSTERS') {
        checkWordFinalClustersSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'SYLLABLE_INITIAL_CLUSTERS') {
        checkSyllableInitialClustersSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'SYLLABLE_FINAL_CLUSTERS') {
        checkSyllableFinalClustersSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'BEFORE' || condition.type === 'AFTER') {
        checkBeforeOrAfterSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'SOUND_VALUES') {
        checkSoundValuesSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'EMPTY') {
        checkEmptySyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'EMPTY_AT_ALL') {
        checkEmptyAtAllSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'EMPTY_AT_SOME') {
        checkEmptyAtSomeSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'OPEN') {
        checkOpenSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'BEFORE_HIATUS') {
        checkBeforeHiatusSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'SYLLABLE_POSITION') {
        checkSyllablePositionSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'SHORT_VOWEL') {
        checkShortVowelSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'LONG_VOWEL') {
        checkLongVowelSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'MATCH') {
        checkMatchSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'SOUND_ARRAY_MATCH') {
        checkSoundArrayMatchSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'LENGTH') {
        checkLengthSyllableCondition(condition, conditionLocation)
      } else if (condition.type === 'STRESSED') {
        checkStressedSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'BEFORE_STRESS') {
        checkBeforeStressSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'AFTER_STRESS') {
        checkAfterStressSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'STRESS_EXISTENCE') {
        checkStressExistenceSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'STRESS_UNIQUENESS') {
        checkStressUniquenessSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'STRESS_PARADIGM') {
        checkStressParadigmSyllableCondition(language, condition, conditionLocation)
      } else if (condition.type === 'SYLLABLE_COUNT') {
        checkSyllableCountCondition(condition, conditionLocation)
      }
    }

    function meetsNotSyllableCondition (language, word, syllableIndex, condition, previousStepRun) {
      return !svc.meetsSyllableCondition(language, word, syllableIndex, condition.condition, previousStepRun)
    }

    function checkNotSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['condition'])

      // condition
      svc.checkSyllableCondition(language, condition.condition, conditionLocation + ': Negated condition')
    }

    function meetsAndSyllableCondition (language, word, syllableIndex, condition, previousStepRun) {
      return condition.conditions.every(
        (conjunctCondition) => svc.meetsSyllableCondition(
          language, word, syllableIndex, conjunctCondition, previousStepRun
        )
      )
    }

    function checkAndSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['conditions'])

      // conditions
      if (condition.conditions.length < 2) {
        console.error(conditionLocation + ': Syllable condition of type \'AND\' has a \'conditions\' array of insufficient size. The array must have length 2 or greater.')
      }
      for (let conditionIndex in condition.conditions) {
        let conjunctCondition = condition.conditions[conditionIndex]
        svc.checkSyllableCondition(language, conjunctCondition, conditionLocation + ': Conjunct condition #' + conditionIndex)
      }
    }

    function meetsOrSyllableCondition (language, word, syllableIndex, condition, previousStepRun) {
      return condition.conditions.some(
        (disjunctCondition) => svc.meetsSyllableCondition(
          language, word, syllableIndex, disjunctCondition, previousStepRun
        )
      )
    }

    function checkOrSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['conditions'])

      // conditions
      if (condition.conditions.length < 2) {
        console.error(conditionLocation + ': Syllable condition of type \'OR\' has a \'conditions\' array of insufficient size. The array must have length 2 or greater.')
      }
      for (let conditionIndex in condition.conditions) {
        let disjunctCondition = condition.conditions[conditionIndex]
        svc.checkSyllableCondition(language, disjunctCondition, conditionLocation + ': Conjunct condition #' + conditionIndex)
      }
    }

    function meetsWordMedialClustersSyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.syllablePosition) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      if (absoluteSyllablePosition === word.syllables.length - 1) {
        return true
      }
      for (let medialString of condition.values) {
        let thisSyllablePosition = absoluteSyllablePosition
        let thisSoundPosition = language.phonology.syllableCores[0] + 1
        let match = true
        for (let phoneme of medialString) {
          if (word.syllables[thisSyllablePosition].phonemes[thisSoundPosition] !== phoneme) {
            match = false
          }
          if (thisSoundPosition === word.syllables[thisSyllablePosition].phonemes.length - 1) {
            thisSyllablePosition++
            thisSoundPosition = 0
          } else { thisSoundPosition++ }
        }
        if (match) { return true }
      }
      return false
    }

    function checkWordMedialClustersSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['syllablePosition', 'values', 'syllablePositionAbsolute'])

      // values
      validity.verifyNonemptyArray(condition.values, conditionLocation + ': Field \'values\'')
      for (let valueIndex in condition.values) {
        let value = condition.values[valueIndex]
        let expectedLength = language.phonology.phonotactics.length - 1
        if (value.length !== expectedLength) {
          console.error(conditionLocation + ': Syllable condition of type \'WORD_MEDIAL_CLUSTERS\' has some \'value\' array of improper length in position ' + valueIndex +
          ': it should have ' + expectedLength + ' positions, but actually has ' + value.length + '.')
        }
        // for (let phonemeIndex in value) {
        //   let phoneme = value[phonemeIndex]
        //   validity.verifyValueSomewhereInPhonotactics(language, phoneme, conditionLocation + ': Field \'values\', index ' + valueIndex + ', index ' + phonemeIndex)
        // }
      }
    }

    function meetsWordInitialClustersSyllableCondition (word, condition) {
      return condition.values.some(
        (initialValue) => initialValue.every(
          (initial, initialIndex) => word.syllables[0].phonemes[initialIndex] === initial
        )
      )
    }

    function checkWordInitialClustersSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['values'])

      // values
      validity.verifyNonemptyArray(condition.values, conditionLocation + ': Field \'values\'')
      for (let valueIndex in condition.values) {
        let value = condition.values[valueIndex]
        let expectedLength = language.phonology.syllableCores[0]
        if (value.length !== expectedLength) {
          console.error(conditionLocation + ': Syllable condition of type \'WORD_INITIAL_CLUSTERS\' has some \'value\' array of improper length in position ' + valueIndex +
          ': it should have ' + expectedLength + ' positions, but actually has ' + value.length + '.')
        }
        // for (let phonemeIndex in value) {
        //   let phoneme = value[phonemeIndex]
        //   validity.verifyValueSomewhereInPhonotactics(language, phoneme, conditionLocation + ': Field \'values\', index ' + valueIndex + ', index ' + phonemeIndex)
        // }
      }
    }

    function meetsWordFinalClustersSyllableCondition (language, word, condition) {
      return condition.values.some(
        (finalValue) => finalValue.every(
          (final, finalIndex) =>
            word.syllables[word.syllables.length - 1].phonemes[language.phonology.syllableCores[0] + 1 + finalIndex] === final
        )
      )
    }

    function checkWordFinalClustersSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['values'])

      // values
      validity.verifyNonemptyArray(condition.values, conditionLocation + ': Field \'values\'')
      for (let valueIndex in condition.values) {
        let value = condition.values[valueIndex]
        let expectedLength = language.phonology.phonotactics.length - language.phonology.syllableCores[0] - 1
        if (value.length !== expectedLength) {
          console.error(conditionLocation + ': Syllable condition of type \'WORD_FINAL_CLUSTERS\' has some \'value\' array of improper length in position ' + valueIndex +
          ': it should have ' + expectedLength + ' positions, but actually has ' + value.length + '.')
        }
        // for (let phonemeIndex in value) {
        //   let phoneme = value[phonemeIndex]
        //   validity.verifyValueSomewhereInPhonotactics(language, phoneme, conditionLocation + ': Field \'values\', index ' + valueIndex + ', index ' + phonemeIndex)
        // }
      }
    }

    function meetsSyllableInitialClustersSyllableCondition (word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.syllablePosition) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      if (absoluteSyllablePosition < 0 || absoluteSyllablePosition >= word.syllables.length) {
        return true
      }
      return condition.values.some(
        (initialValue) => initialValue.every(
          (initial, initialIndex) => word.syllables[absoluteSyllablePosition].phonemes[initialIndex] === initial
        )
      )
    }

    function checkSyllableInitialClustersSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['syllablePosition', 'values', 'syllablePositionAbsolute'])

      // values
      validity.verifyNonemptyArray(condition.values, conditionLocation + ': Field \'values\'')
      for (let valueIndex in condition.values) {
        let value = condition.values[valueIndex]
        let expectedLength = language.phonology.syllableCores[0]
        if (value.length !== expectedLength) {
          console.error(conditionLocation + ': Syllable condition of type \'SYLLABLE_INITIAL_CLUSTERS\' has some \'value\' array of improper length in position ' + valueIndex +
          ': it should have ' + expectedLength + ' positions, but actually has ' + value.length + '.')
        }
        // for (let phonemeIndex in value) {
        //   let phoneme = value[phonemeIndex]
        //   validity.verifyValueSomewhereInPhonotactics(language, phoneme, conditionLocation + ': Field \'values\', index ' + valueIndex + ', index ' + phonemeIndex)
        // }
      }
    }

    function meetsSyllableFinalClustersSyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.syllablePosition) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      if (absoluteSyllablePosition < 0 || absoluteSyllablePosition >= word.syllables.length) {
        return true
      }
      return condition.values.some(
        (finalValue) => finalValue.every(
          (final, finalIndex) =>
            word.syllables[absoluteSyllablePosition].phonemes[language.phonology.syllableCores[0] + 1 + finalIndex] === final
        )
      )
    }

    function checkSyllableFinalClustersSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['syllablePosition', 'values', 'syllablePositionAbsolute'])

      // values
      validity.verifyNonemptyArray(condition.values, conditionLocation + ': Field \'values\'')
      for (let valueIndex in condition.values) {
        let value = condition.values[valueIndex]
        let expectedLength = language.phonology.phonotactics.length - language.phonology.syllableCores[0] - 1
        if (value.length !== expectedLength) {
          console.error(conditionLocation + ': Syllable condition of type \'SYLLABLE_FINAL_CLUSTERS\' has some \'value\' array of improper length in position ' + valueIndex +
          ': it should have ' + expectedLength + ' positions, but actually has ' + value.length + '.')
        }
        // for (let phonemeIndex in value) {
        //   let phoneme = value[phonemeIndex]
        //   validity.verifyValueSomewhereInPhonotactics(language, phoneme, conditionLocation + ': Field \'values\', index ' + valueIndex + ', index ' + phonemeIndex)
        // }
      }
    }

    function meetsBeforeSyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.position.syllable) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      let actualAdjacentPhoneme = phonology.nextPhoneme(word, absoluteSyllablePosition, condition.position.sound + language.phonology.syllableCores[0])
      if (!condition.adjacentSound.possiblySyllabic && actualAdjacentPhoneme.index === language.phonology.syllableCores[0]) {
        return false
      }
      return (
        condition.adjacentSound.values.some((value) => actualAdjacentPhoneme.value === value)
      )
    }

    function meetsAfterSyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.position.syllable) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      let actualAdjacentPhoneme = phonology.previousPhoneme(word, absoluteSyllablePosition, condition.position.sound + language.phonology.syllableCores[0])
      if (!condition.adjacentSound.possiblySyllabic && actualAdjacentPhoneme.index === language.phonology.syllableCores[0]) {
        return false
      }
      return (
        condition.adjacentSound.values.some((value) => actualAdjacentPhoneme.value === value)
      )
    }

    function checkBeforeOrAfterSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['position', 'adjacentSound', 'syllablePositionAbsolute'])

      // position
      verifyPropertiesExistInPosition(language, condition, conditionLocation)

      // adjacentSound
      validity.verifyPropertiesExist(condition.adjacentSound, conditionLocation + ': Field \'adjacentSound\'', ['possiblySyllabic', 'values'])

      // adjacentSound.values
      for (let value of condition.adjacentSound.values) {
        validity.verifyIndexInPhonotactics(language, value, conditionLocation + ': Field \'adjacentSound\', field \'value\' of value ' + value)
      }
    }

    function meetsSoundValuesSyllableCondition (language, word, signedSyllableIndex, condition) {
      let syllablePosition = condition.syllablePositionAbsolute
        ? array.signedModulate(word.syllables.length, condition.position.syllable)
        : condition.position.syllable
      let absoluteSyllablePosition = parseInt(syllablePosition) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      let output = null
      if (absoluteSyllablePosition < 0 || absoluteSyllablePosition >= word.syllables.length) {
        return output
      }
      return condition.values.some((value) =>
        word.syllables[absoluteSyllablePosition]
          .phonemes[language.phonology.syllableCores[0] + condition.position.sound] === value
      )
    }

    function checkSoundValuesSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['position', 'values', 'syllablePositionAbsolute'])

      // position
      verifyPropertiesExistInPosition(language, condition, conditionLocation)

      // values
      validity.verifyNonemptyArray(condition.values, conditionLocation + ': Field \'values\'')
      // for (let valueIndex in condition.values) {
      //   let value = condition.values[valueIndex]
      //   validity.verifyValueSomewhereInPhonotactics(language, value, conditionLocation + ': Field \'values\', index ' + valueIndex)
      // }
    }

    function meetsEmptySyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.position.syllable) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      if (absoluteSyllablePosition < 0 || absoluteSyllablePosition >= word.syllables.length) {
        return false
      }
      return word.syllables[absoluteSyllablePosition]
        .phonemes[language.phonology.syllableCores[0] + condition.position.sound] === ''
    }

    function checkEmptySyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['position', 'syllablePositionAbsolute'])

      // position
      verifyPropertiesExistInPosition(language, condition, conditionLocation)
    }

    function meetsEmptyAtAllSyllableCondition (language, word, signedSyllableIndex, condition) {
      for (let position of condition.positions) {
        let absoluteSyllablePosition = parseInt(position.syllable) +
          (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
        if (
          absoluteSyllablePosition < 0 ||
          absoluteSyllablePosition >= word.syllables.length ||
          word.syllables[absoluteSyllablePosition]
            .phonemes[language.phonology.syllableCores[0] + position.sound] !== ''
        ) { return false }
      }
      return true
    }

    function checkEmptyAtAllSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['positions', 'syllablePositionAbsolute'])

      // positions
      verifyPropertiesExistInAllPositions(language, condition, conditionLocation)
      if (condition.positions.length === 1) {
        console.error(conditionLocation + ': Syllable condition of type \'EMPTY_AT_ALL\' has a singleton \'positions\' array. Use condition type \'EMPTY\' instead.')
      }
    }

    function meetsEmptyAtSomeSyllableCondition (language, word, signedSyllableIndex, condition) {
      for (let position of condition.positions) {
        let absoluteSyllablePosition = parseInt(position.syllable) +
          (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
        if (
          absoluteSyllablePosition >= 0 &&
          absoluteSyllablePosition < word.syllables.length &&
          word.syllables[absoluteSyllablePosition]
            .phonemes[language.phonology.syllableCores[0] + position.sound] === ''
        ) {
          return true
        }
      }
      return false
    }

    function checkEmptyAtSomeSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['positions', 'syllablePositionAbsolute'])

      // positions
      verifyPropertiesExistInAllPositions(language, condition, conditionLocation)
      if (condition.positions.length === 1) {
        console.error(conditionLocation + ': Syllable condition of type \'EMPTY_AT_SOME\' has a singleton \'positions\' array. Use condition type \'EMPTY\' instead.')
      }
    }

    function meetsOpenSyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.syllablePosition) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      if (absoluteSyllablePosition < 0 || absoluteSyllablePosition >= word.syllables.length) {
        return false
      }
      return word.syllables[absoluteSyllablePosition].phonemes.every(
        (phoneme, phonemeIndex) => phonemeIndex <= language.phonology.syllableCores[0] || phoneme === ''
      )
    }

    function checkOpenSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['syllablePosition', 'syllablePositionAbsolute'])
    }

    function meetsBeforeHiatusSyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.syllablePosition) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      if (absoluteSyllablePosition < 0 || absoluteSyllablePosition >= word.syllables.length - 1) {
        return false
      }
      return (
        (word.syllables[absoluteSyllablePosition].phonemes.every(
          (phoneme, phonemeIndex) => phonemeIndex <= language.phonology.syllableCores[0] || phoneme === '')) &&
        (word.syllables[absoluteSyllablePosition + 1].phonemes.every(
          (phoneme, phonemeIndex) => phonemeIndex >= language.phonology.syllableCores[0] || phoneme === ''))
      )
    }

    function checkBeforeHiatusSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['syllablePosition', 'syllablePositionAbsolute'])
    }

    function meetsSyllablePositionSyllableCondition (word, syllableIndex, condition) {
      return syllableIndex === array.signedModulate(word.syllables.length, condition.position)
    }

    function checkSyllablePositionSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['position'])
    }

    function meetsShortVowelSyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.syllablePosition) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      return phonology.isShortVowel(
        word.syllables[absoluteSyllablePosition].phonemes[language.phonology.syllableCores[0]]
      )
    }

    function checkShortVowelSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['syllablePosition', 'syllablePositionAbsolute'])
    }

    function meetsLongVowelSyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.syllablePosition) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      return !phonology.isShortVowel(
        word.syllables[absoluteSyllablePosition].phonemes[language.phonology.syllableCores[0]]
      )
    }

    function checkLongVowelSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['syllablePosition', 'syllablePositionAbsolute'])
    }

    function meetsMatchSyllableCondition (language, word, signedSyllableIndex, condition) {
      let firstAbsoluteSyllablePosition = parseInt(condition.positions[0].syllable) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      if (firstAbsoluteSyllablePosition < 0 || firstAbsoluteSyllablePosition >= word.syllables.length) {
        return false
      }
      let firstAbsoluteSoundPosition = parseInt(condition.positions[0].sound) +
        language.phonology.syllableCores[0]
      let sharedPhoneme = word
        .syllables[firstAbsoluteSyllablePosition]
        .phonemes[firstAbsoluteSoundPosition]
      for (let position of condition.positions.slice(1)) {
        let absoluteSyllablePosition = parseInt(position.syllable) +
          (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
        if (absoluteSyllablePosition < 0 || absoluteSyllablePosition >= word.syllables.length) {
          return false
        }
        let absoluteSoundPosition = parseInt(position.sound) + language.phonology.syllableCores[0]
        if (
          firstAbsoluteSyllablePosition < 0 ||
          firstAbsoluteSyllablePosition >= word.syllables.length ||
          word.syllables[absoluteSyllablePosition].phonemes[absoluteSoundPosition] !== sharedPhoneme
        ) { return false }
      }
      return true
    }

    function checkMatchSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['positions', 'syllablePositionAbsolute'])

      // positions
      verifyPropertiesExistInAllPositions(language, condition, conditionLocation)
      if (condition.positions.length === 1) {
        console.error(conditionLocation + ': Syllable condition of type \'MATCH\' has a singleton \'positions\' array. This is useless.')
      }
    }

    function meetsSoundArrayMatchSyllableCondition (language, word, signedSyllableIndex, condition) {
      let absoluteSyllablePosition = parseInt(condition.initialPosition.syllable) +
        (condition.syllablePositionAbsolute ? 0 : parseInt(signedSyllableIndex))
      let absoluteSoundPosition = language.phonology.syllableCores[0] + parseInt(condition.initialPosition.sound)
      if (absoluteSyllablePosition < 0 || absoluteSyllablePosition >= word.syllables.length) {
        return false
      }
      for (let phoneme of condition.array) {
        if (word.syllables[absoluteSyllablePosition].phonemes[absoluteSoundPosition] !== phoneme) {
          return false
        }
        if (absoluteSoundPosition + 1 === word.syllables[absoluteSyllablePosition].phonemes.length) {
          absoluteSoundPosition = 0
          absoluteSyllablePosition++
        } else {
          absoluteSoundPosition++
        }
      }
      return true
    }

    function checkSoundArrayMatchSyllableCondition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['initialPosition', 'array', 'syllablePositionAbsolute'])

      // initialPosition
      validity.verifyPropertiesExist(condition.initialPosition, conditionLocation + ': Field \'initialPosition\'', ['syllable', 'sound'])

      // array
      validity.verifyNonemptyArray(condition.array, conditionLocation + ': Field \'array\'')
      // for (let phonemeIndex in condition.array) {
      //   let phoneme = condition.array[phonemeIndex]
      //   validity.verifyValueSomewhereInPhonotactics(language, phoneme, conditionLocation + ': Field \'array\', index ' + phonemeIndex)
      // }
    }

    function meetsLengthSyllableCondition (word, condition) {
      if (condition.comparison === 'GREATER_THAN') {
        return word.syllables.length > condition.length
      } else if (condition.comparison === 'LESS_THAN') {
        return word.syllables.length < condition.length
      } else {
        return word.syllables.length === condition.length
      }
    }

    function checkLengthSyllableCondition (condition, conditionLocation) {
      validity.verifyPropertiesExist(condition, conditionLocation, ['length', 'comparison'])
    }

    function meetsStressedSyllableCondition (word, syllableIndex, condition) {
      let actualSyllableIndex = condition.syllablePosition + (condition.syllablePositionAbsolute ? 0 : syllableIndex)
      if (actualSyllableIndex < 0 || actualSyllableIndex >= word.syllables.length) {
        return false
      }
      return word.syllables[actualSyllableIndex].accent === condition.order
    }

    function checkStressedSyllableCondition (language, condition, conditionLocation) {
      if (language.phonology.prosody.type !== 'STRESS') {
        console.error(conditionLocation + ': Syllable condition of type \'STRESSED\' is incompatible with language of accent type \'' + language.phonology.prosody.type + '\'; type must be \'STRESS\'.')
      }
      validity.verifyPropertiesExist(condition, conditionLocation, ['syllablePosition', 'order', 'syllablePositionAbsolute'])

      // order
      if (condition.order < 1 || condition.order > language.phonology.prosody.maxOrder) {
        console.error(conditionLocation + ': Syllable condition of type \'STRESSED\' has out-of-bounds \'order\' value.')
      }
    }

    function meetsBeforeStressSyllableCondition (word, syllableIndex, condition) {
      return word.syllables.slice(0, syllableIndex + 1).every(
        (syllable) => syllable.accent !== condition.order
      )
    }

    function checkBeforeStressSyllableCondition (language, condition, conditionLocation) {
      if (language.phonology.prosody.type !== 'STRESS') {
        console.error(conditionLocation + ': Syllable condition of type \'BEFORE_STRESS\' is incompatible with language of accent type \'' + language.phonology.prosody.type + '\'; type must be \'STRESS\'.')
      }
      validity.verifyPropertiesExist(condition, conditionLocation, ['order'])

      // order
      if (condition.order < 1 || condition.order > language.phonology.prosody.maxOrder) {
        console.error(conditionLocation + ': Syllable condition of type \'BEFORE_STRESS\' has out-of-bounds \'order\' value.')
      }
    }

    function meetsAfterStressSyllableCondition (word, syllableIndex, condition) {
      return word.syllables.slice(syllableIndex, word.syllables.length).every(
        (syllable) => syllable.accent !== condition.order
      )
    }

    function checkAfterStressSyllableCondition (language, condition, conditionLocation) {
      if (language.phonology.prosody.type !== 'STRESS') {
        console.error(conditionLocation + ': Syllable condition of type \'AFTER_STRESS\' is incompatible with language of accent type \'' + language.phonology.prosody.type + '\'; type must be \'STRESS\'.')
      }
      validity.verifyPropertiesExist(condition, conditionLocation, ['order'])

      // order
      if (condition.order < 1 || condition.order > language.phonology.prosody.maxOrder) {
        console.error(conditionLocation + ': Syllable condition of type \'AFTER_STRESS\' has out-of-bounds \'order\' value.')
      }
    }

    function meetsStressExistenceSyllableCondition (language, word, condition) {
      return condition.orders.every(
        (order) => word.syllables.some((syllable) => syllable.accent === order)
      )
    }

    function checkStressExistenceSyllableCondition (language, condition, conditionLocation) {
      if (language.phonology.prosody.type !== 'STRESS') {
        console.error(conditionLocation + ': Syllable condition of type \'STRESS_EXISTENCE\' is incompatible with language of accent type \'' + language.phonology.prosody.type + '\'; type must be \'STRESS\'.')
      }
      validity.verifyPropertiesExist(condition, conditionLocation, ['orders'])

      // orders
      validity.verifyNonemptyArray(condition.orders, conditionLocation + ': Field \'orders\'')

      for (let orderIndex in condition.orders) {
        let order = condition.orders[orderIndex]
        if (order <= 0 || order > language.phonology.prosody.maxOrder) {
          console.error(conditionLocation + ': Syllable condition of type \'STRESS_EXISTENCE\' has some \'orders\' value out of bounds.')
        }
      }
    }

    function meetsStressUniquenessSyllableCondition (language, word, condition) {
      return condition.orders.every(
        (order) => word.syllables.filter((syllable) => syllable.accent === order).length < 2
      )
    }

    function checkStressUniquenessSyllableCondition (language, condition, conditionLocation) {
      if (language.phonology.prosody.type !== 'STRESS') {
        console.error(conditionLocation + ': Syllable condition of type \'STRESS_UNIQUENESS\' is incompatible with language of accent type \'' + language.phonology.prosody.type + '\'; type must be \'STRESS\'.')
      }
      validity.verifyPropertiesExist(condition, conditionLocation, ['orders'])

      // orders
      validity.verifyNonemptyArray(condition.orders, conditionLocation + ': Field \'orders\'')

      for (let orderIndex in condition.orders) {
        let order = condition.orders[orderIndex]
        if (order <= 0 || order > language.phonology.prosody.maxOrder) {
          console.error(conditionLocation + ': Syllable condition of type \'STRESS_UNIQUENESS\' has some \'orders\' value out of bounds.')
        }
      }
    }

    function meetsStressParadigmSyllableCondition (language, word, syllableIndex, condition) {
      for (let positionIndex in condition.positions) {
        let position = condition.positions[positionIndex]
        if (svc.meetsSyllableCondition(language, word, position.value, position.condition)) {
          return svc.meetsSyllableCondition(language, word, position.value, {
            type: 'STRESSED',
            order: condition.order,
            syllablePosition: 0,
            syllablePositionAbsolute: false
          })
        }
      }
      return false
    }

    function checkStressParadigmSyllableCondition (language, condition, conditionLocation) {
      if (language.phonology.prosody.type !== 'STRESS') {
        console.error(conditionLocation + ': Syllable condition of type \'STRESS_PARADIGM\' is incompatible with language of accent type \'' + language.phonology.prosody.type + '\'; type must be \'STRESS\'.')
      }
      validity.verifyPropertiesExist(condition, conditionLocation, ['positions', 'order'])

      // order
      if (condition.order < 1 || condition.order > language.phonology.prosody.maxOrder) {
        console.error(conditionLocation + ': Syllable condition of type \'STRESS_PARADIGM\' has out-of-bounds \'order\' value.')
      }

      // positions
      validity.verifyNonemptyArray(condition.positions, conditionLocation + ': Field \'positions\'')
      if (condition.positions.length === 1) {
        console.error(conditionLocation + ': Syllable condition of type \'STRESS_PARADIGM\' has a singleton \'positions\' array. Use type \'STRESSED\' instead.')
      }
      for (let positionIndex in condition.positions) {
        let position = condition.positions[positionIndex]
        validity.verifyPropertiesExist(position, conditionLocation + ': Field \'positions\', index ' + positionIndex, ['value', 'condition'])

        // condition
        svc.checkSyllableCondition(language, position.condition, conditionLocation + ': Field \'positions\', index ' + positionIndex + ', field \'condition\'')
      }
    }

    function verifyPropertiesExistInPosition (language, condition, conditionLocation) {
      validity.verifyPropertiesExist(condition.position, conditionLocation + ': Field \'position\'', ['syllable', 'sound'])

      // sound
      validity.verifyIndexInPhonotactics(language, condition.position.sound, conditionLocation + ': Position field, field \'sound\'')
    }

    function verifyPropertiesExistInAllPositions (language, condition, conditionLocation) {
      validity.verifyNonemptyArray(condition.positions, conditionLocation + ': Field \'positions\'')
      for (let positionIndex in condition.positions) {
        let position = condition.positions[positionIndex]
        validity.verifyPropertiesExist(position, conditionLocation + ': Field \'positions\', index ' + positionIndex, ['syllable', 'sound'])

        // sound
        validity.verifyIndexInPhonotactics(language, position.sound, conditionLocation + ': Positions field, index ' + positionIndex + ', field \'sound\'')
      }
    }
  }])
