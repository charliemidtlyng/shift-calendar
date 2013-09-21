'use strict';

angular.module('scCalendarController', [])
    .factory('$googleApiService', ['$http', '$q',
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
                    calendarScope.$apply(function() {
                        addGoogleCalendarEvents();
                    });
                });
            }

            function transformFromGC(items) {
                var events = [];
                _.each(items, function(item) {
                    var startTime = item.start.dateTime;
                    var endTime = item.end.dateTime;
                    var start = $.fullCalendar.parseISO8601(startTime, false);
                    var end = $.fullCalendar.parseISO8601(endTime, false);
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
                    var req = gapi.client.calendar.events.list({
                        calendarId: calendar.id
                    });
                    req.execute(function(resp) {
                        calendarScope.gcalSource = transformFromGC(resp.items);
                        calendarScope.eventSources.push(calendarScope.gcalSource);
                        calendarScope.$apply();
                    });

                });
            }

            function moveFromLocalToGcalSource(gcalResponses) {
                calendarScope.$apply(function() {
                    _.each(transformFromGC(gcalResponses), function(gcalResponse) {
                        calendarScope.gcalSource.push(gcalResponse);
                    });
                });
                calendarScope.$apply(function() {
                    var index = _.indexOf(calendarScope.eventSources, calendarScope.hendelser);
                    calendarScope.eventSources.splice(index, 1);

                });
                calendarScope.$apply(function() {
                    calendarScope.hendelser.splice(0, calendarScope.hendelser.length);
                    calendarScope.hendelser = undefined;
                    calendarScope.calendar.fullCalendar('next');
                    calendarScope.calendar.fullCalendar('prev');
                });


            }

            function syncEvents(calendar) {
                var numberOfEvents = 0,
                    responses = [];
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
                        responses.push(response);
                        numberOfEvents++;
                        if (numberOfEvents === calendarScope.hendelser.length) {
                            moveFromLocalToGcalSource(responses);
                        }
                        calendarScope.inProgress = calendarScope.inProgress - 1;
                        // Remove event from hendelser 
                        // Add event to local GCalScope
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

            function deleteCalendar() {
                getCalendar().then(function(calendar) {
                    var request = gapi.client.calendar.calendars.delete({
                        calendarId: calendar.id
                    });
                    request.execute(function(response) {
                        location.reload();
                    });
                });
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
                },
                deleteCalendar: function() {
                    deleteCalendar();
                }
            };

        }
    ])
    .controller('CalendarController', ['$scope', '$googleApiService',
        function($scope, googleApiService) {
            googleApiService.authorize($scope);

            $scope.handleAuthClick = function() {
                googleApiService.handleAuthClick($scope);
            };

            $scope.skifttyper = {
                valgt: 0,
                alternativer: [{
                    id: 1,
                    navn: "Fri",
                    farge: "#CCC",
                    startTid: '0',
                    sluttTid: '0'
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

            function addEventsToEventSource(event) {
                if ($scope.hendelser === undefined) {
                    $scope.hendelser = [];
                    $scope.hendelser.push(event);
                    $scope.eventSources.push($scope.hendelser);
                } else {
                    $scope.hendelser.push(event);
                }
            }

            $scope.addEvent = function(date, allDay, jsEvent, view) {
                if ($scope.skifttyper.valgt === 0) {
                    return;
                }
                var valgt = $scope.skifttyper.alternativer[$scope.skifttyper.valgt - 1];
                addEventsToEventSource({
                    title: valgt.navn,
                    start: date,
                    startTid: moment(date).add('hours', valgt.startTid),
                    slutt: moment(date).add('hours', valgt.sluttTid),
                    sluttTid: moment(date).add('hours', valgt.sluttTid),
                    color: valgt.farge
                });
                $scope.$apply();
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
                googleApiService.syncWithGoogleCalendar($scope);
            };

            $scope.deleteCalendar = function() {
                googleApiService.deleteCalendar();
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

            var testItem = {
                "title": "Natt",
                "start": "2013-09-24T22:00:00.000Z",
                "startTid": "2013-09-25T19:30:00.000Z",
                "slutt": "2013-09-26T05:30:00.000Z",
                "sluttTid": "2013-09-26T05:30:00.000Z",
                "color": "#000",
                "__uiCalId": 9,
                "_id": "_fc2",
                "_start": "2013-09-24T22:00:00.000Z",
                "end": null,
                "_end": null,
                "allDay": true,
                "className": []
            }
            $scope.eventSources = [];
        }
    ]);