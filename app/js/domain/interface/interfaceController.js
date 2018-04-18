angular.module('app').controller('interfaceController', ['interfaceService', '$scope', '$route', '$routeParams',
  function interfaceController (svc, $scope, $route, $routeParams) {
    let ctrl = this

    $scope.tab = 1
    $scope.setTab = tab => $scope.tab = tab
    $scope.isSet = tab => $scope.tab === tab

    let initializeController = function() {
      ctrl.syngloss = svc.syngloss

      for (let position of ctrl.syngloss.phonology.phonotactics) {
        for (let option of position) {
          option.presentation = svc.present(option.value)
        }
      }

      ctrl.languageTree = svc.getLanguageTree(ctrl.syngloss)
      ctrl.earliestDate = ctrl.syngloss.date
      ctrl.latestDate = svc.getLatestDate(ctrl.languageTree, ctrl.earliestDate)
      ctrl.selectedDate = ctrl.latestDate
      ctrl.displayDate = ctrl.selectedDate < 0 ? -ctrl.selectedDate + ' BCE' : ctrl.selectedDate + ' CE'

      ctrl.wordMemory = svc.getWord()
      ctrl.wordLength = ctrl.wordMemory.syllables.length
      ctrl.word = svc.copyWord(ctrl.wordMemory)
      svc.verifyWord(ctrl.word, ctrl.syngloss)
      ctrl.wordMemory.syllables.push(svc.getRandomSyllable())

      ctrl.wordTree = svc.getWordTree(ctrl.word, ctrl.languageTree)
      ctrl.descendantWords = svc.getDescendantWordsForDate(ctrl.selectedDate, ctrl.wordTree)

      console.log('Syngloss: ' + JSON.stringify(ctrl.syngloss))
      ctrl.nounStem = [
        ['', '', 'm', 'e\u02d0', 'n', '', ''],
        ['s', '']
      ]
      ctrl.nounClasses = ctrl.syngloss.morphology.nominals.classes
        .filter((nounClass) => nounClass.type === 'DEFAULT')
      ctrl.selectedNounClass = ctrl.nounClasses[0]
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

    this.write = (word, language, writingSystemName) => 'word' in ctrl ?
      svc.write(word, language, writingSystemName)
      : null

    function getWordTree () {
      ctrl.wordTree = svc.getWordTree(ctrl.word, ctrl.languageTree)
    }

    this.tableHeader = (syllablePositionIndex) => syllablePositionIndex - ctrl.syngloss.phonology.vowelCore

    this.restressWord = function () {
      ctrl.word = svc.restress(ctrl.word)
    }

    this.updateWord = function () {
      ctrl.restressWord()
      getWordTree()
      ctrl.updateDate()
    }

    this.incrementWord = function () {
      ctrl.wordLength++
      changeWordLength()
      ctrl.updateWord()
    }

    this.decrementWord = function () {
      ctrl.wordLength--
      changeWordLength()
      ctrl.updateWord()
    }

    this.incrementedWordInvalid = function () {
      if ('word' in ctrl) {
        return !svc.testAlterationValidity(ctrl.word, {
          type: 'SYLLABLE_INCREMENT',
          newSyllable: ctrl.wordMemory.syllables[ctrl.wordLength]
        })
      }
      return true
    }

    this.decrementedWordInvalid = function () {
      if ('word' in ctrl) {
        return !svc.testAlterationValidity(ctrl.word, { type: 'SYLLABLE_DECREMENT' })
      }
      return true
    }

    function changeWordLength () {
      while (ctrl.wordMemory.syllables.length <= ctrl.wordLength) {
        ctrl.wordMemory.syllables.push(svc.getRandomSyllable(ctrl.wordMemory))
      }
      while (ctrl.word.syllables.length < ctrl.wordLength) {
        ctrl.word.syllables.push(ctrl.wordMemory.syllables[ctrl.word.syllables.length])
        if (ctrl.syngloss.phonology.prosody.stressType === 'ABSOLUTE' || ctrl.syngloss.phonology.prosody.stressType === 'CONDITIONAL') {
          ctrl.word = svc.restress(ctrl.word)
        }
      }
      while (ctrl.word.syllables.length > ctrl.wordLength) {
        ctrl.word.syllables.pop()
      }
    }

    this.display = name => ((name == undefined) ? '' : name.replace('_', ' '))
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
