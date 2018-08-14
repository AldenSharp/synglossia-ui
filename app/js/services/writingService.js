angular.module('app').service('writingService',
  ['conditionsService', 'phonologyService', 'arrayService',
    function (conditions, phonology, array) {
      this.write = function (word, language, writingSystemName) {
        if (writingSystemName === 'IPA') {
          return phonology.writeIPA(word, language)
        }
        if (language.writingSystems.every((writingSystem) => writingSystem.name !== writingSystemName)) {
          console.error(writingSystemName + ' writing system not found in the ' + language.name + ' language.')
        }
        return writeByType(word, language, language.writingSystems.find((writingSystem) => writingSystem.name === writingSystemName))
      }

      function writeByType (word, language, writingSystem) {
        if (writingSystem.type === 'ALPHABET') {
          return alphabetWrite(language, word, writingSystem)
        }
        if (writingSystem.type === 'CONSONANTAL') {
          return consonantalWrite(language, word, writingSystem)
        }
        if (writingSystem.type === 'MORAIC') {
          return moraicWrite(language, word, writingSystem)
        }
        if (writingSystem.type === 'LOGOGRAPHIC') {
          return logographicWrite(language, word, writingSystem)
        }
      }

      // The 'ALPHABET' type expects a list of all phonemes in the language (and none not in the language).
      function alphabetWrite (language, word, writingSystem) {
        let writtenWord = ''
        for (let syllableIndex in word.syllables) {
          syllableIndex = parseInt(syllableIndex)
          let syllable = word.syllables[syllableIndex]
          for (let phonemeIndex in syllable.phonemes) {
            phonemeIndex = parseInt(phonemeIndex)
            let phoneme = syllable.phonemes[phonemeIndex]
            writtenWord += writeSymbolOfPhoneme(writingSystem, phoneme, phonemeIndex, syllableIndex)
          }
        }
        return writtenWord
      }

      function writeSymbolOfPhoneme (writingSystem, phoneme, phonemeIndex, syllableIndex) {
        if (phoneme.length === 0) {
          return ''
        }

        let rule = writingSystem.rules.find((rule) =>
          rule.sounds.some((sound) => sound === phoneme)
        )

        if (rule === undefined) { return "" }

        for (let grapheme of rule.graphemes) {
          if (conditions.meetsCondition(
            language, word, syllableIndex, phonemeIndex, grapheme.condition
          )) {
            return grapheme.value
          }
        }
      }

      // The 'CONSONANTAL' type expects a list of all consonants, and optionally allows vowels (plus zero vowel).
      // This type is to be used by pure abjads such as Phoenician, and can also be used for abugidas.
      function consonantalWrite (language, word, writingSystem) {
        console.error('Conditional writing system called, but not yet implemented.')
      }

      // The 'MORAIC' type expects a list of all initial-vowel pairs, and a second list of all codas.
      // This type merges Japanese-style syllabary and Arabic-style abjad.
      function moraicWrite (language, word, writingSystem) {
        console.error('Moraic writing system called, but not yet implemented.')
      }

      // After implementing linguistic semantics, a 'LOGOGRAPHIC' writing system type could also be implemented.
        // This type can be partial, defaulting to an alternate writing system for words outside of its list.
          // Examples include Ancient Egyptian, Sumerian, and Japanese.
          // Another possible example is 'smart'/'liberal' handling of Chinese logograms, imitating its earlier stages.
      function logographicWrite (language, word, writingSystem) {
        console.error('Logographic writing system called, but not yet implemented.')
      }
    }])
