'use strict';

angular.module('scCalendarController', [])
    .factory('$authorizationService', ['$http', '$q',
        function($http, $q) {
            var clientId = '821896396854-cfhqjbtc1pg26d0sf50jubdumnhouvo7.apps.googleusercontent.com';
            var apiKey = 'AIzaSyAPpJQ41xhzov5Es5udF1-EcW26bcElT3g';
            var scopes = 'https://www.googleapis.com/auth/calendar';
            var calendarScope;

            function handleClientLoad() {
                // Step 2: Reference the API key
                gapi.client.setApiKey(apiKey);
                window.setTimeout(checkAuth, 2);
            }

            function checkAuth() {
                gapi.auth.authorize({
                    client_id: clientId,
                    scope: scopes,
                    immediate: true
                }, handleAuthResult);
            }

            function handleAuthResult(authResult) {
                var authorizeButton = document.getElementById('authorize-button');
                if (authResult && !authResult.error) {
                    // authorizeButton.style.visibility = 'hidden';
                    //TODO Set scope value
                    calendarScope.authorized = true;
                    calendarScope.$apply();
                    makeApiCall();
                } else {
                    calendarScope.authorized = false;
                    calendarScope.$apply();
                }
            }

            function handleAuthClick(event) {
                // Step 3: get authorization to use private data
                gapi.auth.authorize({
                    client_id: clientId,
                    scope: scopes,
                    immediate: false
                }, handleAuthResult);
                return false;
            }

            // Load the API and make an API call.  Display the results on the screen.

            function makeApiCall() {
                // Step 4: Load the Google+ API
                gapi.client.load('calendar', 'v3', function() {
                    addGoogleCalendarEvents();
                });
            }
            function transformFromGC (items) {
                var events = [];
                _.each(items, function(item){
                    var startTime = item.start.dateTime;
                    var endTime = item.end.dateTime;
                    var start = $.fullCalendar.parseISO8601(startTime, true);
                    var end = $.fullCalendar.parseISO8601(endTime, true);
                    events.push({
                        id: item.iCalUID,
                        title: item.summary,
                        url: item.htmlLink,
                        start: start,
                        end: end
                    });
                });
                return events;
            }
            function addGoogleCalendarEvents() {
                getCalendar().then(function(calendar) {
                    calendarScope.gcalSource = [];
                    var req = gapi.client.calendar.events.list({calendarId: calendar.id});
                    req.execute(function(resp){
                        calendarScope.gcalSource = transformFromGC(resp.items);
                        calendarScope.eventSources.push(calendarScope.gcalSource);
                        calendarScope.$apply();
                    });
                    
                });
            }

            // Google calendar specific

            function syncEvents(calendar) {
                var calendarId = calendar.id;
                calendarScope.inProgress = calendarScope.hendelser ? calendarScope.hendelser.length : 0;
                _.each(calendarScope.hendelser, function(hendelse) {
                    var request = gapi.client.calendar.events.insert({
                        calendarId: calendarId,
                        resource: {
                            summary: hendelse.title,
                            start: {
                                dateTime: moment(hendelse.startTid).format('YYYY-MM-DDTHH:mm:ssZ')
                            },
                            end: {
                                dateTime: moment(hendelse.sluttTid).format('YYYY-MM-DDTHH:mm:ssZ')
                            }
                        }
                    });
                    request.execute(function(response) {
                        calendarScope.inProgress = calendarScope.inProgress - 1;
                        calendarScope.$apply();
                    });
                });

            }

            function createCalendar() {
                var deferred = $q.defer();
                var request = gapi.client.calendar.calendars.insert({
                    resource: {
                        summary: "ShiftCalendar",
                        description: "ShiftCalendar",
                        location: "Norway",
                        timezone: "GMT+1:00"
                    }
                });

                request.execute(function(response) {
                    calendarScope.$apply(function() {
                        deferred.resolve(response);
                    });
                });
                return deferred.promise;
            }

            function resolveOrCreateCalendar(result) {
                var deferred = $q.defer();

                var calendar = _.find(result.items, function(item) {
                    return item.summary === "ShiftCalendar";
                });
                if (calendar) {
                    deferred.resolve(calendar);
                } else {
                    createCalendar().then(function(calendar) {
                        deferred.resolve(calendar);
                    });
                }
                return deferred.promise;
            }

            function getCalendar() {
                var deferred = $q.defer();
                var request = gapi.client.calendar.calendarList.list();
                request.execute(function(response) {
                    calendarScope.$apply(function() {
                        resolveOrCreateCalendar(response).then(function(calendar) {
                            deferred.resolve(calendar);
                        });
                    });
                });
                return deferred.promise;
            }

            function syncWithGoogleCalendar() {
                getCalendar().then(syncEvents);
            }

            return {
                authorize: function(scope) {
                    calendarScope = scope;
                    window.setTimeout(handleClientLoad, 300);
                },
                handleAuthClick: function(scope) {
                    calendarScope = scope;
                    handleAuthClick();
                },
                syncWithGoogleCalendar: function(scope) {
                    calendarScope = scope;
                    syncWithGoogleCalendar();
                }
            };

        }
    ])
    .controller('CalendarController', ['$scope', '$authorizationService',
        function($scope, authorizationService) {
            authorizationService.authorize($scope);

            $scope.handleAuthClick = function() {
                authorizationService.handleAuthClick($scope);
            };

            $scope.skifttyper = {
                valgt: 0,
                alternativer: [{
                    id: 1,
                    navn: "Fri",
                    farge: "#CCC",
                    startTid: '0',
                    sluttTid: '23:59'
                }, {
                    id: 2,
                    navn: "Dag",
                    farge: "#33CC33",
                    startTid: '07.5',
                    sluttTid: '15.5'
                }, {
                    id: 3,
                    navn: "Aften",
                    farge: "#0099FF",
                    startTid: '15.5',
                    sluttTid: '22'
                }, {
                    id: 4,
                    navn: "Natt",
                    farge: "#000",
                    startTid: '21.5',
                    sluttTid: '31.5'
                }]

            };

            $scope.addEvent = function(date, allDay, jsEvent, view) {
                $scope.$apply(function() {
                    if ($scope.skifttyper.valgt === 0) {
                        return;
                    }
                    var valgt = $scope.skifttyper.alternativer[$scope.skifttyper.valgt - 1];
                    $scope.hendelser.push({
                        title: valgt.navn,
                        start: date,
                        startTid: moment(date).add('hours', valgt.startTid),
                        slutt: moment(date).add('hours', valgt.sluttTid),
                        sluttTid: moment(date).add('hours', valgt.sluttTid),
                        color: valgt.farge
                    });
                });
            };

            $scope.removeEvent = function(valgtHendelse, jsEvent, view) {
                var index = _.indexOf($scope.hendelser, valgtHendelse);
                if (index === -1) {
                    return;
                }
                $scope.$apply(function() {
                    $scope.hendelser.splice(index, 1);
                });
            };

            $scope.syncWithGoogleCalendar = function() {
                authorizationService.syncWithGoogleCalendar($scope);
            };

            $scope.kalenderInnstillinger = {
                height: 450,
                editable: true,
                header: {
                    left: 'month basicWeek basicDay agendaWeek',
                    center: 'title',
                    right: 'today prev,next'
                },
                firstDay: 1,
                weekNumbers: true,
                dayClick: $scope.addEvent,
                eventClick: $scope.removeEvent
            };

            $scope.hendelser = [];
            // $scope.gcalSource = {
            //     url: "https://www.google.com/calendar/feeds/irontvfhd710k6oips7s5glkt4%40group.calendar.google.com/private-a10f7add274d3ff32f54c870fbbd6be3/basic"
            // };
            $scope.eventSources = [$scope.hendelser];
        }
    ]);