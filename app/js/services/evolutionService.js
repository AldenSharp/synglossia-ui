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
        let vowelCore = previousLanguage.phonology.vowelCore
        let prosodyType = previousLanguage.phonology.prosody.type
        if (prosodyType === 'STRESS') {
          var accentMaxOrder = previousLanguage.phonology.prosody.maxOrder
        }
        let writingSystems = JSON.parse(JSON.stringify(language.writingSystems))
        for (let transformationIndex in step.transformations) {
          let transformation = step.transformations[transformationIndex]
          checkTransformation(previousLanguage, date, transformation, transformationIndex)
          if (transformation.type === 'SOUND_CHANGE') {
            languageSoundChange(phonotactics, vowelCore, transformation)
          }
          if (transformation.type === 'SOUND_DELETION' && transformation.condition.type === 'DEFAULT') {
            languageSoundDeletion(phonotactics, vowelCore, transformation)
          }
          if (transformation.type === 'SOUND_INSERTION') {
            languageSoundInsertion(phonotactics, vowelCore, transformation)
          }
          if (transformation.type === 'SOUND_MIGRATION') {
            languageSoundMigration(phonotactics, vowelCore, transformation)
          }
          if (transformation.type === 'SOUND_COPY') {
            languageSoundCopy(phonotactics, vowelCore, transformation)
          }
          writingSystems = [] // TODO: Evolve writing systems.
        }
        let newLanguage = {
          name: output[0].name,
          parent: output[0].parent,
          date: date,
          phonology: {
            phonotactics: phonotactics,
            vowelCore: vowelCore,
            prosody: {
              type: prosodyType
            }
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
      let firstWord = phonology.copyWord(word)
      firstWord.languageName = languageArray[0].name
      firstWord.parentLanguageName = languageArray[0].parent
      firstWord.date = languageArray[0].date
      let output = [firstWord]
      for (let stepIndex in steps) {
        let step = steps[stepIndex]
        let previousStepWord = output[stepIndex]
        let previousTransformationWord = phonology.copyWord(previousStepWord)
        let newWord = phonology.copyWord(previousTransformationWord)
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
              newWord = phonology.copyWord(previousTransformationWord)
            } else {
              let previousStepRunCondition = findFollowsFromLastStepCondition(transformation.condition)
              let syllableShift = 0
              if (previousStepRunCondition !== null) {
                syllableShift = previousStepRunCondition.syllableShift
              }
              let shiftedSyllableIndex = parseInt(syllableIndex) + syllableShift
              previousStepRun = false
              newWord = phonology.copyWord(previousTransformationWord)
              if (transformation.type === 'SOUND_CHANGE') {
                soundChange(newWord, stepLanguage, shiftedSyllableIndex, transformation)
              }
              if (transformation.type === 'SOUND_DELETION') {
                soundDeletion(newWord, stepLanguage, shiftedSyllableIndex, transformation)
              }
              if (transformation.type === 'SOUND_INSERTION') {
                soundInsertion(newWord, stepLanguage, shiftedSyllableIndex, transformation)
              }
              if (transformation.type === 'SOUND_MIGRATION') {
                soundMigration(newWord, stepLanguage, shiftedSyllableIndex, transformation)
              }
              if (transformation.type === 'SOUND_COPY') {
                soundCopy(newWord, stepLanguage, shiftedSyllableIndex, transformation)
              }
              if (transformation.type === 'SOUND_SWAP') {
                soundSwap(newWord, stepLanguage, shiftedSyllableIndex, transformation)
              }
              if (transformation.type === 'CONSONANT_DEGEMINATION') {
                consonantDegemination(newWord, stepLanguage, shiftedSyllableIndex, transformation)
              }
              if (transformation.type === 'SYLLABLE_COLLAPSE') {
                syllableCollapse(newWord, stepLanguage, shiftedSyllableIndex, transformation)
                wordLength--
              }
              if (transformation.type === 'SYLLABLE_INSERTION') {
                syllableInsertion(newWord, stepLanguage, shiftedSyllableIndex, transformation)
                wordLength++
              }
              if (transformation.type === 'STRESS_SHIFT') {
                stressShift(newWord, stepLanguage, shiftedSyllableIndex, transformation)
              }
            }
            if (!phonology.isSameWord(previousTransformationWord, newWord)) {
              previousStepRun = true
            }
            newWord.languageName = stepLanguage.name
            newWord.parentLanguageName = stepLanguage.parent
            newWord.date = step.date
            previousTransformationWord = phonology.copyWord(newWord)
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
      }
    }

    // Transformation object:
    // {
    //   type: 'SOUND_CHANGE',
    //   positions: [<int>],
    //   changes: [
    //       {
    //         fromSound: <phoneme string>,
    //         toSound: <phoneme string>
    //       }
    //   ],
    //   condition: <condition>
    // }
    // At the position in the syllable, each sound value in the "fromSounds" array becomes the corresponding sound value in the "toSounds" array.
    function soundChange (word, language, syllableIndex, transformation) {
      for (let position of transformation.positions) {
        let absolutePosition = language.phonology.vowelCore + position
        for (let change of transformation.changes) {
          if (word.syllables[syllableIndex].phonemes[absolutePosition] === change.fromSound) {
            word.syllables[syllableIndex].phonemes[absolutePosition] = change.toSound
          }
        }
      }
    }

    function languageSoundChange (phonotactics, vowelCore, transformation) {
      for (let position of transformation.positions) {
        let absolutePosition = vowelCore + position
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
        for (let position of transformation.positions) {
          validity.verifyValueInPhonotactics(language, change.fromSound, position, transformationLocation + ': Field \'changes\', index ' + changeIndex + ', field \'fromSound\'')
        }
      }

      // condition
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    // Transformation object:
    // {
    //   type: 'SOUND_DELETION',
    //   positions: [<int>],
    //   sounds: [<phoneme string>],
    //   condition: <condition>
    // }
    // Instance of 'SOUND_CHANGE' in which the "toSounds" array is implicit, and are all zero.
    function soundDeletion (word, language, syllableIndex, transformation) {
      for (let position of transformation.positions) {
        let absolutePosition = language.phonology.vowelCore + position
        for (let sound of transformation.sounds) {
          if (word.syllables[syllableIndex].phonemes[absolutePosition] === sound) {
            word.syllables[syllableIndex].phonemes[absolutePosition] = ''
          }
        }
      }
    }

    function languageSoundDeletion (phonotactics, vowelCore, transformation) {
      for (let position of transformation.positions) {
        let absolutePosition = vowelCore + position
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

    // Transformation object:
    // {
    //   type: 'SOUND_INSERTION',
    //   position: <int>,
    //   sound: <phoneme string>,
    //   condition: <condition>
    // }
    // Instance of 'SOUND_CHANGE' in which the "fromSounds" value is zero.
    function soundInsertion (word, language, syllableIndex, transformation) {
      let absolutePosition = language.phonology.vowelCore + transformation.position
      if (word.syllables[syllableIndex].phonemes[absolutePosition] === '') {
        word.syllables[syllableIndex].phonemes[absolutePosition] = transformation.sound
      }
    }

    function languageSoundInsertion (phonotactics, vowelCore, transformation) {
      let absolutePosition = vowelCore + transformation.position
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

    // Transformation object:
    // {
    //   type: 'SOUND_MIGRATION',
    //   migrations: [
    //     {
    //       fromPosition: <int>,
    //       syllableShift: <int>,
    //       toPosition: <int>
    //     }
    //   ],
    //   overwrite: <Boolean>,
    //   condition: <condition>
    // }
    // In each value of the "fromPositions" array, phonemes are migrated into a syllable decided by the corresponding value in the "syllableShift" array, and into the corresponding value in the "toPositions" array, leaving zero in the original place.
    // If the target position is out of bounds of the word, then the migration does not take place.
    function soundMigration (word, language, syllableIndex, transformation) {
      for (let migration of transformation.migrations) {
        let fromSyllableIndex = syllableIndex
        let toSyllableIndex = parseInt(syllableIndex) + parseInt(migration.syllableShift)
        if (toSyllableIndex < word.syllables.length && toSyllableIndex >= 0) {
          let fromPhonemeIndex = language.phonology.vowelCore + migration.fromPosition
          let toPhonemeIndex = language.phonology.vowelCore + migration.toPosition
          if (word.syllables[toSyllableIndex].phonemes[toPhonemeIndex] === '' || transformation.overwrite) {
            word.syllables[toSyllableIndex].phonemes[toPhonemeIndex] = word.syllables[fromSyllableIndex].phonemes[fromPhonemeIndex]
            word.syllables[fromSyllableIndex].phonemes[fromPhonemeIndex] = ''
          }
        }
      }
    }

    function languageSoundMigration (phonotactics, vowelCore, transformation) {
      for (let migration of transformation.migrations) {
        let absoluteFromPosition = vowelCore + migration.fromPosition
        let absoluteToPosition = vowelCore + migration.toPosition
        for (let fromOption of phonotactics[absoluteFromPosition]) {
          if (phonotactics[absoluteToPosition].every((toOption) => toOption.value !== fromOption.value)) {
            phonotactics[absoluteToPosition].push(fromOption)
          }
        }
      }
      if (transformation.condition.type === '' && transformation.overwrite) {
        for (let migration of transformation.migrations) {
          let absoluteFromPosition = vowelCore + migration.fromPosition
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

    // Transformation object:
    // {
    //   type: 'SOUND_COPY',
    //   migrations: [
    //     {
    //       fromPosition: <int>,
    //       syllableShift: <int>,
    //       toPosition: <int>
    //     }
    //   ],
    //   overwrite: <Boolean>,
    //   condition: <condition>
    // }
    // Like "sound migration," except the "fromPosition" sounds are not deleted.
    function soundCopy (word, language, syllableIndex, transformation) {
      for (let migration of transformation.migrations) {
        if (syllableIndex + migration.syllableShift >= 0 && syllableIndex + migration.syllableShift < word.syllables.length) {
          let absoluteFromPosition = language.phonology.vowelCore + migration.fromPosition
          let absoluteToPosition = language.phonology.vowelCore + migration.toPosition
          if (word.syllables[syllableIndex + migration.syllableShift].phonemes[absoluteFromPosition] === '' || transformation.overwrite) {
            word.syllables[syllableIndex + migration.syllableShift].phonemes[absoluteToPosition] = word.syllables[syllableIndex].phonemes[absoluteFromPosition]
          }
        }
      }
    }

    function languageSoundCopy (phonotactics, vowelCore, transformation) {
      for (let migration of transformation.migrations) {
        let absoluteFromPosition = vowelCore + migration.fromPosition
        let absoluteToPosition = vowelCore + migration.toPosition
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

    // Transformation object:
    // {
    //   type: 'SOUND_SWAP',
    //   swap: {
    //     fromPosition: <int>,
    //     syllableShift: <int>,
    //     toPosition: <int>
    //   },
    //   condition: <condition>
    // }
    // Phonemes are swapped.
    function soundSwap (word, language, syllableIndex, transformation) {
      let fromSyllableIndex = syllableIndex
      let toSyllableIndex = parseInt(syllableIndex) + parseInt(transformation.swap.syllableShift)
      if (toSyllableIndex < word.syllables.length && toSyllableIndex >= 0) {
        let fromPhonemeIndex = language.phonology.vowelCore + transformation.swap.fromPosition
        let toPhonemeIndex = language.phonology.vowelCore + transformation.swap.toPosition
        let reservePhoneme = word.syllables[toSyllableIndex].phonemes[toPhonemeIndex]
        word.syllables[toSyllableIndex].phonemes[toPhonemeIndex] = word.syllables[fromSyllableIndex].phonemes[fromPhonemeIndex]
        word.syllables[fromSyllableIndex].phonemes[fromPhonemeIndex] = reservePhoneme
      }
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

    // Transformation object:
    // {
    //   type: 'CONSONANT_DEGEMINATION',
    //   condition: <condition>
    // }
    // If a consonant in the coda position of the given syllable is immediately followed by the same sound value in some initial position in the next syllable, the consonant becomes zero.
    function consonantDegemination (word, language, syllableIndex, transformation) {
      if (syllableIndex !== word.syllables.length - 1) {
        let currentSyllableFinalSoundIndex = word.syllables[syllableIndex].phonemes.length - 1
        while (
          word.syllables[syllableIndex].phonemes[currentSyllableFinalSoundIndex] === '' &&
          currentSyllableFinalSoundIndex >= 0
        ) {
          currentSyllableFinalSoundIndex--
        }
        let nextSyllableInitialSoundIndex = 0
        while (
          syllableIndex < word.syllables.length - 1 &&
          word.syllables[syllableIndex + 1].phonemes[nextSyllableInitialSoundIndex] === '' &&
          nextSyllableInitialSoundIndex < word.syllables[syllableIndex].phonemes.length
        ) {
          nextSyllableInitialSoundIndex++
        }
        if (currentSyllableFinalSoundIndex > language.phonology.vowelCore && nextSyllableInitialSoundIndex < language.phonology.vowelCore) {
          if (
            word.syllables[syllableIndex].phonemes[currentSyllableFinalSoundIndex] ===
            word.syllables[syllableIndex + 1].phonemes[nextSyllableInitialSoundIndex]
          ) {
            word.syllables[syllableIndex].phonemes[currentSyllableFinalSoundIndex] = ''
          }
        }
      }
    }

    function checkConsonantDegemination (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['condition'])
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    // Transformation object:
    // {
    //   type: 'SYLLABLE_COLLAPSE',
    //   position: <int>,
    //   reiterate: <Boolean>,
    //   condition: <condition>
    // }
    // One syllable length of positions is deleted from the word, starting at a given "position" integer value within the syllable (inclusive), and the remaining syllables shifted up.
    // If position is not positive (i.e. not coda), and syllable is word-final, then the entire syllable is deleted.
    function syllableCollapse (word, language, syllableIndex, transformation) {
      if (language.phonology.prosody.type === 'STRESS') {
        if (syllableIndex < word.syllables.length - 1) {
          if (word.syllables[syllableIndex].accent === 0) {
            word.syllables[syllableIndex].accent = word.syllables[syllableIndex + 1].accent
          }
        }
      }
      let absolutePosition = language.phonology.vowelCore + transformation.position
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
      if (word.syllables[word.syllables.length - 1].phonemes.every((phoneme, phonemeIndex) => phonemeIndex < language.phonology.vowelCore || phoneme === '')) {
        word.syllables.splice(-1, 1)
      }
    }

    function checkSyllableCollapse (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['position', 'reiterate', 'condition'])

      // position
      validity.verifyIndexInPhonotactics(language, transformation.position, transformationLocation + ': Field \'position\'')

      // condition
      if (transformation.condition === '') {
        console.error(transformationLocation + ': Transformation of type \'SYLLABLE_COLLAPSE\' has empty \'condition\' property. This is not allowed.')
      }
      if (transformation.reiterate && transformation.condition.type === 'follows from last step') {
        console.error(transformationLocation + ': Transformation of type \'SYLLABLE_COLLAPSE\' has \'reiterate\' set and \'condition\' is merely \'FOLLOWS_FROM_LAST_STEP\'. This is not allowed.')
      }
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

    // Transformation object:
    // {
    //   type: 'SYLLABLE_INSERTION'
    //   phonemes: [<phoneme string>],
    //   condition: <condition>
    // }
    // A new syllable is inserted somewhere in the word, before the current syllable position.
    function syllableInsertion (word, language, syllableIndex, transformation) {
      word.syllables.splice(syllableIndex, 0, { accent: 0, phonemes: transformation.phonemes })
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

    // Transformation object:
    // {
    //   type: 'STRESS_SHIFT',
    //   order: <int>,
    //   shift: <int>,
    //   condition: <condition>
    // }
    // The "stress" index of a certain order of stress (primary, secondary, etc.) is incremented or decremented by a fixed value.
    function stressShift (word, language, syllableIndex, transformation) {
      if (word.syllables[syllableIndex].accent === transformation.order) {
        word.syllables[syllableIndex].accent = 0
        let newSyllableIndex = syllableIndex + transformation.shift
        if (newSyllableIndex < 0) {
          word.syllables[0].accent = transformation.order
        } else if (newSyllableIndex >= word.syllables.length) {
          word.syllables[word.syllables.length - 1].accent = transformation.order
        } else {
          word.syllables[newSyllableIndex].accent = transformation.order
        }
      }
    }

    function checkStressShift (language, transformation, transformationLocation) {
      validity.verifyPropertiesExist(transformation, transformationLocation, ['order', 'shift', 'condition'])

      // order
      if (transformation.order <= 0 || transformation.order > language.phonology.prosody.maxOrder) {
        console.error(transformationLocation + ': Transformation of type \'STRESS_SHIFT\' has \'order\' value out of bounds. Found value: ' + transformation.order)
      }

      // condition
      conditions.checkSyllableCondition(language, transformation.condition, transformationLocation + ': Condition')
    }

  }])
