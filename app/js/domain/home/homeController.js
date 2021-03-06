/* global angular */
angular.module('app').controller('homeController', [ '$http', function homeController ($http) {
  let ctrl = this

  this.retrievingData = true

  function setLanguageNames (languageNamesData) {
    ctrl.retrievingData = false
    ctrl.languageNames = languageNamesData.map((languageName) => ({
      href: '#/interface/' + languageName,
      displayName: languageName.replace('_', ' ')
    }))
  }

  $http.get('https://c1hj6zyvol.execute-api.us-east-1.amazonaws.com/prod/languages')
    .then((httpResponse) => setLanguageNames(httpResponse.data))
}])
