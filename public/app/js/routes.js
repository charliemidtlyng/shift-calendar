angular.module('scRoutes', [])
    .config(function($routeProvider, $locationProvider) {
        $routeProvider

            .when('/', {
                templateUrl: 'assets/templates/kalender.html',
                controller: 'CalendarController',
                activetab: 'calendar'
            })
            .when('/om', {
                templateUrl: 'assets/templates/om.html',
                activetab: 'about'
            })
            .when('/kontakt', {
                templateUrl: 'assets/templates/kontakt.html',
                activetab: 'kontakt' // TODO: Refactor to directive
            })
            .when('/404', { templateUrl: 'assets/templates/404.html' })

        .otherwise( { redirectTo: '/404' });

        $locationProvider.html5Mode(false);
    })

    .run(function($rootScope, $location){
        $rootScope.menuActive = function(url, exactMatch){
            if (exactMatch){
                return $location.path() == url;
            }
            else {
                return $location.path().indexOf(url) == 0;
            }
        }
    });
;