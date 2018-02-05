angular.module('app').controller('homeController', [ function homeController () {

  this.display = name => name.replace('_', ' ')

}])
