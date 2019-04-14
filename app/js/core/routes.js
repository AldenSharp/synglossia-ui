/* global angular */
angular
  .module('app')
  .config(['$routeProvider', 'baseRoute',
    function config ($routeProvider, baseRoute) {
      $routeProvider
        .when('/home', {
          templateUrl: baseRoute + 'home/template.html',
          controller: 'homeController',
          controllerAs: 'ctrl'
        })
        .when('/interface/:languageName', {
          templateUrl: baseRoute + 'interface/template.html',
          controller: 'interfaceController',
          controllerAs: 'ctrl'
        })
        .when('/well-formed-speech', {
          templateUrl: baseRoute + 'speechArticle/template.html',
          controller: 'speechArticleController',
          controllerAs: 'ctrl'
        })
        .otherwise('/home')
    }])
