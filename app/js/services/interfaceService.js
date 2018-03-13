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
          'name', 'date', 'phonology', 'validity', 'writingSystems', 'descendantLanguages'
        ])
        validity.verifyPropertiesExist(syngloss.phonology, 'Parent language phonology', ['phonotactics', 'vowelCore', 'prosody'])
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
          checkDescendantLanguage(descendantLanguage, 'Parent language: Descendant language ' + descendantLanguageIndex)
        }
      }

      function checkDescendantLanguage (language, languageLocation) {
        validity.verifyPropertiesExist(language, languageLocation, ['name', 'evolution', 'descendantLanguages'])
        for (let stepIndex in language.evolution) {
          let step = language.evolution[stepIndex]
          validity.verifyPropertiesExist(
            step, languageLocation + ': Evolution: Step ' + stepIndex, ['date', 'transformations']
          )
          validity.verifyNonemptyArray(step.transformations, languageLocation + ': Evolution: Step ' + stepIndex + ': Transformations')
        }
        for (let descendantLanguageIndex in language.descendantLanguages) {
          let descendantLanguage = language.descendantLanguages[descendantLanguageIndex]
          checkDescendantLanguage(descendantLanguage, languageLocation + ': descendantLanguage ' + descendantLanguageIndex)
        }
      }

      function determineStressType (language, order) {
        let validityCondition = language.validity
        if (validityCondition.type === 'AND') {
          if (validityCondition.conditions.some((condition) =>
            condition.type === 'STRESSED' &&
            condition.order === order &&
            condition.syllablePositionType === 'ABSOLUTE'
          )) {
            return 'ABSOLUTE'
          }
          if (validityCondition.conditions.some((condition) =>
            condition.type === 'STRESS_PARADIGM' &&
            condition.order === order &&
            condition.positions[condition.positions.length - 1].condition.type === 'DEFAULT'
          ) && validityCondition.conditions.some((condition) =>
            condition.type === 'STRESS_EXISTENCE' &&
            order in condition.orders
          ) && validityCondition.conditions.some((condition) =>
            condition.type === 'STRESS_UNIQUENESS' &&
            order in condition.orders
          )) {
            return 'CONDITIONAL'
          }

          console.log('Stress type is neither ABSOLUTE nor CONDITIONAL. It must be ARBITRARY.')
          console.log('Order: ' + order)

          let stressExistenceConditionOrders = validityCondition.conditions[5].orders
          console.log('stressExistenceConditionOrders: ' + JSON.stringify(stressExistenceConditionOrders))
          console.log('Condition contains order? ' + (stressExistenceConditionOrders.includes(order)))

          let stressUniquenessConditionOrders = validityCondition.conditions[6].orders
          console.log('stressUniquenessConditionOrders: ' + JSON.stringify(stressUniquenessConditionOrders))
          console.log('Condition contains order? ' + (stressUniquenessConditionOrders.includes(order)))

          console.log('1 in [1]? ' + (1 in [1]))
          console.log('[1].includes(1)? ' + [1].includes(1))

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
            wordArray: getWordDescendants(word, descendantLanguage.languageArray, descendantLanguage.evolution)
          }
          let wordObjectArray = wordObject.wordArray
          wordObject.daughterWords = svc.getWordTree(wordObjectArray[wordObjectArray.length - 1], descendantLanguage.descendantLanguages)
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
          let wordIndex = wordSubTree.wordArray.length - 1
          if (date <= wordSubTree.wordArray[wordIndex].date) {
            while (date < wordSubTree.wordArray[wordIndex].date) {
              wordIndex--
            }
            descendantWords.push(wordSubTree.wordArray[wordIndex])
          } else {
            collectDescendantWords(date, wordSubTree.daughterWords, descendantWords)
          }
        }
      }

      let getWordDescendants = (word, languageArray, steps) =>
        evolution.generate(word, languageArray, steps)

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

      // TODO Temporarily hard-coded. Should be generated randomly within the language's validity rules as applied to the input word.
      this.getRandomSyllable = (word) => ({ accent: 0, phonemes: ['', '', 'l', 'a', '', '', ''] })

      this.getCardinal = (number) => Array.from({length: number}, (object, index) => index)

      // TODO Temporarily hard-coded. Should be accessed from database at random using an $http GET method.
      this.getWord = () => ({
        syllables: [
          { accent: 0, phonemes: ['h', '', '', 'i', '', '', ''] },
          { accent: 0, phonemes: ['', '', '', '\u025b', '', '', ''] },
          { accent: 1, phonemes: ['', '', 'r', 'o\u02d0', '', '', ''] },
          { accent: 0, phonemes: ['', '', 'n', '\u026a', '', '', ''] },
          { accent: 0, phonemes: ['', '', 'm', '\u028a', '\u0303', '', ''] }
        ]
      })

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
    }])
