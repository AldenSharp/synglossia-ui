angular.module('app').service('interfaceService',
  ['evolutionService', 'writingService', 'conditionsService', 'phonologyService', 'arrayService', 'validityService', '$http',
    function (evolution, writing, conditions, phonology, array, validity, $http) {
      let svc = this

      this.getSyngloss = languageName =>
        $http.get("https://c1hj6zyvol.execute-api.us-east-1.amazonaws.com/prod/syngloss/" + languageName)
        .then((httpResponse) => initializeSyngloss(httpResponse))

      let initializeSyngloss = function (httpResponse) {
        svc.syngloss = httpResponse.data
        checkSyngloss(svc.syngloss)
        if (svc.syngloss.phonology.prosody.type === 'STRESS') {
          svc.syngloss.phonology.prosody.stressType = []
          for (let orderIndex = 0; orderIndex < svc.syngloss.phonology.prosody.maxOrder; orderIndex++) {
            svc.syngloss.phonology.prosody.stressType[orderIndex] = determineStressType(svc.syngloss, orderIndex + 1)
          }
        }
        svc.syngloss.phonology.phonotactics.forEach((phonemePlace, phonemeIndex) =>
          phonemePlace.forEach(function (option) {
            option.invalid = (word, syllableIndex) => !svc.testAlterationValidity(word, {
              type: 'NEW_PHONEME',
              syllableIndex: syllableIndex,
              phonemeIndex: phonemeIndex,
              value: option.value
            })
          })
        )
      }

      function checkSyngloss (syngloss) {
        validity.verifyNotNull(syngloss, 'Syngloss')
        validity.verifyPropertiesExist(syngloss, 'Syngloss', [
          'name', 'date', 'phonology', 'morphology', 'validity', 'writingSystems', 'descendantLanguages'
        ])
        validity.verifyPropertiesExist(syngloss.phonology, 'Parent language phonology', ['phonotactics', 'incrementingSyllable', 'syllableCores', 'prosody'])
        for (let phonemePositionIndex in syngloss.phonology.phonotactics) {
          let phonemePosition = syngloss.phonology.phonotactics[phonemePositionIndex]
          validity.verifyNonemptyArray(phonemePosition, 'Parent language phonotactics: ' + phonemePositionIndex)
          for (let optionIndex in phonemePosition) {
            let option = phonemePosition[optionIndex]
            validity.verifyPropertiesExist(option,
              'Parent language phonotactics: Index ' + phonemePositionIndex + ': Index ' + optionIndex,
              ['value']
            )
          }
        }

        if (syngloss.phonology.syllableCores.length < 1) {
          console.error('Parent language syllable cores: size of list is less than one. There must be at least one syllable core.')
        }
        for (syllableCoreIndex in syngloss.phonology.syllableCores) {
          syllableCoreIndex = parseInt(syllableCoreIndex)
          let syllableCore = syngloss.phonology.syllableCores[syllableCoreIndex]
          if (syngloss.phonology.syllableCores.indexOf(syllableCore) !== syllableCoreIndex) {
            console.error('Parent language syllable cores: values are not unique.')
          }
          validity.verifyIndexInPhonotactics(syngloss, syllableCore, 'Parent language syllable core at index ' + syllableCoreIndex)
        }

        validity.verifyPropertiesExist(syngloss.phonology.incrementingSyllable, 'Parent language incrementing syllable', ['accent', 'phonemes'])
        if (syngloss.phonology.incrementingSyllable.phonemes.length !== syngloss.phonology.phonotactics.length) {
          console.error('Parent language incrementing syllable: length is not equal to length of the phonotactics.')
        }
        for (let phonemeIndex in syngloss.phonology.incrementingSyllable.phonemes) {
          phonemeIndex = parseInt(phonemeIndex)
          let phoneme = syngloss.phonology.incrementingSyllable.phonemes[phonemeIndex]
          validity.verifyValueInPhonotactics(syngloss, phoneme, phonemeIndex - syngloss.phonology.syllableCores[0], 'Parent language incrementing syllable')
        }

        validity.verifyPropertiesExist(syngloss.phonology.prosody, 'Parent language prosody', ['type'])
        if (syngloss.phonology.prosody.type === 'STRESS') {
          validity.verifyPositive(syngloss.phonology.prosody.maxOrder, 'Parent language prosody max order')
        }
        conditions.checkSyllableCondition(syngloss, syngloss.validity, 'Parent language validity')

        for (let writingSystemIndex in syngloss.writingSystems) {
          let writingSystem = syngloss.writingSystems[writingSystemIndex]
          validity.verifyPropertiesExist(
            writingSystem,
            'Parent language writing system ' + writingSystemIndex,
            ['name', 'type']
          )
          if (writingSystem.type === 'ALPHABET') {
            validity.verifyPropertiesExist(
              writingSystem,
              'Parent language ALPHABET writing system ' + writingSystemIndex,
              ['rules']
            )
            for (let ruleIndex in writingSystem.rules) {
              let rule = writingSystem.rules[ruleIndex]
              validity.verifyPropertiesExist(
                rule,
                'Parent language writing system ' + writingSystemIndex + ': Rule ' + ruleIndex,
                ['sounds', 'graphemes']
              )
              validity.verifyNonemptyArray(rule.sounds, 'Parent language writing system ' + writingSystemIndex + ': Rule ' + ruleIndex + ': Sounds')
              for (let soundIndex in rule.sounds) {
                let sound = rule.sounds[soundIndex]
                validity.verifyValueSomewhereInPhonotactics(
                  syngloss, sound,
                  'Parent language writing system ' + writingSystemIndex +
                  ': Rule ' + ruleIndex + ': Sound ' + soundIndex
                )
              }
              validity.verifyNonemptyArray(
                rule.graphemes,
                'Parent language writing system ' + writingSystemIndex +
                ': Rule ' + ruleIndex + ': Graphemes'
              )
              for (let graphemeIndex in rule.graphemes) {
                let grapheme = rule.graphemes[graphemeIndex]
                validity.verifyPropertiesExist(
                  grapheme,
                  'Parent language writing system ' + writingSystemIndex +
                  ': Rule ' + ruleIndex + ': Grapheme ' + graphemeIndex,
                  ['value', 'condition']
                )
                conditions.checkCondition(
                  syngloss, grapheme.condition,
                  'Parent language writing system ' + writingSystemIndex +
                  ': Rule ' + ruleIndex + ': Grapheme ' + graphemeIndex
                )
              }
            }
          }
        }
        validity.verifyNonemptyArray(
          syngloss.descendantLanguages, 'Parent language: Descendant languages'
        )
        for (let descendantLanguageIndex in syngloss.descendantLanguages) {
          let descendantLanguage = syngloss.descendantLanguages[descendantLanguageIndex]
          checkDescendantLanguage(descendantLanguage, syngloss, 'Parent language: Descendant language ' + descendantLanguageIndex)
        }
      }

      function checkDescendantLanguage (language, parentLanguage, languageLocation) {
        validity.verifyPropertiesExist(language, languageLocation, ['name', 'evolution', 'descendantLanguages'])
        for (let stepIndex in language.evolution) {
          let step = language.evolution[stepIndex]
          validity.verifyPropertiesExist(
            step, languageLocation + ': Evolution: Step ' + stepIndex, ['date', 'transformations']
          )
          validity.verifyNonemptyArray(step.transformations, languageLocation + ': Evolution: Step ' + stepIndex + ': Transformations')
        }
        checkDates(parentLanguage, language)
        for (let descendantLanguageIndex in language.descendantLanguages) {
          let descendantLanguage = language.descendantLanguages[descendantLanguageIndex]
          checkDescendantLanguage(descendantLanguage, language, languageLocation + ': descendantLanguage ' + descendantLanguageIndex)
        }
      }

      function checkDates (parentLanguage, descendantLanguage) {
        let evolution = descendantLanguage.evolution
        for (let stepIndex in evolution) {
          stepIndex = parseInt(stepIndex)
          if (stepIndex === 0) {
            if (evolution[stepIndex].date <= parentLanguage.date) {
              console.error(descendantLanguage.name + ': First evolution step is dated out of order with the date of the parent language ' + parentLanguage.name)
            }
          } else {
            if (evolution[stepIndex].date <= evolution[stepIndex-1].date) {
              console.error(descendantLanguage.name + ': Evolution steps ' + (stepIndex-1) + ' and ' + stepIndex + ' are dated out of order.')
            }
          }
        }
        if (evolution.length > 0) {
          if (evolution[evolution.length-1].date > descendantLanguage.date) {
            console.error(descendantLanguage.name + ': Last evolution step is dated out of order with the descenant language\'s own date.')
          }
        }
      }

      function determineStressType (language, order) {
        let validityCondition = language.validity
        if (validityCondition.type === 'AND') {
          if (validityCondition.conditions.some((condition) =>
            condition.type === 'STRESSED' &&
            condition.order === order &&
            condition.syllablePositionAbsolute
          )) {
            return 'ABSOLUTE'
          }
          if (validityCondition.conditions.some((condition) =>
            condition.type === 'STRESS_PARADIGM' &&
            condition.order === order &&
            condition.positions[condition.positions.length - 1].condition.type === 'DEFAULT'
          ) && validityCondition.conditions.some((condition) =>
            condition.type === 'STRESS_EXISTENCE' &&
            condition.orders.includes(order)
          ) && validityCondition.conditions.some((condition) =>
            condition.type === 'STRESS_UNIQUENESS' &&
            condition.orders.includes(order)
          )) {
            return 'CONDITIONAL'
          }
          return 'ARBITRARY'
        }
        return 'ARBITRARY'
      }

      /*
          This function takes the word, and then some alteration object.
          This alteration object can be any of the following:
          {
            type: 'NEW_PHONEME',
            syllableIndex: <int>,
            phonemeIndex: <int>,
            value: <sound array>
          }
          {
            type: 'SYLLABLE_INCREMENT'
            newSyllable: <Syllable>
          }
          {
            type: 'SYLLABLE_DECREMENT'
          }
      */
      this.testAlterationValidity = function (word, alteration) {
        let testWord = phonology.copyWord(word)
        if (alteration.type === 'NEW_PHONEME') {
          testWord.syllables[alteration.syllableIndex].phonemes[alteration.phonemeIndex] = alteration.value
          testWord = svc.restress(testWord)
          return svc.isValid(testWord)
        }
        if (alteration.type === 'SYLLABLE_INCREMENT') {
          testWord.syllables.push(alteration.newSyllable)
          testWord = svc.restress(testWord)
          return svc.isValid(testWord)
        }
        if (alteration.type === 'SYLLABLE_DECREMENT') {
          if (word.syllables.length === 1) {
            return false
          }
          testWord.syllables = testWord.syllables.slice(0, testWord.syllables.length - 1)
          testWord = svc.restress(testWord)
          return svc.isValid(testWord)
        }
      }

      this.restress = function (word) {
        if (
          svc.syngloss.phonology.prosody.type !== 'STRESS' ||
          svc.syngloss.phonology.prosody.stressType.some((orderStressType) =>
            orderStressType !== 'ABSOLUTE' && orderStressType !== 'CONDITIONAL'
          )) {
          return word
        }
        let stressRules = parentLanguageStressRules()
        let stressPermutationWords = getAllPossibleStress(word, stressRules)
        let validStressPermutationWords = []
        for (let stressPermutationWord of stressPermutationWords) {
          if (
            conditions.meetsSyllableCondition(svc.syngloss, stressPermutationWord, 0, {
              type: 'AND',
              conditions: stressRules
            }, false)
          ) {
            validStressPermutationWords.push(stressPermutationWord)
          }
        }
        if (validStressPermutationWords.length === 0) {
          console.error('Restress function returned no stress-valid words for word: ' + JSON.stringify(word))
          return word
        }
        if (validStressPermutationWords.length > 1) {
          console.error('Restress function returned multiple valid restressings, despite having presupposed determinate stress rules: ' + JSON.stringify(validStressPermutationWords))
          return word
        }
        return validStressPermutationWords[0]
      }

      this.getLanguageTree = function (language) {
        let output = []
        for (let descendantLanguage of language.descendantLanguages) {
          let descendantLanguageArray = evolution.generateLanguageArray(language, descendantLanguage)
          let descendantLanguageBranch = {
            name: descendantLanguage.name,
            evolution: descendantLanguage.evolution,
            languageArray: descendantLanguageArray
          }
          let lastArrayLanguage = descendantLanguageArray[descendantLanguageArray.length - 1]
          descendantLanguage.phonology = JSON.parse(JSON.stringify(lastArrayLanguage.phonology))
          descendantLanguage.writingSystems = JSON.parse(JSON.stringify(lastArrayLanguage.writingSystems))
          descendantLanguageBranch.descendantLanguages = svc.getLanguageTree(descendantLanguage)
          output.push(descendantLanguageBranch)
        }
        return output
      }

      this.getWordTree = function (word, languageTree) {
        let output = []
        for (let descendantLanguage of languageTree) {
          let wordObject = {
            name: descendantLanguage.name,
            wordArray: evolution.generate(word, descendantLanguage.languageArray, descendantLanguage.evolution)
          }
          let wordObjectArray = wordObject.wordArray
          wordObject.descendantWords = svc.getWordTree(wordObjectArray[wordObjectArray.length - 1], descendantLanguage.descendantLanguages)
          output.push(wordObject)
        }
        return output
      }

      this.getDescendantWordsForDate = function (date, wordTree) {
        let descendantWords = []
        collectDescendantWords(date, wordTree, descendantWords)
        return descendantWords
      }

      function collectDescendantWords (date, wordTree, descendantWords) {
        for (let wordSubTree of wordTree) {
          if (currentLanguage(date, wordSubTree)) {
            let wordIndex = wordSubTree.wordArray.length - 1
            while (date < wordSubTree.wordArray[wordIndex].date) { wordIndex-- }
            descendantWords.push(wordSubTree.wordArray[wordIndex])
          } else {
            collectDescendantWords(date, wordSubTree.descendantWords, descendantWords)
          }
        }
      }

      let currentLanguage = (date, wordTree) =>
        wordTree.descendantWords.every(
          (wordSubTree) => wordSubTree.wordArray[0].date > date
        )

      function parentLanguageStressRules () {
        let validity = svc.syngloss.validity
        if (validity.type !== 'AND') {
          return []
        }
        return validity.conditions.filter((condition) =>
            condition.type === 'STRESS_EXISTENCE' ||
            condition.type === 'STRESS_UNIQUENESS' ||
            condition.type === 'STRESS_PARADIGM'
          )
      }

      function getAllPossibleStress (word, stressRules) {
        let zeroStressWord = svc.copyWord(word)
        for (let syllableIndex in zeroStressWord.syllables) {
          zeroStressWord.syllables[syllableIndex].accent = 0
        }
        let stressPermutationWords = [zeroStressWord]
        for (let orderIndex = 1; orderIndex <= svc.syngloss.phonology.prosody.maxOrder; orderIndex++) {
          let stressPermutationWordsLength = stressPermutationWords.length
          for (let stressPermutationWordIndex = 0; stressPermutationWordIndex < stressPermutationWordsLength; stressPermutationWordIndex++) {
            let stressPermutationWord = stressPermutationWords[stressPermutationWordIndex]
            if (stressRules.some((rule) => rule.type === 'STRESS_UNIQUENESS' && rule.orders.some((order) => order === orderIndex))) {
              for (let syllableIndex = 0; syllableIndex < word.syllables.length; syllableIndex++) {
                if (stressPermutationWord.syllables[syllableIndex].accent === 0) {
                  let accentedWord = svc.copyWord(stressPermutationWord)
                  accentedWord.syllables[syllableIndex].accent = orderIndex
                  stressPermutationWords.push(accentedWord)
                }
              }
            } else {
              for (let permutationIndex = 1; permutationIndex < Math.pow(2, stressPermutationWord.syllables.filter((syllable) => syllable.accent === 0).length); permutationIndex++) {
                let accentedWord = svc.copyWord(stressPermutationWord)
                let accentCode = permutationIndex
                let accentArray = []
                while (accentCode > 0) {
                  accentArray.push(accentCode % 2)
                  accentCode = Math.floor(accentCode / 2)
                }
                let accentArrayIndex = 0
                for (let accentedWordSyllableIndex = 0; accentedWordSyllableIndex < accentedWord.syllables.length; accentedWordSyllableIndex++) {
                  if (accentedWord.syllables[accentedWordSyllableIndex].accent === 0) {
                    accentedWord.syllables[accentedWordSyllableIndex].accent = accentArray[accentArrayIndex] * orderIndex
                    accentArrayIndex++
                  }
                }
                stressPermutationWords.push(accentedWord)
              }
            }
            if (stressRules.some((rule) => rule.type === 'STRESS_EXISTENCE' && rule.orders.some((order) => order === orderIndex))) {
              delete stressPermutationWords[stressPermutationWordIndex]
            }
          }
          stressPermutationWords = stressPermutationWords.filter((stressPermutationWord) => stressPermutationWord)
        }
        return stressPermutationWords
      }

      this.isValid = word => word.syllables.every(
        (syllable, syllableIndex) => conditions.meetsSyllableCondition(
          svc.syngloss, word, syllableIndex, svc.syngloss.validity
        )
      )

      this.getCardinal = (number) => Array.from({length: number}, (object, index) => index)

      this.getWord = languageName =>
        $http.get("https://c1hj6zyvol.execute-api.us-east-1.amazonaws.com/prod/syngloss/" + languageName + "/word")
        .then((httpResponse) => svc.word = httpResponse.data)

      this.getNoun = languageName =>
        $http.get("https://c1hj6zyvol.execute-api.us-east-1.amazonaws.com/prod/syngloss/" + languageName + "/noun")
        .then(httpResponse => svc.noun = httpResponse.data)

      this.verifyWord = function (word, language) {
        validity.verifyNotNull(word, 'Word')
        validity.verifyPropertiesExist(word, 'Word', ['syllables'])
        validity.verifyNonemptyArray(word.syllables, 'Word: Syllables')
        for (let syllableIndex in word.syllables) {
          let syllable = word.syllables[syllableIndex]
          validity.verifyPropertiesExist(syllable, 'Word: Syllable ' + syllableIndex, ['accent', 'phonemes'])
          if (language.phonology.prosody.type === 'STRESS') {
            if (syllable.accent < 0 || syllable.accent > language.phonology.prosody.maxOrder) {
              console.error(
                'Word: Syllable ' + syllableIndex + ': Accent value out of bounds. ' +
                'Value must be between 0 and ' + language.phonology.prosody.maxOrder +
                ', but found: ' + syllable.accent
              )
            }
          }
          if (syllable.phonemes.length !== language.phonology.phonotactics.length) {
            console.error(
              'Word: Syllable ' + syllableIndex + ': Phoneme array is the incorrect length. ' +
              'Length must be ' + language.phonology.phonotactics.length + ', but found: ' + syllable.phonemes.length
            )
          }
          for (let phonemeIndex in syllable.phonemes) {
            let phoneme = syllable.phonemes[phonemeIndex]
            if (language.phonology.phonotactics[phonemeIndex].every((option) => option.value !== phoneme)) {
              console.error(
                'Word: Syllable ' + syllableIndex + ': Phoneme ' + phonemeIndex +
                ': Value is not found in the language phonotactics options at that index.'
              )
            }
          }
        }
      }

      this.getWordEvolutions = function (word) {
        let wordEvolutions = []
        for (let descendantLanguage of svc.syngloss.descendantLanguages) {
          wordEvolutions.push({
            languageName: descendantLanguage.name,
            evolution: evolution.generate(word, descendantLanguage.evolution)
          })
        }
        return wordEvolutions
      }

      this.getLatestDate = function (languageTree, earliestDate) {
        let latestDate = earliestDate
        for (let languageBranch of languageTree) {
          let latestLanguage = languageBranch.evolution[languageBranch.evolution.length - 1]
          let languageArrayLatestDate = latestLanguage.date
          if (languageArrayLatestDate > latestDate) {
            latestDate = languageArrayLatestDate
          }
          latestDate = svc.getLatestDate(languageBranch.descendantLanguages, latestDate)
        }
        return latestDate
      }

      this.write = (word, language, writingSystemName) => writing.write(word, language, writingSystemName)

      this.present = (code) => phonology.presentIPA(code)

      this.copyWord = (word) => phonology.copyWord(word)
      this.copySyllable = (syllable) => phonology.copySyllable(syllable)
    }])
