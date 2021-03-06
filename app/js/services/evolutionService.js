/* global angular */
angular.module('app').service('evolutionService', [
  'writingService', 'conditionsService', 'phonologyService', 'arrayService', 'validityService',
  function (writing, conditions, phonology, array, validity) {
    this.generateLanguageArray = function (language, descendantLanguage) {
      let output = [{
        name: descendantLanguage.name,
        parent: language.name,
        date: language.date,
        phonology: JSON.parse(JSON.stringify(language.phonology)),
        writingSystems: JSON.parse(JSON.stringify(language.writingSystems)),
        descendantLanguages: descendantLanguage.descendantLanguages
      }]
      let steps = descendantLanguage.evolution
      for (let stepIndex in steps) {
        let step = steps[stepIndex]
        let date = step.date
        let previousLanguage = JSON.parse(JSON.stringify(output[stepIndex]))
        let phonotactics = previousLanguage.phonology.phonotactics
        let syllableCores = previousLanguage.phonology.syllableCores
        let syllableCenter = syllableCores[0]
        let prosody = JSON.parse(JSON.stringify(previousLanguage.phonology.prosody))
        let prosodyType = prosody.type
        if (prosodyType === 'STRESS') {
          var accentMaxOrder = previousLanguage.phonology.prosody.maxOrder
        }
        let writingSystems = JSON.parse(JSON.stringify(language.writingSystems))
        for (let transformationIndex in step.transformations) {
          transformationIndex = parseInt(transformationIndex)
          let transformation = step.transformations[transformationIndex]
          checkTransformation(previousLanguage, date, transformation, transformationIndex)
          if (transformation.type === 'SOUND_CHANGE') {
            languageSoundChange(phonotactics, syllableCenter, transformation)
          }
          if (transformation.type === 'SOUND_DELETION' && transformation.condition.type === 'DEFAULT') {
            languageSoundDeletion(phonotactics, syllableCenter, transformation)
          }
          if (transformation.type === 'SOUND_INSERTION') {
            languageSoundInsertion(phonotactics, syllableCenter, transformation)
          }
          if (transformation.type === 'SOUND_MIGRATION') {
            languageSoundMigration(phonotactics, syllableCenter, transformation)
          }
          if (transformation.type === 'SOUND_COPY') {
            languageSoundCopy(phonotactics, syllableCenter, transformation)
          }
          if (transformation.type === 'SYLLABLE_POSITION_INSERTION') {
            languageSyllablePositionInsertion(phonotactics, syllableCenter, transformation)
            for (let syllableCoreIndex in syllableCores) {
              let syllableCore = syllableCores[syllableCoreIndex]
              let syllableCenter = syllableCores[0]
              if (transformation.position <= syllableCore - syllableCenter) {
                syllableCores[syllableCoreIndex] = syllableCore + 1
              }
              if (transformation.syllableCore) {
                syllableCores.push(transformation.position)
              }
            }
          }
          if (transformation.type === 'SYLLABLE_POSITION_DELETION') {
            languageSyllablePositionDeletion(phonotactics, syllableCenter, transformation)
            for (let syllableCoreIndex in syllableCores) {
              syllableCoreIndex = parseInt(syllableCoreIndex)
              let syllableCore = syllableCores[syllableCoreIndex]
              let syllableCenter = syllableCores[0]
              if (parseInt(transformation.position) === parseInt(syllableCore)) {
                syllableCores.splice(syllableCoreIndex, 1)
              }
              if (transformation.position < syllableCore - syllableCenter) {
                syllableCores[syllableCoreIndex] = syllableCore - 1
              }
            }
          }
          if (transformation.type === 'ACCENT') {
            languageAccent(prosody, syllableCenter, transformation)
          }
          writingSystems = [] // TODO: Evolve writing systems.
        }
        let newLanguage = {
          name: output[0].name,
          parent: output[0].parent,
          date: date,
          phonology: {
            phonotactics: phonotactics,
            syllableCores: syllableCores,
            prosody: prosody
          },
          writingSystems: writingSystems
        }
        if (prosodyType === 'STRESS') {
          newLanguage.phonology.prosody.maxOrder = accentMaxOrder
        }
        output.push(newLanguage)
      }
      return output
    }

    this.generate = function (word, languageArray, steps) {
      let firstWord = JSON.parse(JSON.stringify(word))
      firstWord.languageName = languageArray[0].name
      firstWord.parentLanguageName = languageArray[0].parent
      firstWord.date = languageArray[0].date
      let output = [firstWord]
      for (let stepIndex in steps) {
        let step = steps[stepIndex]
        let previousStepWord = output[stepIndex]
        let previousTransformationWord = JSON.parse(JSON.stringify(previousStepWord))
        let newWord = JSON.parse(JSON.stringify(previousTransformationWord))
        let previousStepRun = false
        let wordLength = previousStepWord.syllables.length
        for (let syllableIndex = 0; syllableIndex < wordLength; syllableIndex++) {
          previousStepRun = false
          for (let transformationIndex in step.transformations) {
            let transformation = step.transformations[transformationIndex]
            let stepLanguage = languageArray[stepIndex]
            newWord = null
            if (!conditions.meetsSyllableCondition(
              stepLanguage, previousTransformationWord, syllableIndex,
              transformation.condition, previousStepRun
            )) {
              previousStepRun = false
              newWord = JSON.parse(JSON.stringify(previousTransformationWord))
            } else {
              let previousStepRunCondition = findFollowsFromLastStepCondition(transformation.condition)
              let syllableShift = 0
              if (previousStepRunCondition !== null && previousStepRun) {
                syllableShift = previousStepRunCondition.syllableShift
              }
              let shiftedSyllableIndex = parseInt(syllableIndex) + syllableShift
              previousStepRun = false
              newWord = JSON.parse(JSON.stringify(previousTransformationWord))
              transform(
                newWord, wordLength, stepLanguage, shiftedSyllableIndex, transformation
              )
            }
            if (!phonology.isSameWord(previousTransformationWord, newWord)) {
              previousStepRun = true
            }
            newWord.languageName = stepLanguage.name
            newWord.parentLanguageName = stepLanguage.parent
            newWord.date = step.date
            previousTransformationWord = JSON.parse(JSON.stringify(newWord))
          }
        }
        output.push(newWord)
      }
      for (let wordIndex in output) {
        let word = output[wordIndex]
        let stepLanguage = languageArray[wordIndex]
        word.writingSystems = [
          {
            name: 'IPA',
            word: writing.write(word, stepLanguage, 'IPA')
          }
        ]
        for (let writingSystem of stepLanguage.writingSystems) {
          word.writingSystems.push(
            {
              name: writingSystem.name,
              word: writing.write(word, stepLanguage, writingSystem.name)
            }
          )
        }
      }
      return output
    }

    this.generateReverse = function (word, languageArray, steps) {
      let output = [word]
      for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex--) {
        let newWords = []
        for (let word of output) {
          newWords.concat(runSyllablesReverse(word, languageArray[stepIndex], steps[stepIndex].transformations))
        }
        output = newWords
      }
      return output
    }

    function runSyllablesReverse (word, language, transformations) {
      let output = [word]
      for (let syllableIndex = word.syllables.length - 1; syllableIndex >= 0; syllableIndex--) {
        let newWords = []
        for (let word of output) {
          newWords.concat(runTransformationsReverse(word, language, syllableIndex, transformations))
        }
        output = newWords
      }
      return output
    }

    function runTransformationsReverse (word, language, syllableIndex, transformations) {
      let output = [word]
      for (let transformationIndex = transformations.length - 1; transformationIndex >= 0; transformationIndex--) {
        let newWords = []
        for (let word of output) {
          newWords.concat(reverseTransform(word, language, syllableIndex, transformations[transformationIndex]))
        }
        output = newWords
      }
      return output
    }

    this.transformAffixedStem = function (stem, transformations, language) {
      let stemLength = stem.syllables.length
      for (let transformation of transformations) {
        for (let syllableIndex in stem.syllables) {
          if (conditions.meetsSyllableCondition(language, stem, syllableIndex, transformation.condition, false)) {
            transform(stem, stemLength, language, parseInt(syllableIndex), transformation)
          }
        }
      }
      return stem
    }

    function transform (
      word, wordLength, language, syllableIndex, transformation
    ) {
      if (transformation.type === 'SOUND_CHANGE') {
        soundChange(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_DELETION') {
        soundDeletion(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_INSERTION') {
        soundInsertion(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_MIGRATION') {
        soundMigration(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_COPY') {
        soundCopy(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_SWAP') {
        soundSwap(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'CONSONANT_DEGEMINATION') {
        consonantDegemination(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SYLLABLE_COLLAPSE') {
        syllableCollapse(word, language, syllableIndex, transformation)
        wordLength--
      }
      if (transformation.type === 'SYLLABLE_INSERTION') {
        syllableInsertion(word, language, syllableIndex, transformation)
        wordLength++
      }
      if (transformation.type === 'ACCENT') {
        accent(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'STRESS_SHIFT') {
        stressShift(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SYLLABLE_POSITION_INSERTION') {
        syllablePositionInsertion(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SYLLABLE_POSITION_DELETION') {
        syllablePositionDeletion(word, language, syllableIndex, transformation)
      }
    }

    function reverseTransform (word, language, syllableIndex, transformation) {
      if (transformation.type === 'SOUND_CHANGE') {
        return reverseSoundChange(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_DELETION') {
        return reverseSoundDeletion(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_INSERTION') {
        return reverseSoundInsertion(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_MIGRATION') {
        return reverseSoundMigration(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_COPY') {
        return reverseSoundCopy(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SOUND_SWAP') {
        return reverseSoundSwap(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'CONSONANT_DEGEMINATION') {
        return reverseConsonantDegemination(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SYLLABLE_COLLAPSE') {
        return reverseSyllableCollapse(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SYLLABLE_INSERTION') {
        return reverseSyllableInsertion(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'ACCENT') {
        return reverseAccent(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'STRESS_SHIFT') {
        return reverseStressShift(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SYLLABLE_POSITION_INSERTION') {
        return reverseSyllablePositionInsertion(word, language, syllableIndex, transformation)
      }
      if (transformation.type === 'SYLLABLE_POSITION_DELETION') {
        return reverseSyllablePositionDeletion(word, language, syllableIndex, transformation)
      }
    }

    function findFollowsFromLastStepCondition (condition) {
      if (condition.type === 'FOLLOWS_FROM_LAST_STEP') {
        return condition
      } else if (condition.type === 'AND' || condition.type === 'OR') {
        let conjunctConditions = condition.conditions
          .map((conjunctCondition) => findFollowsFromLastStepCondition(conjunctCondition))
          .filter((conjunctCondition) => conjunctCondition !== null)
        if (conjunctConditions.length > 0) {
          return conjunctConditions[0]
        } else {
          return null
        }
      } else {
        return null
      }
    }

    function checkTransformation (language, date, transformation, transformationIndex) {
      let transformationLocation = 'Step dated ' + date + ', transformationIndex ' + transformationIndex
      validity.verifyNotNull(transformation, transformationLocation)
      validity.verifyPropertiesExist(transformation, transformationLocation, ['type'])
      if (transformation.type === 'SOUND_CHANGE') {
        checkSoundChange(language, transformation, transformationLocation)
      } else if (transformation.type === 'SOUND_DELETION') {
        checkSoundDeletion(language, transformation, transformationLocation)
      } else if (transformation.type === 'SOUND_INSERTION') {
        checkSoundInsertion(language, transformation, transformationLocation)
      } else if (transformation.type === 'SOUND_MIGRATION') {
        checkSoundMigration(language, transformation, transformationLocation)
      } else if (transformation.type === 'SOUND_COPY') {
        checkSoundCopy(language, transformation, transformationLocation)
      } else if (transformation.type === 'SOUND_SWAP') {
        checkSoundSwap(language, transformation, transformationLocation)
      } else if (transformation.type === 'CONSONANT_DEGEMINATION') {
        checkConsonantDegemination(language, transformation, transformationLocation)
      } else if (transformation.type === 'SYLLABLE_COLLAPSE') {
        checkSyllableCollapse(language, transformation, transformationLocation)
      } else if (transformation.type === 'SYLLABLE_INSERTION') {
        checkSyllableInsertion(language, transformation, transformationLocation)
      } else if (transformation.type === 'STRESS_SHIFT') {
        checkStressShift(language, transformation, transformationLocation)
      } else if (transformation.type === 'SYLLABLE_POSITION_INSERTION') {
        checkSyllablePositionInsertion(language, transformation, transformationLocation)
      } else if (transformation.type === 'SYLLABLE_POSITION_DELETION') {
        checkSyllablePositionDeletion(language, transformation, transformationLocation)
      }
    }

    let meetsPhonotactics = (word, phonotactics) => word.syllables.every(syllable =>
      phonotactics.every((possiblePhonemes, phonemeIndex) =>
        possiblePhonemes.map(phoneme => phoneme.value).indexOf(syllable.phonemes[phonemeIndex]) > -1
      )
    )

    function soundChange (word, language, syllableIndex, transformation) {
      for (let position of transformation.positions) {
        let absolutePosition = language.phonology.syllableCores[0] + position
        for (let change of transformation.changes) {
          if (word.syllables[syllableIndex].phonemes[absolutePosition] === change.fromSound) {
            word.syllables[syllableIndex].phonemes[absolutePosition] = change.toSound
          }
        }
      }
    }

    function reverseSoundChange (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      for (let position of transformation.positions) {
        let absolutePosition = language.phonology.syllableCores[0] + position
        let newPossibleInputs = JSON.parse(JSON.stringify(possibleInputs))
        for (let possibleInput of possibleInputs) {
          for (let change of transformation.changes.filter(thisChange =>
            possibleInput.syllables[syllableIndex].phonemes[absolutePosition] === change.toSound
          )) {
            let newPossibleInput = JSON.parse(JSON.stringify(possibleInput))
            newPossibleInput.syllables[syllableIndex].phonemes[absolutePosition] = change.fromSound
            newPossibleInputs.push(newPossibleInput)
          }
        }
        possibleInputs = JSON.parse(JSON.stringify(newPossibleInputs))
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function languageSoundChange (phonotactics, syllableCenter, transformation) {
      for (let position of transformation.positions) {
        let absolutePosition = syllableCenter + position
        for (let change of transformation.changes) {
          if (phonotactics[absolutePosition].every((option) => option.value !== change.toSound)) {
            phonotactics[absolutePosition].push({
              value: change.toSound
            })
          }
        }
        if (transformation.condition.type === 'DEFAULT') {
          for (let change of transformation.changes) {
            phonotactics[absolutePosition] = phonotactics[absolutePosition].filter(
              (option) => option.value !== change.fromSound
            )
          }
        }
      }
    }

    function checkSoundChange (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['positions', 'changes', 'condition'])

      // positions
      validity.verifyNonemptyArray(transformation.positions, transformationLocation + ': Field \'positions\'')
      for (let positionIndex in transformation.positions) {
        let position = transformation.positions[positionIndex]
        validity.verifyIndexInPhonotactics(language, position, transformation + ': Field \'positions\', index ' + positionIndex)
      }

      // changes
      validity.verifyNonemptyArray(transformation.changes, transformationLocation + ': Field \'changes\'')
      for (let changeIndex in transformation.changes) {
        let change = transformation.changes[changeIndex]
        validity.verifyPropertiesExist(change, transformationLocation + ': Field \'changes\', index ' + changeIndex, ['fromSound', 'toSound'])

        // fromSound
        validity.verifyValueSomewhereInPhonotactics(language, change.fromSound, transformationLocation + ': Field \'changes\', index ' + changeIndex + ', field \'fromSound\'')
      }

      // condition
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    function soundDeletion (word, language, syllableIndex, transformation) {
      for (let position of transformation.positions) {
        let absolutePosition = language.phonology.syllableCores[0] + position
        for (let sound of transformation.sounds) {
          if (word.syllables[syllableIndex].phonemes[absolutePosition] === sound) {
            word.syllables[syllableIndex].phonemes[absolutePosition] = ''
          }
        }
      }
    }

    function reverseSoundDeletion (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      for (let position of transformation.positions) {
        let absolutePosition = language.phonology.syllableCores[0] + position
        let newPossibleInputs = JSON.parse(JSON.stringify(possibleInputs))
        for (let possibleInput of possibleInputs) {
          if (possibleInput.syllables[syllableIndex].phonemes[absolutePosition] === '') {
            for (let sound of transformation.sounds) {
              let newPossibleInput = JSON.parse(JSON.stringify(possibleInput))
              newPossibleInput.syllables[syllableIndex].phonemes[absolutePosition] = sound
              newPossibleInputs.push(newPossibleInput)
            }
          }
        }
        possibleInputs = JSON.parse(JSON.stringify(newPossibleInputs))
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function languageSoundDeletion (phonotactics, syllableCenter, transformation) {
      for (let position of transformation.positions) {
        let absolutePosition = syllableCenter + position
        for (let sound of transformation.sounds) {
          phonotactics[absolutePosition] = phonotactics[absolutePosition].filter(
            (option) => option.value !== sound
          )
        }
      }
    }

    function checkSoundDeletion (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['positions', 'sounds', 'condition'])

      // positions
      validity.verifyNonemptyArray(transformation.positions, transformationLocation + ': Field \'positions\'')
      for (let positionIndex in transformation.positions) {
        let position = transformation.positions[positionIndex]
        validity.verifyIndexInPhonotactics(language, position, transformation + ': Field \'positions\', index ' + positionIndex)
      }

      // sounds
      validity.verifyNonemptyArray(transformation.sounds, transformationLocation + ': Field \'sounds\'')
      for (let soundIndex in transformation.sounds) {
        let sound = transformation.sounds[soundIndex]
        validity.verifyValueSomewhereInPhonotactics(language, sound, transformationLocation + ': Field \'sounds\', index ' + soundIndex)
      }

      // condition
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    function soundInsertion (word, language, syllableIndex, transformation) {
      let absolutePosition = language.phonology.syllableCores[0] + transformation.position
      if (word.syllables[syllableIndex].phonemes[absolutePosition] === '') {
        word.syllables[syllableIndex].phonemes[absolutePosition] = transformation.sound
      }
    }

    function reverseSoundInsertion (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      let absolutePosition = language.phonology.syllableCores[0] + transformation.position
      if (word.syllables[syllableIndex].phonemes[absolutePosition] === transformation.sound) {
        let newPossibleInput = JSON.parse(JSON.stringify(word))
        newPossibleInput.syllables[syllableIndex].phonemes[absolutePosition] = ''
        possibleInputs.push(newPossibleInput)
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function languageSoundInsertion (phonotactics, syllableCenter, transformation) {
      let absolutePosition = syllableCenter + transformation.position
      if (phonotactics[absolutePosition].every((option) => option.value !== transformation.sound)) {
        phonotactics[absolutePosition].push({
          value: transformation.sound
        })
      }
    }

    function checkSoundInsertion (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['position', 'sound', 'condition'])

      // position
      validity.verifyIndexInPhonotactics(language, transformation.position, transformation + ': Field \'position\'')

      // condition
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    function soundMigration (word, language, syllableIndex, transformation) {
      for (let migration of transformation.migrations) {
        let fromSyllableIndex = syllableIndex
        let toSyllableIndex = parseInt(syllableIndex) + parseInt(migration.syllableShift)
        if (
          toSyllableIndex < word.syllables.length && toSyllableIndex >= 0 &&
          fromSyllableIndex < word.syllables.length && fromSyllableIndex >= 0
        ) {
          let fromPhonemeIndex = language.phonology.syllableCores[0] + migration.fromPosition
          let toPhonemeIndex = language.phonology.syllableCores[0] + migration.toPosition
          if (word.syllables[toSyllableIndex].phonemes[toPhonemeIndex] === '' || transformation.overwrite) {
            word.syllables[toSyllableIndex].phonemes[toPhonemeIndex] = word.syllables[fromSyllableIndex].phonemes[fromPhonemeIndex]
            word.syllables[fromSyllableIndex].phonemes[fromPhonemeIndex] = ''
          }
        }
      }
    }

    function reverseSoundMigration (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      for (let migration of transformation.migrations) {
        let absoluteFromPosition = language.phonology.syllableCores[0] + migration.fromPosition
        let absoluteToPosition = language.phonology.syllableCores[0] + migration.toPosition
        let fromSyllableIndex = syllableIndex
        let toSyllableIndex = syllableIndex + migration.syllableShift
        if (toSyllableIndex < word.syllables.length && toSyllableIndex >= 0) {
          if (word.syllables[fromSyllableIndex].phonemes[absoluteFromPosition] === '') {
            let newPossibleInputs = JSON.parse(JSON.stringify(possibleInputs))
            for (let possibleInput of possibleInputs) {
              for (let sound of language.phonology.phonotactics[absoluteToPosition]
                .filter(phonotacticsPosition => phonotacticsPosition === '' || transformation.overwrite)
              ) {
                let newPossibleInput = JSON.parse(JSON.stringify(possibleInput))
                newPossibleInput.syllables[fromSyllableIndex].phonemes[absoluteFromPosition] =
                  newPossibleInput.syllables[toSyllableIndex].phonemes[absoluteToPosition]
                newPossibleInput.syllables[toSyllableIndex].phonemes[absoluteToPosition] = sound
                newPossibleInputs.push(newPossibleInput)
              }
            }
            possibleInputs = JSON.parse(JSON.stringify(newPossibleInputs))
          }
        }
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function languageSoundMigration (phonotactics, syllableCenter, transformation) {
      for (let migration of transformation.migrations) {
        let absoluteFromPosition = syllableCenter + migration.fromPosition
        let absoluteToPosition = syllableCenter + migration.toPosition
        if (absoluteToPosition >= 0 && absoluteToPosition < phonotactics.length) {
          for (let fromOption of phonotactics[absoluteFromPosition]) {
            if (phonotactics[absoluteToPosition].every((toOption) => toOption.value !== fromOption.value)) {
              phonotactics[absoluteToPosition].push(fromOption)
            }
          }
        }
      }
      if (transformation.condition.type === '' && transformation.overwrite) {
        for (let migration of transformation.migrations) {
          let absoluteFromPosition = syllableCenter + migration.fromPosition
          phonotactics[absoluteFromPosition] = []
        }
      }
    }

    function checkSoundMigration (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['migrations', 'overwrite', 'condition'])

      // migrations
      validity.verifyNonemptyArray(transformation.migrations, transformationLocation + ': Field \'migrations\'')
      for (let migrationIndex in transformation.migrations) {
        let migration = transformation.migrations[migrationIndex]
        validity.verifyPropertiesExist(migration, transformationLocation + ': Field \'migrations\', index ' + migrationIndex, ['fromPosition', 'syllableShift', 'toPosition'])

        // fromPosition
        validity.verifyIndexInPhonotactics(language, migration.fromPosition, transformationLocation + ': Field \'migrations\', index ' + migrationIndex + ', field \'fromPosition\'')

        // toPosition
        validity.verifyIndexInPhonotactics(language, migration.toPosition, transformationLocation + ': Field \'migrations\', index ' + migrationIndex + ', field \'toPosition\'')
      }

      // condition
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    function soundCopy (word, language, syllableIndex, transformation) {
      for (let migration of transformation.migrations) {
        if (syllableIndex + migration.syllableShift >= 0 && syllableIndex + migration.syllableShift < word.syllables.length) {
          let absoluteFromPosition = language.phonology.syllableCores[0] + migration.fromPosition
          let absoluteToPosition = language.phonology.syllableCores[0] + migration.toPosition
          if (word.syllables[syllableIndex + migration.syllableShift].phonemes[absoluteFromPosition] === '' || transformation.overwrite) {
            word.syllables[syllableIndex + migration.syllableShift].phonemes[absoluteToPosition] = word.syllables[syllableIndex].phonemes[absoluteFromPosition]
          }
        }
      }
    }

    function reverseSoundCopy (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      for (let migration of transformation.migrations) {
        let absoluteFromPosition = language.phonology.syllableCores[0] + migration.fromPosition
        let absoluteToPosition = language.phonology.syllableCores[0] + migration.toPosition
        let fromSyllableIndex = syllableIndex
        let toSyllableIndex = syllableIndex + migration.syllableShift
        if (toSyllableIndex < word.syllables.length && toSyllableIndex >= 0) {
          if (word.syllables[fromSyllableIndex].phonemes[absoluteFromPosition] ===
            word.syllables[toSyllableIndex].phonemes[absoluteToPosition]
          ) {
            let newPossibleInputs = JSON.parse(JSON.stringify(possibleInputs))
            for (let possibleInput of possibleInputs) {
              for (let sound of language.phonology.phonotactics[absoluteToPosition]
                .filter(phonotacticsPosition => phonotacticsPosition === '' || transformation.overwrite)
              ) {
                let newPossibleInput = JSON.parse(JSON.stringify(possibleInput))
                newPossibleInput.syllables[toSyllableIndex].phonemes[absoluteToPosition] = sound
                newPossibleInputs.push(newPossibleInput)
              }
            }
            possibleInputs = JSON.parse(JSON.stringify(newPossibleInputs))
          }
        }
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function languageSoundCopy (phonotactics, syllableCenter, transformation) {
      for (let migration of transformation.migrations) {
        let absoluteFromPosition = syllableCenter + migration.fromPosition
        let absoluteToPosition = syllableCenter + migration.toPosition
        for (let fromOption of phonotactics[absoluteFromPosition]) {
          if (phonotactics[absoluteToPosition].every((toOption) => toOption.value !== fromOption.value)) {
            phonotactics[absoluteToPosition].push(fromOption)
          }
        }
      }
    }

    function checkSoundCopy (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['migrations', 'overwrite', 'condition'])

      // migrations
      validity.verifyNonemptyArray(transformation.migrations, transformationLocation + ': Field \'migrations\'')
      for (let migrationIndex in transformation.migrations) {
        let migration = transformation.migrations[migrationIndex]
        validity.verifyPropertiesExist(migration, transformationLocation + ': Field \'migrations\', index ' + migrationIndex, ['fromPosition', 'syllableShift', 'toPosition'])

        // fromPosition
        validity.verifyIndexInPhonotactics(language, migration.fromPosition, transformationLocation + ': Field \'migrations\', index ' + migrationIndex + ', field \'fromPosition\'')

        // toPosition
        validity.verifyIndexInPhonotactics(language, migration.toPosition, transformationLocation + ': Field \'migrations\', index ' + migrationIndex + ', field \'toPosition\'')
      }

      // condition
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    function soundSwap (word, language, syllableIndex, transformation) {
      let fromSyllableIndex = syllableIndex
      let toSyllableIndex = parseInt(syllableIndex) + parseInt(transformation.swap.syllableShift)
      if (toSyllableIndex < word.syllables.length && toSyllableIndex >= 0) {
        let fromPhonemeIndex = language.phonology.syllableCores[0] + transformation.swap.fromPosition
        let toPhonemeIndex = language.phonology.syllableCores[0] + transformation.swap.toPosition
        let reservePhoneme = word.syllables[toSyllableIndex].phonemes[toPhonemeIndex]
        word.syllables[toSyllableIndex].phonemes[toPhonemeIndex] = word.syllables[fromSyllableIndex].phonemes[fromPhonemeIndex]
        word.syllables[fromSyllableIndex].phonemes[fromPhonemeIndex] = reservePhoneme
      }
    }

    function reverseSoundSwap (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      let absoluteFromPosition = language.phonology.syllableCores[0] + transformation.swap.fromPosition
      let absoluteToPosition = language.phonology.syllableCores[0] + transformation.swap.toPosition
      let fromSyllableIndex = syllableIndex
      let toSyllableIndex = syllableIndex + transformation.swap.syllableShift
      if (toSyllableIndex < word.syllables.length && toSyllableIndex >= 0) {
        let newPossibleInput = JSON.parse(JSON.stringify(word))
        let reservePhoneme = word.syllables[fromSyllableIndex].phonemes[absoluteFromPosition]
        word.syllables[fromSyllableIndex].phonemes[absoluteFromPosition] = word.syllables[toSyllableIndex].phonemes[absoluteToPosition]
        word.syllables[toSyllableIndex].phonemes[absoluteToPosition] = reservePhoneme
        possibleInputs.push(newPossibleInput)
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function checkSoundSwap (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['swap', 'condition'])

      // swap
      let swap = transformation.swap
      validity.verifyPropertiesExist(swap, transformationLocation + ': Field \'swap\'', ['fromPosition', 'syllableShift', 'toPosition'])

      // fromPosition
      validity.verifyIndexInPhonotactics(language, swap.fromPosition, transformationLocation + ': Field \'swap\', field \'fromPosition\'')

      // toPosition
      validity.verifyIndexInPhonotactics(language, swap.toPosition, transformationLocation + ': Field \'swap\', field \'toPosition\'')

      // condition
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    function consonantDegemination (word, language, syllableIndex, transformation) {
      if (syllableIndex !== word.syllables.length - 1) {
        let currentSyllableFinalSoundIndex = word.syllables[syllableIndex].phonemes.length - 1
        while (
          word.syllables[syllableIndex].phonemes[currentSyllableFinalSoundIndex] === '' &&
          currentSyllableFinalSoundIndex >= 0
        ) { currentSyllableFinalSoundIndex-- }
        let nextSyllableInitialSoundIndex = 0
        while (
          syllableIndex < word.syllables.length - 1 &&
          word.syllables[syllableIndex + 1].phonemes[nextSyllableInitialSoundIndex] === '' &&
          nextSyllableInitialSoundIndex < word.syllables[syllableIndex].phonemes.length
        ) { nextSyllableInitialSoundIndex++ }
        if (
          currentSyllableFinalSoundIndex > language.phonology.syllableCores[0] &&
          nextSyllableInitialSoundIndex < language.phonology.syllableCores[0]
        ) {
          if (
            word.syllables[syllableIndex].phonemes[currentSyllableFinalSoundIndex] ===
            word.syllables[syllableIndex + 1].phonemes[nextSyllableInitialSoundIndex] ||
            word.syllables[syllableIndex + 1].phonemes[nextSyllableInitialSoundIndex] === 'ː'
          ) {
            word.syllables[syllableIndex + 1].phonemes[nextSyllableInitialSoundIndex] =
            word.syllables[syllableIndex].phonemes[currentSyllableFinalSoundIndex]
            word.syllables[syllableIndex].phonemes[currentSyllableFinalSoundIndex] = ''
          }
        }
      }
    }

    function reverseConsonantDegemination (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      if (syllableIndex < word.syllables.length - 1) {
        let syllableStartIndex = -language.phonology.syllableCores[0]
        while (word.syllables[syllableIndex + 1].phonemes[syllableStartIndex] === '' && syllableStartIndex < 0) {
          syllableStartIndex++
        }
        if (syllableStartIndex < 0) {
          let consonant = word.syllables[syllableIndex + 1].phonemes[syllableStartIndex]
          let syllableEndIndex = word.syllables[syllableIndex].phonemes.length - language.phonology.syllableCores[0]
          while (word.syllables[syllableIndex].phonemes[syllableEndIndex] === '' && syllableEndIndex > 0) {
            syllableEndIndex--
          }
          if (syllableEndIndex > 0 && word.syllable[syllableIndex].phonemes[syllableEndIndex] === '') {
            let newPossibleInput = JSON.parse(JSON.stringify(word))
            newPossibleInput.syllable[syllableIndex].phonemes[syllableEndIndex] = consonant
            word.syllables[syllableIndex + 1].phonemes[syllableStartIndex] = 'ː'
            possibleInputs.push(newPossibleInput)
          }
        }
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function checkConsonantDegemination (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['condition'])
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    function syllableCollapse (word, language, syllableIndex, transformation) {
      if (language.phonology.prosody.type === 'STRESS') {
        if (syllableIndex < word.syllables.length - 1) {
          if (word.syllables[syllableIndex].accent === 0) {
            word.syllables[syllableIndex].accent = word.syllables[syllableIndex + 1].accent
          }
        }
      }
      let absolutePosition = language.phonology.syllableCores[0] + transformation.position
      if (syllableIndex === word.syllables.length - 1) {
        for (let phonemeIndex = absolutePosition; phonemeIndex < word.syllables[syllableIndex].phonemes.length; phonemeIndex++) {
          word.syllables[syllableIndex].phonemes[phonemeIndex] = ''
        }
      } else {
        for (let phonemeIndex = absolutePosition; phonemeIndex < word.syllables[syllableIndex].phonemes.length; phonemeIndex++) {
          word.syllables[syllableIndex].phonemes[phonemeIndex] = word.syllables[syllableIndex + 1].phonemes[phonemeIndex]
        }
      }
      word.syllables.splice(syllableIndex + 1, 1)
      if (word.syllables[word.syllables.length - 1].phonemes.every((phoneme, phonemeIndex) => phonemeIndex < language.phonology.syllableCores[0] || phoneme === '')) {
        word.syllables.splice(-1, 1)
      }
    }

    function reverseSyllableCollapse (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      for (let possibleSyllable of phonology.generatePossibleSyllables(language.phonotactics)) {
        let newPossibleInput = JSON.parse(JSON.stringify(word))
        newPossibleInput.syllables.splice(
          syllableIndex + 1, 0, JSON.parse(JSON.stringify(newPossibleInput.syllables[syllableIndex]))
        )
        for (let phonemeIndex in possibleSyllable) {
          if (phonemeIndex < transformation.position) {
            newPossibleInput.syllables[syllableIndex + 1].phonemes[phonemeIndex] = possibleSyllable[phonemeIndex]
          } else {
            newPossibleInput.syllables[syllableIndex].phonemes[phonemeIndex] = possibleSyllable[phonemeIndex]
          }
        }
        possibleInputs.push(newPossibleInput)
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function checkSyllableCollapse (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['position', 'condition'])

      // position
      validity.verifyIndexInPhonotactics(language, transformation.position, transformationLocation + ': Field \'position\'')

      // condition
      if (transformation.condition === '') {
        console.error(transformationLocation + ': Transformation of type \'SYLLABLE_COLLAPSE\' has empty \'condition\' property. This is not allowed.')
      }
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    function syllableInsertion (word, language, syllableIndex, transformation) {
      word.syllables.splice(syllableIndex, 0, { accent: 0, phonemes: transformation.phonemes })
    }

    function reverseSyllableInsertion (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      if (
        syllableIndex > 0 &&
        word.syllables[syllableIndex - 1].accent === 0 &&
        word.syllables[syllableIndex - 1].phonemes.every(
          (phoneme, phonemeIndex) => phoneme === transformation.phonemes[phonemeIndex]
        )
      ) {
        let newPossibleInput = JSON.parse(JSON.stringify(word))
        newPossibleInput.syllables.splice(syllableIndex - 1, 1)
        possibleInputs.push(newPossibleInput)
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function checkSyllableInsertion (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['phonemes', 'condition'])
      if (transformation.phonemes.length !== language.phonology.phonotactics.length) {
        console.error(
          transformationLocation + ': Phoneme array is the incorrect length. ' +
          'Length must be ' + language.phonology.phonotactics.length + ', but found: ' + transformation.phonemes.length
        )
      }
    }

    function accent (word, language, syllableIndex, transformation) {
      let absoluteSyllablePosition = transformation.syllablePosition +
      (transformation.syllablePositionAbsolute ? 0 : syllableIndex)
      word.syllables[absoluteSyllablePosition].accent = transformation.order
    }

    function reverseAccent (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      let absoluteSyllablePosition = transformation.syllablePositionAbsolute
        ? array.signedModulate(transformation.syllablePosition)
        : transformation.syllablePosition + syllableIndex < 0 ? 0
          : transformation.syllablePosition + syllableIndex >= word.syllables.length ? word.syllables.length - 1
            : transformation.syllablePosition + syllableIndex
      for (let possibleAccent of phonology.getAllPossibleAccents(language.phonology.prosody)) {
        let newPossibleInput = JSON.parse(JSON.stringify(word))
        newPossibleInput.syllables[absoluteSyllablePosition].accent = possibleAccent
        possibleInputs.push(newPossibleInput)
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function languageAccent (prosody, syllableCenter, transformation) {
      if (prosody.type === 'NONE') {
        prosody.type = 'STRESS'
        prosody.maxOrder = transformation.order
      }
      if (prosody.type === 'STRESS' && prosody.maxOrder < transformation.order) {
        prosody.maxOrder = transformation.order
      }
    }

    function stressShift (word, language, syllableIndex, transformation) {
      if (word.syllables[syllableIndex].accent === transformation.order) {
        word.syllables[syllableIndex].accent = 0
        let newSyllableIndex = transformation.shift +
          (transformation.syllablePositionAbsolute ? 0 : syllableIndex)
        if (transformation.syllablePositionAbsolute) {
          while (newSyllableIndex < 0) {
            newSyllableIndex = newSyllableIndex + word.syllables.length
          }
          while (newSyllableIndex >= word.syllables.length) {
            newSyllableIndex = newSyllableIndex - word.syllables.length
          }
        }
        if (newSyllableIndex < 0) {
          word.syllables[0].accent = transformation.order
        } else if (newSyllableIndex >= word.syllables.length) {
          word.syllables[word.syllables.length - 1].accent = transformation.order
        } else {
          word.syllables[newSyllableIndex].accent = transformation.order
        }
      }
    }

    function reverseStressShift (word, language, syllableIndex, transformation) {
      let possibleInputs = conditions.meetsSyllableCondition(
        language, word, syllableIndex,
        transformation.condition, true
      ) ? [] : [JSON.parse(JSON.stringify(word))]
      let targetSyllableIndex = transformation.syllablePositionAbsolute
        ? array.signedModulate(transformation.shift)
        : transformation.shift + syllableIndex < 0 ? 0
          : transformation.shift + syllableIndex >= word.syllables.length ? word.syllables.length - 1
            : transformation.shift + syllableIndex
      if (
        word.syllables[targetSyllableIndex].accent === transformation.order &&
        word.syllables[syllableIndex].accent === 0
      ) {
        for (let possibleAccent of phonology.getAllPossibleAccents(language.phonology.prosody)) {
          let newPossibleInput = JSON.parse(JSON.stringify(word))
          newPossibleInput.syllables[targetSyllableIndex].accent = possibleAccent
          newPossibleInput.syllables[syllableIndex].accent = transformation.order
          possibleInputs.push(newPossibleInput)
        }
      }
      return possibleInputs.filter(possibleInput =>
        meetsPhonotactics(possibleInput, language.phonotactics) && (
          JSON.stringify(possibleInput) === JSON.stringify(word) ||
          conditions.meetsSyllableCondition(
            language, possibleInput, syllableIndex,
            transformation.condition, true
          )
        )
      )
    }

    function checkStressShift (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['order', 'shift', 'syllablePositionAbsolute', 'condition'])

      // order
      if (transformation.order <= 0 || transformation.order > language.phonology.prosody.maxOrder) {
        console.error(transformationLocation + ': Transformation of type \'STRESS_SHIFT\' has \'order\' value out of bounds. Found value: ' + transformation.order)
      }

      // condition
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    function syllablePositionInsertion (word, language, syllableIndex, transformation) {
      let absolutePosition = transformation.position + language.phonology.syllableCores[0] +
        (transformation.position < 0 ? 1 : 0)
      word.syllables[syllableIndex].phonemes.splice(absolutePosition, 0, '')
    }

    function reverseSyllablePositionInsertion (word, language, syllableIndex, transformation) {
      let newPossibleInput = JSON.parse(JSON.stringify(word))
      for (
        let phonemeIndex = language.phonology.syllableCores[0] + transformation.position +
          (transformation.position < 0 ? 1 : 0);
        phonemeIndex < newPossibleInput.syllables.length - 1;
        phonemeIndex++
      ) {
        word.syllables[syllableIndex].phonemes[phonemeIndex] = word.syllables[syllableIndex].phonemes[phonemeIndex + 1]
      }
      newPossibleInput.pop()
      return [newPossibleInput]
    }

    function languageSyllablePositionInsertion (phonotactics, syllableCenter, transformation) {
      let absolutePosition = transformation.position + syllableCenter +
        (transformation.position < 0 ? 1 : 0)
      phonotactics.splice(absolutePosition, 0, [''])
    }

    function checkSyllablePositionInsertion (language, transformation, syllableIndex, transformationLocation) {
      if (transformation.position === 0) {
        console.error(transformationLocation + ': Transformation of type \'SYLLABLE_POSITION_INSERTION\' has zero \'position\' value. It must be nonzero.')
      }
      if (
        transformation.position < -language.phonology.syllableCores[0] - 1 ||
        transformation.position > language.phonology.phonotactics.length - language.phonology.syllableCores[0]
      ) {
        console.error(transformationLocation + ': Transformation of type \'SYLLABLE_POSITION_INSERTION\' has \'position\' value out of bounds.')
      }
      if (transformation.condition.type !== 'DEFAULT') {
        console.error(transformationLocation + ': Transformation of type \'SYLLABLE_POSITION_INSERTION\' has non-default condition. It must be default.')
      }
    }

    function syllablePositionDeletion (word, language, syllableIndex, transformation) {
      word.syllables[syllableIndex].phonemes.splice(transformation.position + language.phonology.syllableCores[0], 1)
    }

    function reverseSyllablePositionDeletion (word, language, syllableIndex, transformation) {
      let possibleInputs = []
      for (let possiblePhoneme of language.phonology.phonotactics[transformation.position]) {
        let newPossibleInput = JSON.parse(JSON.stringify(word))
        for (
          let phonemeIndex = language.phonology.syllablesCores[0] + transformation.position -
            (transformation.position < 0 ? 1 : 0);
          phonemeIndex < newPossibleInput.syllables[syllableIndex].phonemes.length;
          phonemeIndex++
        ) {
          newPossibleInput.syllables[syllableIndex].phonemes[phonemeIndex + 1] = newPossibleInput.syllables[syllableIndex].phonemes[phonemeIndex]
        }
        newPossibleInput.syllables[syllableIndex].phonemes[language.phonology.syllablesCores[0] + transformation.position] = possiblePhoneme.value
        possibleInputs.push(newPossibleInput)
      }
      return possibleInputs
    }

    function languageSyllablePositionDeletion (phonotactics, syllableCenter, transformation) {
      phonotactics.splice(transformation.position + syllableCenter, 1)
    }

    function checkSyllablePositionDeletion (language, transformation, transformationLocation) {
      if (transformation.position === 0) {
        console.error(transformationLocation + ': Transformation of type \'SYLLABLE_POSITION_DELETION\' has zero \'position\' value. It must be nonzero.')
      }
      if (
        transformation.position < -language.phonology.syllableCores[0] ||
        transformation.position > language.phonology.phonotactics.length - language.phonology.syllableCores[0] - 1
      ) {
        console.error(transformationLocation + ': Transformation of type \'SYLLABLE_POSITION_DELETION\' has \'position\' value out of bounds.')
      }
      if (transformation.condition.type !== 'DEFAULT') {
        console.error(transformationLocation + ': Transformation of type \'SYLLABLE_POSITION_DELETION\' has non-default condition. It must be default.')
      }
    }
  }])
