angular.module('app').service('phonologyService', ['arrayService',
  function (array) {
    let svc = this

    /* A vowel is short iff it has no gemination and no consonant letters, and either of the two is true:
      (1) it has only one vowel letter,
      (2) is has only two vowel letters, and both vowels have breves.
    */
    this.isShortVowel = (sound) => Array.from(sound).every((char) => char !== '\u02D0' && !isConsonant(char)) &&
      (
        Array.from(sound).filter((char) => isVowel(char)).length === 1 ||
        (
          Array.from(sound).filter((char) => isVowel(char)).length === 2 &&
          Array.from(sound).every((char, charIndex) => !isVowel(char) || modifiedBy(sound, char, charIndex, '\u0306'))
        )
      )

    this.isShortSyllable = (syllable, language) =>
      syllable.phonemes.every((phoneme, phonemeIndex) => phonemeIndex <= language.phonology.vowelCore || phoneme === '') &&
      svc.isShortVowel(syllable.phonemes[language.phonology.vowelCore])

    this.nextPhoneme = function (word, originalSyllableIndex, originalPhonemeIndex) {
      console.log('Called nextPhoneme function. Position: ' + originalSyllableIndex + '-' + originalPhonemeIndex)
      let syllableIndex = originalSyllableIndex
      let phonemeIndex = originalPhonemeIndex
      do {
        phonemeIndex = phonemeIndex + 1
        if (phonemeIndex >= word.syllables[syllableIndex].phonemes.length) {
          phonemeIndex = 0
          syllableIndex = syllableIndex + 1
        }
        if (syllableIndex >= word.syllables.length) {
          console.log('Out of bounds. Returning zero phoneme.')
          return { value: '', index: -1 }
        }
      } while (word.syllables[syllableIndex].phonemes[phonemeIndex] === '')
      console.log('Found next phoneme: ' + word.syllables[syllableIndex].phonemes[phonemeIndex] + ' at position ' + syllableIndex + '-' + phonemeIndex)
      return {
        value: word.syllables[syllableIndex].phonemes[phonemeIndex],
        index: phonemeIndex
      }
    }

    this.previousPhoneme = function (word, originalSyllableIndex, originalPhonemeIndex) {
      let syllableIndex = originalSyllableIndex
      let phonemeIndex = originalPhonemeIndex
      do {
        phonemeIndex = phonemeIndex - 1
        if (phonemeIndex < 0) {
          phonemeIndex = word.syllables[syllableIndex].phonemes.length - 1
          syllableIndex = syllableIndex - 1
        }
        if (syllableIndex < 0) {
          return { value: '', index: -1 }
        }
      } while (word.syllables[syllableIndex].phonemes[phonemeIndex] === '')
      return {
        value: word.syllables[syllableIndex].phonemes[phonemeIndex],
        index: phonemeIndex
      }
    }

    this.syllableInitial = (syllable, thisPhonemeIndex) =>
      syllable.phonemes.every((phoneme, phonemeIndex) => phonemeIndex >= thisPhonemeIndex || phoneme === '')
    this.syllableFinal = (syllable, thisPhonemeIndex) =>
      syllable.phonemes.every((phoneme, phonemeIndex) => phonemeIndex <= thisPhonemeIndex || phoneme === '')

    this.wordInitial = (word, syllableIndex, phonemeIndex) =>
      syllableIndex === 0 && svc.syllableInitial(word.syllables[syllableIndex], phonemeIndex)
    this.wordFinal = (word, syllableIndex, phonemeIndex) =>
      syllableIndex === word.syllables.length - 1 && svc.syllableFinal(word.syllables[syllableIndex], phonemeIndex)

    this.isSameWord = function (word1, word2) {
      if (word1.syllables.length !== word2.syllables.length) {
        return false
      }
      for (let syllableIndex in word1.syllables) {
        if (!svc.isSameSyllable(word1.syllables[syllableIndex], word2.syllables[syllableIndex])) {
          return false
        }
      }
      return true
    }

    this.isSameSyllable = function (syllable1, syllable2) {
      if (syllable1.accent !== syllable2.accent) {
        return false
      }
      if (syllable1.phonemes.length !== syllable2.phonemes.length) {
        return false
      }
      for (let phonemeIndex in syllable1.phonemes) {
        if (syllable1.phonemes[phonemeIndex] !== syllable2.phonemes[phonemeIndex]) {
          return false
        }
      }
      return true
    }

    this.copyWord = (word) => ({
      syllables: word.syllables.map((syllable) => copySyllable(syllable))
    })

    let copySyllable = (syllable) => ({
      accent: syllable.accent,
      phonemes: syllable.phonemes.map((phoneme) => phoneme.slice())
    })

    this.writeIPA = function (word, language) {
      let output = ''

      word.syllables.forEach(function (syllable, syllableIndex) {
        if (language.phonology.prosody.type === 'STRESS' || language.phonology.prosody.type === 'NONE') {
          if (word.syllables.length > 1) {
            if (syllable.accent === 1) output += '\u02C8'
          }
          if (word.syllables.length > 2) {
            if (syllable.accent === 2) output += '\u02CC'
          }
        }
        syllable.phonemes.forEach(function (phoneme, phonemeIndex) {
          output = output += phoneme
          if (phonemeIndex !== language.phonology.vowelCore && isVowel(phoneme[0])) {
            output += '\u032F'
          }
        })
        if (language.phonology.prosody.type === 'PITCH') {
          language.phonology.prosody.inventory[syllable.accent].forEach(function (pitchValue) {
            if (pitchValue === 2) output += '\u02E5'
            if (pitchValue === 1) output += '\u02E6'
            if (pitchValue === 0) output += '\u02E7'
            if (pitchValue === -1) output += '\u02E8'
            if (pitchValue === -2) output += '\u02E9'
          })
        }
        if (language.phonology.prosody.type === 'STRESS' || language.phonology.prosody.type === 'NONE') {
          if (syllableIndex < word.syllables.length - 1 && word.syllables[syllableIndex + 1].accent !== 1 && word.syllables[syllableIndex + 1].accent !== 2) {
            output += '.'
          }
        } else if (language.phonology.prosody.type === 'PITCH') {
          if (language.phonology.prosody.inventory[syllable.accent].length === 0) {
            output += '.'
          }
        } else {
          output += '.'
        }
      })

      // Shift modifiers toward their base characters.
      function shiftCharacterInOutput (index) {
        let thisCharacter = output.charAt(index)
        output[index] = output.charAt(index - 1)
        output[index - 1] = thisCharacter
      }

      for (let characterIndex = 0; characterIndex < output.length; characterIndex++) {
        if (isConsonantModifier(output.charAt(characterIndex)) && isVowelModifier(output.charAt(characterIndex))) {
          while (!(modifyingConsonant(output, characterIndex) || modifyingVowel(output, characterIndex)) && characterIndex > 0) {
            shiftCharacterInOutput(characterIndex)
            characterIndex--
          }
        } else if (isConsonantModifier(output.charAt(characterIndex))) {
          while (!modifyingConsonant(output, characterIndex) && characterIndex > 0) {
            shiftCharacterInOutput(characterIndex)
            characterIndex--
          }
        } else if (isVowelModifier(output.charAt(characterIndex))) {
          while (!modifyingVowel(output, characterIndex) && characterIndex > 0) {
            shiftCharacterInOutput(characterIndex)
            characterIndex--
          }
        }
      }

      // Change modifiers on descending characters and characters with modifiers below to descender-friendly version.
      for (let characterIndex = 1; characterIndex < output.length; characterIndex++) {
        if (isModifier(output.charAt(characterIndex)) && modifyingDescending(output, characterIndex)) {
          output[characterIndex] = descenderFriendly(output.charAt(characterIndex))
        }
      }
      return output
    }

    // Present the invidual IPA symbol.
    // In particular, if the individual symbol is an accent, put it on a dotted circle.
    this.presentIPA = (string) => combining.some((value) => value === string.charAt(0))
      ? '\u25CC' + string
      : string

    function modifiedBy (string, letter, letterIndex, modifier) {
      if (
        letterIndex >= string.length ||
        Array.from(string.slice(letterIndex)).every((char) => char !== modifier) ||
        (!isConsonant(letter) && !isVowel(letter)) ||
        (!isConsonantModifier(modifier) && !isVowelModifier(modifier))
      ) {
        return false
      }
      let string1 = string.split(letterIndex + 1)
      let string2 = Array.from(string1).some((char) => isNextModifiableLetter(letter, modifier, char))
        ? Array.from(string1).split(0, Array.from(string1).findIndex((char) => isNextModifiableLetter(letter, modifier, char)))
        : string1
      return Array.from(string2).some((char) => char === modifier)
    }

    let isNextModifiableLetter = (letter, modifier, char) =>
        (isConsonant(letter) || (isConsonantModifier(modifier) && !isVowelModifier(modifier)))
      ? isConsonant(char)
      : (isVowel(letter) || (isVowelModifier(modifier) && !isConsonantModifier(modifier)))
      ? isVowel(char)
      : isConsonant(char) || isVowel(char)

    let modifyingConsonant = function (output, characterIndex) {
      let index = characterIndex - 1
      while (index > -1) {
        if (consonants.indexOf(output[index]) > -1) {
          return true
        } else if (consonantModifiers.indexOf(output[index]) > -1) {
          index--
        } else {
          return false
        }
      }
      return true
    }

    let modifyingVowel = function (output, characterIndex) {
      let index = characterIndex - 1
      while (index > -1) {
        if (vowels.indexOf(output.charAt(index)) > -1) {
          return true
        } else if (vowelModifiers.indexOf(output.charAt(index)) > -1) {
          index--
        } else {
          return false
        }
      }
      return true
    }

    let modifyingDescending = function (output, characterIndex) {
      let index = characterIndex - 1
      while (index > -1) {
        if (descending.concat(modifiersBelow).indexOf(output.charAt(index)) > -1) {
          return true
        } else if (modifiers.indexOf(output.charAt(index)) > -1) {
          index--
        } else {
          return false
        }
      }
      return false
    }

    let descenderFriendly = (string) => descenderFriendlyVersion.some((pair) => pair['original'] === string)
      ? descenderFriendlyVersion.find((pair) => pair['original'] === string)['descenderFriendly']
      : string

    let isConsonant = (input) => consonants.some((value) => value === input)
    let isVowel = (input) => vowels.some((value) => value === input)
    let isConsonantModifier = (input) => consonantModifiers.some((value) => value === input)
    let isVowelModifier = (input) => vowelModifiers.some((value) => value === input)
    let isModifier = (input) => modifiers.some((value) => value === input)

    /*
      TODO The following arrays are temporarily hard-coded.
      They should be accessed from the database using $http GET methods.
      These should all be stored into a single table, with the following rows:
      value(string)(primary key), consonant(bool), vowel(bool),
      descending(bool), consonantModifier(bool), vowelModifier(bool),
      modifierBelow(bool), descenderFriendly(int)
    */

    let consonants = [
      'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's',
      't', 'v', 'w', 'x', 'z', '\u00A1', '\u00E7', '\u00F0', '\u0127', '\u014B',
      '\u01C0', '\u01C1', '\u01C2', '\u01C3', '\u0253', '\u0255', '\u0256', '\u0257',
      '\u025F', '\u0260', '\u0262', '\u0263', '\u0265', '\u0266', '\u026B', '\u026C',
      '\u026D', '\u026E', '\u0270', '\u0271', '\u0272', '\u0273', '\u0274', '\u0278',
      '\u0279', '\u027A', '\u027B', '\u027D', '\u027E', '\u0280', '\u0281', '\u0282',
      '\u0283', '\u0284', '\u0288', '\u028B', '\u028D', '\u028E', '\u0290', '\u0291',
      '\u0292', '\u0294', '\u0295', '\u0298', '\u0299', '\u029B', '\u029C', '\u029D',
      '\u029E', '\u029F', '\u02A1', '\u02A2', '\u02A3', '\u02A4', '\u02A5', '\u02A6',
      '\u02A7', '\u02A8', '\u03B2', '\u03B8', '\u03C7', '\u1D91', '\u2C71'
    ]

    let vowels = [
      'a', 'e', 'i', 'o', 'u', 'y', '\u00E4', '\u00E6', '\u00F8', '\u0153', '\u0250',
      '\u0251', '\u0252', '\u0254', '\u0258', '\u0259', '\u025A', '\u025B', '\u025C',
      '\u025D', '\u025E', '\u0264', '\u0268', '\u026A', '\u026F', '\u0275', '\u0289',
      '\u028A', '\u028C', '\u028F'
    ]

    let consonantModifiers = [
      '\u02B0', '\u02B2', '\u02B7', '\u02BC', '\u02DE', '\u02E0', '\u02E1', '\u02E3',
      '\u02E4', '\u0303', '\u031A', '\u031C', '\u031D', '\u031E', '\u031F', '\u0320',
      '\u0324', '\u0325', '\u0329', '\u032A', '\u032C', '\u0330', '\u0334', '\u0339',
      '\u033A', '\u033B', '\u033C', '\u0361', '\u1D4A', '\u1DA3', '\u1DB9', '\u1DBF'
    ]

    let vowelModifiers = [
      '\u02DE', '\u02E4', '\u0303', '\u0308', '\u0318', '\u0319', '\u031C', '\u031D',
      '\u031E', '\u031F', '\u0320', '\u0324', '\u032F', '\u0330', '\u0339', '\u033D'
    ]

    let modifiers = consonantModifiers.concat(vowelModifiers)

    let descending = [
      'g', 'j', 'p', 'q', 'y', '\u00A1', '\u00E7', '\u014B', '\u0256', '\u025F',
      '\u0260', '\u0263', '\u0265', '\u026D', '\u026E', '\u0270', '\u0271', '\u0272',
      '\u0273', '\u0278', '\u027B', '\u027D', '\u0282', '\u0283', '\u0284', '\u0288',
      '\u0290', '\u0292', '\u029D', '\u029E', '\u02A4', '\u02A7', '\u03B2', '\u03C7', '\u1D91'
    ]

    let modifiersBelow = [
      '\u0318', '\u0319', '\u031C', '\u031D', '\u031E', '\u031F', '\u0320', '\u0324',
      '\u0325', '\u0329', '\u032A', '\u032C', '\u032F', '\u0330', '\u0339', '\u033A',
      '\u033B', '\u033C'
    ]

    let combining = [
      '\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0305', '\u0306', '\u0307',
      '\u0308', '\u0309', '\u030A', '\u030B', '\u030C', '\u030D', '\u030E', '\u030F',
      '\u0310', '\u0311', '\u0312', '\u0313', '\u0314', '\u0315', '\u0316', '\u0317',
      '\u0318', '\u0319', '\u031A', '\u031B', '\u031C', '\u031D', '\u031E', '\u031F',
      '\u0320', '\u0321', '\u0322', '\u0323', '\u0324', '\u0325', '\u0326', '\u0327',
      '\u0328', '\u0329', '\u032A', '\u032B', '\u032C', '\u032D', '\u032E', '\u032F',
      '\u0330', '\u0331', '\u0332', '\u0333', '\u0334', '\u0335', '\u0336', '\u0337',
      '\u0338', '\u0339', '\u033A', '\u033B', '\u033C', '\u033D', '\u033E', '\u033F',
      '\u0340', '\u0341', '\u0342', '\u0343', '\u0344', '\u0345', '\u0346', '\u0347',
      '\u0348', '\u0349', '\u034A', '\u034B', '\u034C', '\u034D', '\u034E', '\u034F',
      '\u0350', '\u0351', '\u0352', '\u0353', '\u0354', '\u0355', '\u0356', '\u0357',
      '\u0358', '\u0359', '\u035A', '\u035B', '\u035C', '\u035D', '\u035E', '\u035F',
      '\u0360', '\u0361', '\u0362', '\u0363', '\u0364', '\u0365', '\u0366', '\u0367',
      '\u0368', '\u0369', '\u036A', '\u036B', '\u036C', '\u036D', '\u036E', '\u036F',
      '\u0483', '\u0484', '\u0485', '\u0486', '\u0488', '\u0489', '\u1DC0', '\u1DC1',
      '\u1DC2', '\u1DC3', '\u1DC4', '\u1DC5', '\u1DC6', '\u1DC7', '\u1DC8', '\u1DC9',
      '\u1DCA', '\u1DFE', '\u1DFF', '\uFE20', '\uFE21', '\uFE22', '\uFE23'
    ]

    let descenderFriendlyVersion = [
      { original: '\u031D', descenderFriendly: '\u02D4' },
      { original: '\u031E', descenderFriendly: '\u02D5' },
      { original: '\u031F', descenderFriendly: '\u02D6' },
      { original: '\u0320', descenderFriendly: '\u02D7' },
      { original: '\u0325', descenderFriendly: '\u030A' },
      { original: '\u0329', descenderFriendly: '\u030D' },
      { original: '\u032F', descenderFriendly: '\u0311' },
      { original: '\u0330', descenderFriendly: '\u02F7' }
    ]
  }])
