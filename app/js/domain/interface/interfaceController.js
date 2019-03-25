/* global angular */
angular.module('app').controller('interfaceController', ['interfaceService', '$scope', '$route', '$routeParams',
  function interfaceController (svc, $scope, $route, $routeParams) {
    let ctrl = this

    this.languageName = $routeParams.languageName
    this.retrievingSyngloss = true
    this.retrievingWord = true
    this.retrievingNoun = true
    this.retrievingVerb = true

    this.showSyllables = false

    this.showJson = object => JSON.stringify(object)

    $scope.tab = 1
    $scope.setTab = function (tab) { $scope.tab = tab }
    $scope.isSet = tab => $scope.tab === tab

    this.resetNoun = function () {
      ctrl.getNounPromise = svc.getNoun(
        $routeParams.languageName,
        ctrl.selectedNounGender,
        ctrl.selectedNounClass.name
      )
        .then(initializeNoun)
    }

    this.setGender = function () {
      ctrl.nounGenders = ctrl.selectedNounClass.genders
      ctrl.selectedNounGender = ctrl.nounGenders[0]
      ctrl.nounEndingStartPosition = ctrl.selectedNounClass.endingStartPosition
      ctrl.resetNoun()
    }

    this.outOfStemScope = (syllableIndex, syllablePositionIndex) =>
      (syllableIndex >= ctrl.nounStem.phonology.syllables.length - 1) &&
      (syllablePositionIndex >= ctrl.nounEndingStartPosition + ctrl.syngloss.phonology.syllableCores[0])

    let initalizeWord = function () {
      ctrl.wordMemory = svc.word
      ctrl.wordLength = ctrl.wordMemory.spokenForm.syllables.length
      ctrl.word = JSON.parse(JSON.stringify(ctrl.wordMemory.spokenForm))
      svc.verifyWord(ctrl.word, ctrl.syngloss)
      ctrl.wordMemory.spokenForm.syllables.push(
        JSON.parse(JSON.stringify(ctrl.syngloss.phonology.incrementingSyllable))
      )
      ctrl.wordTree = svc.getWordTree(ctrl.word, ctrl.languageTree)
      ctrl.descendantWords = svc.getDescendantWordsForDate(ctrl.selectedDate, ctrl.wordTree)
      ctrl.retrievingWord = false
    }

    ctrl.getNounForm = function (number, nounCase) {
      if (ctrl.nounForms === undefined) { return null }
      return ctrl.nounForms.filter(
        nounForm => nounForm.number === number && nounForm.case === nounCase
      )[0]
    }

    function addSyllableToStem (stem, stemMemory) {
      let stemLength = ctrl.syngloss.phonology.phonotactics.length
      let finalSyllable = stem.phonology.syllables[stem.phonology.syllables.length - 1]
      let stemTerminus = finalSyllable.phonemes.length
      for (let syllablePosition = stemTerminus; syllablePosition < stemLength; syllablePosition++) {
        finalSyllable.phonemes[syllablePosition] =
        stemMemory.phonology.syllables[stem.phonology.syllables.length - 1].phonemes[syllablePosition]
      }
      let newSyllable = { phonemes: [] }
      for (let syllablePosition = 0; syllablePosition < stemTerminus; syllablePosition++) {
        newSyllable.phonemes[syllablePosition] =
        stemMemory.phonology.syllables[stem.phonology.syllables.length].phonemes[syllablePosition]
      }
      stem.phonology.syllables.push(newSyllable)
    }

    function addSyllableToStemMemory (stemMemory) {
      let stemLength = ctrl.syngloss.phonology.phonotactics.length
      let incrementingSyllable = ctrl.syngloss.phonology.incrementingSyllable
      let finalSyllable = stemMemory.phonology.syllables[stemMemory.phonology.syllables.length - 1]
      let stemTerminus = finalSyllable.phonemes.length
      for (let syllablePosition = stemTerminus; syllablePosition < stemLength; syllablePosition++) {
        finalSyllable.phonemes[syllablePosition] =
        incrementingSyllable.phonemes[syllablePosition]
      }
      let newSyllable = { phonemes: [] }
      for (let syllablePosition = 0; syllablePosition < stemTerminus; syllablePosition++) {
        newSyllable.phonemes[syllablePosition] = incrementingSyllable.phonemes[syllablePosition]
      }
      stemMemory.phonology.syllables.push(newSyllable)
    }

    function removeSyllableFromStem (stem) {
      let stemTerminus = stem.phonology.syllables[stem.phonology.syllables.length - 1].phonemes.length
      stem.phonology.syllables.pop()
      let finalSyllable = stem.phonology.syllables[stem.phonology.syllables.length - 1]
      while (finalSyllable.phonemes.length > stemTerminus) {
        finalSyllable.phonemes.pop()
      }
    }

    function initializeNoun () {
      ctrl.nounStemMemory = svc.noun
      ctrl.nounStemLength = ctrl.nounStemMemory.phonology.syllables.length
      ctrl.nounStem = JSON.parse(JSON.stringify(ctrl.nounStemMemory))
      ctrl.selectedNounClass = ctrl.nounClasses.filter(
        nounClass => nounClass.name === ctrl.nounStem.nounClass
      )[0]
      addSyllableToStemMemory(ctrl.nounStemMemory)
      ctrl.selectedNounGender = ctrl.nounStem.gender
      ctrl.nounEndingStartPosition = ctrl.selectedNounClass.endingStartPosition
      ctrl.setNounForms()
      ctrl.retrievingNoun = false
    }

    this.setNounForms = function () {
      setNounMorphemes()
      ctrl.nounForms = []
      for (let number of ctrl.syngloss.morphology.nominals.numbers) {
        for (let nounCase of ctrl.syngloss.morphology.nominals.cases) {
          ctrl.nounForms.push(
            svc.computeNoun(
              ctrl.nounStem,
              ctrl.nounStem.gender, number, nounCase,
              ctrl.nounMorphemes,
              ctrl.syngloss.phonology.phonotactics
            )
          )
        }
      }
    }

    function setNounMorphemes () {
      ctrl.nounMorphemes = ctrl.syngloss.morphology.nominals.morphemes
        .filter(morpheme => morpheme.categories.some(category =>
          category.classes.indexOf(ctrl.nounStem.nounClass) > -1 &&
          category.genders.indexOf(ctrl.nounStem.gender) > -1
        ))
      let variantClasses = ctrl.syngloss.morphology.nominals.classes
        .filter(nounClass =>
          nounClass.type === 'VARIANT' &&
          nounClass.defaultClass === ctrl.nounStem.nounClass &&
          svc.meetsVariantClassCondition(ctrl.nounStem.phonology, nounClass)
        )
      let variantNounMorphemes = ctrl.syngloss.morphology.nominals.morphemes
        .filter(morpheme => morpheme.categories.some(category =>
          variantClasses.some(variantClass =>
            category.classes.indexOf(variantClass.name) > -1
          ) &&
          category.genders.indexOf(ctrl.nounStem.gender) > -1
        ))
      ctrl.nounMorphemes = ctrl.nounMorphemes.filter(nounMorpheme =>
        nounMorpheme.categories.some(nounMorphemeCategory =>
          nounMorphemeCategory.numbers.some(number => nounMorphemeCategory.cases.some(nounCase =>
            variantNounMorphemes.every(variantNounMorpheme =>
              variantNounMorpheme.categories.every(variantNounMorphemeCategory =>
                variantNounMorphemeCategory.numbers.indexOf(number) === -1 ||
                variantNounMorphemeCategory.cases.indexOf(nounCase) === -1
              )
            )
          ))
        )
      ).concat(variantNounMorphemes)
    }

    function initializeController () {
      ctrl.retrievingSyngloss = false
      ctrl.syngloss = svc.syngloss

      for (let position of ctrl.syngloss.phonology.phonotactics) {
        for (let option of position) {
          option.presentation = svc.present(option.value)
        }
      }

      ctrl.languageTree = svc.getLanguageTree(ctrl.syngloss)
      ctrl.earliestDate = ctrl.syngloss.date
      ctrl.latestDate = svc.getLatestDate(ctrl.syngloss)
      ctrl.selectedDate = ctrl.latestDate
      ctrl.displayDate = ctrl.selectedDate < 0 ? -ctrl.selectedDate + ' BCE' : ctrl.selectedDate + ' CE'

      ctrl.getWordPromise = svc.getWord($routeParams.languageName)
        .then(initalizeWord)

      ctrl.nounClasses = ctrl.syngloss.morphology.nominals.classes
        .filter(nounClass => nounClass.type === 'DEFAULT')
      ctrl.selectedNounClass = ctrl.nounClasses[0]
      ctrl.setGender()
    }

    this.getSynglossPromise = svc.getSyngloss($routeParams.languageName)
      .then(initializeController)

    this.updateDate = function () {
      if (ctrl.selectedDate < 0) {
        ctrl.displayDate = -ctrl.selectedDate + ' BCE'
      } else {
        ctrl.displayDate = ctrl.selectedDate + ' CE'
      }
      ctrl.descendantWords = svc.getDescendantWordsForDate(ctrl.selectedDate, ctrl.wordTree)
    }

    this.write = (word, language, writingSystemName, field) => field in ctrl && word !== undefined
      ? svc.write(word, language, writingSystemName)
      : null

    function getWordTree () {
      ctrl.wordTree = svc.getWordTree(ctrl.word, ctrl.languageTree)
    }

    this.tableHeader = (syllablePositionIndex) => syllablePositionIndex - ctrl.syngloss.phonology.syllableCores[0]

    this.restressWord = function () {
      ctrl.word = svc.restress(ctrl.word)
    }

    this.updateWord = function () {
      ctrl.restressWord()
      for (let syllableIndex in ctrl.word.syllables) {
        ctrl.wordMemory.spokenForm.syllables[syllableIndex] =
          JSON.parse(JSON.stringify(ctrl.word.syllables[syllableIndex]))
      }
      getWordTree()
      ctrl.updateDate()
    }

    this.updateNounRoot = function () {
      for (let syllableIndex in ctrl.nounStem.phonology.syllables) {
        let syllable = ctrl.nounStem.phonology.syllables[syllableIndex]
        for (let phonemeIndex in syllable.phonemes) {
          ctrl.nounStemMemory.phonology.syllables[syllableIndex].phonemes[phonemeIndex] =
          syllable.phonemes[phonemeIndex]
        }
      }
      ctrl.setNounForms()
    }

    this.incrementWord = function () {
      ctrl.wordLength++
      changeWordLength()
      ctrl.updateWord()
    }

    this.incrementNounRoot = function () {
      ctrl.nounStemLength++
      changeNounRootLength()
      ctrl.updateNounRoot()
    }

    this.decrementWord = function () {
      ctrl.wordLength--
      changeWordLength()
      ctrl.updateWord()
    }

    this.decrementNounRoot = function () {
      ctrl.nounStemLength--
      changeNounRootLength()
      ctrl.updateNounRoot()
    }

    this.incrementedWordInvalid = function () {
      if ('word' in ctrl) {
        return !svc.testAlterationValidity(ctrl.word, {
          type: 'SYLLABLE_INCREMENT',
          newSyllable: ctrl.wordMemory.spokenForm.syllables[ctrl.wordLength]
        })
      }
      return true
    }

    this.incrementedNounRootInvalid = () => !('nounStem' in ctrl)

    this.decrementedWordInvalid = function () {
      if ('word' in ctrl) {
        return !svc.testAlterationValidity(ctrl.word, { type: 'SYLLABLE_DECREMENT' })
      }
      return true
    }

    this.decrementedNounRootInvalid = function () {
      if ('nounStem' in ctrl) {
        return ctrl.nounStem.phonology.syllables.length <= 1
      }
      return true
    }

    function changeWordLength () {
      while (ctrl.wordMemory.spokenForm.syllables.length <= ctrl.wordLength) {
        ctrl.wordMemory.spokenForm.syllables.push(
          JSON.parse(JSON.stringify(ctrl.syngloss.phonology.incrementingSyllable))
        )
      }
      while (ctrl.word.syllables.length < ctrl.wordLength) {
        ctrl.word.syllables.push(
          ctrl.wordMemory.spokenForm.syllables[ctrl.word.syllables.length]
        )
        if (
          ctrl.syngloss.phonology.prosody.stressType === 'ABSOLUTE' ||
          ctrl.syngloss.phonology.prosody.stressType === 'CONDITIONAL'
        ) {
          ctrl.word = svc.restress(ctrl.word)
        }
      }
      while (ctrl.word.syllables.length > ctrl.wordLength) {
        ctrl.word.syllables.pop()
      }
    }

    function changeNounRootLength () {
      while (ctrl.nounStemMemory.phonology.syllables.length <= ctrl.nounStemLength) {
        addSyllableToStemMemory(ctrl.nounStemMemory)
      }
      while (ctrl.nounStem.phonology.syllables.length < ctrl.nounStemLength) {
        addSyllableToStem(ctrl.nounStem, ctrl.nounStemMemory)
      }
      while (ctrl.nounStem.phonology.syllables.length > ctrl.nounStemLength) {
        removeSyllableFromStem(ctrl.nounStem)
      }
    }

    this.display = name => ((name === undefined) ? '' : name.replace('_', ' '))
    this.getCardinal = number => svc.getCardinal(number)
  }])
// Attempt to fix the issue with the slider initalizing at 100 instead of the maximum value:
// .directive('range', function () {
//   return {
//     replace: true,
//     restrict: 'E',
//     scope: {
//       value: '=ngModel',
//       min: '=rangeMin',
//       max: '=rangeMax',
//       step: '=rangeStep'
//     },
//     template: '<input type="range"/>',
//     link: function (scope, iElement, iAttrs) {
//       scope.$watch('min', function () { setValue() })
//       scope.$watch('max', function () { setValue() })
//       scope.$watch('step', function () { setValue() })
//       scope.$watch('value', function () { setValue() })
//
//       function setValue () {
//         if (
//           angular.isDefined(scope.min) &&
//           angular.isDefined(scope.max) &&
//           angular.isDefined(scope.step) &&
//           angular.isDefined(scope.value)
//         ) {
//           iElement.attr('min', scope.min)
//           iElement.attr('max', scope.max)
//           iElement.attr('step', scope.step)
//           iElement.val(scope.value)
//         }
//       }
//       function read () {
//         scope.value = iElement.val()
//       }
//
//       iElement.on('change', function () {
//         scope.$apply(read)
//       })
//     }
//   }
// })
