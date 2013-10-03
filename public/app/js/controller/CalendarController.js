'use strict';

angular.module('scCalendarController', [])
    .factory('$googleApiService', ['$http', '$q',
        function($http, $q) {
            var clientId = '821896396854-cfhqjbtc1pg26d0sf50jubdumnhouvo7.apps.googleusercontent.com';
            var apiKey = 'AIzaSyAPpJQ41xhzov5Es5udF1-EcW26bcElT3g';
            var scopes = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.profile';
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
                if (authResult && !authResult.error) {
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
                gapi.client.load('oauth2', 'v2', function() {
                    gapi.client.load('calendar', 'v3', function() {
                        calendarScope.$apply(function() {
                            addGoogleCalendarEvents();
                        });
                    });
                });

            }

            function transformFromGC(items) {
                var events = [];
                _.each(items, function(item) {
                    var startTime = item.start.date;
                    var endTime = item.end.date;
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
                _.each(calendarScope.hendelser, function(hendelse, index) {

                    var request = gapi.client.calendar.events.insert({
                        calendarId: calendarId,
                        resource: {
                            summary: hendelse.title,
                            start: {
                                date: moment(hendelse.start).format('YYYY-MM-DD')
                            },
                            end: {
                                date: moment(hendelse.slutt).format('YYYY-MM-DD')
                            },
                            colorId: hendelse.colorId
                        }
                    });
                    var executeRequest = function() {
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
                    };

                    // Create waitLoop in order to not spam Google Api
                    var waitLoop = function() {
                        if (index - responses.length > 5) {
                            console.log("waiting with");
                            console.log(hendelse);
                            setTimeout(waitLoop, 1000);
                        } else {
                            executeRequest();
                        }
                    };
                    waitLoop();

                });

            }

            function createCalendar(userInfo) {
                var deferred = $q.defer();
                var request = gapi.client.calendar.calendars.insert({
                    resource: {
                        summary: "ShiftCalendar",
                        description: "ShiftCalendar" + userInfo.id,
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

            function resolveOrCreateCalendar(result, userInfo) {
                var deferred = $q.defer();
                var calendar = _.find(result.items, function(item) {
                    return item.description === "ShiftCalendar" + userInfo.id;
                });
                if (calendar) {
                    deferred.resolve(calendar);
                } else {
                    createCalendar(userInfo).then(function(calendar) {
                        deferred.resolve(calendar);
                    });
                }
                return deferred.promise;
            }

            function getUserInfo() {
                var deferred = $q.defer();
                gapi.client.oauth2.userinfo.get().execute(function(userInfo) {
                    deferred.resolve(userInfo);
                });
                return deferred.promise;
            }

            function getCalendar() {
                var request = gapi.client.calendar.calendarList.list();
                var userInfoRequest = gapi.client.oauth2.userinfo.get();
                var deferred = $q.defer();
                request.execute(function(response) {
                    userInfoRequest.execute(function(userInfo) {
                        calendarScope.$apply(function() {
                            resolveOrCreateCalendar(response, userInfo).then(function(calendar) {
                                deferred.resolve(calendar);
                            });
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
                    farge: "#51b749",
                    colorId: 10
                }, {
                    id: 2,
                    navn: "Dag",
                    farge: "#ffb878",
                    colorId: 6
                }, {
                    id: 3,
                    navn: "Aften",
                    farge: "#a4bdfc",
                    colorId: 1
                }, {
                    id: 4,
                    navn: "Natt",
                    farge: "#ff887c",
                    colorId: 4
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
                if ($scope.skifttyper.valgt === 0 || $scope.inProgress) {
                    return;
                }
                var valgt = $scope.skifttyper.alternativer[$scope.skifttyper.valgt - 1];
                $scope.$apply(function() {
                    addEventsToEventSource({
                        title: valgt.navn,
                        start: date,
                        slutt: date,
                        color: valgt.farge,
                        colorId: valgt.colorId
                    });
                });
                $scope.calendar.fullCalendar('removeEvents').fullCalendar('addEventSource', $scope.hendelser).fullCalendar('addEventSource', $scope.gcalSource);
            };

            $scope.removeEvent = function(valgtHendelse, jsEvent, view) {
                var index = _.indexOf($scope.hendelser, valgtHendelse);
                if (index === -1) {
                    return;
                }
                $scope.$apply(function() {
                    $scope.hendelser.splice(index, 1);
                });
                $scope.calendar.fullCalendar('removeEvents').fullCalendar('addEventSource', $scope.hendelser).fullCalendar('addEventSource', $scope.gcalSource);
            };

            $scope.syncWithGoogleCalendar = function() {
                googleApiService.syncWithGoogleCalendar($scope);
            };

            $scope.deleteCalendar = function() {
                googleApiService.deleteCalendar();
            };

            $scope.keyPressed = function(e) {
                switch (e.which) {
                    case 49:
                        $scope.skifttyper.valgt = 1;
                        break;
                    case 50:
                        $scope.skifttyper.valgt = 2;
                        break;
                    case 51:
                        $scope.skifttyper.valgt = 3;
                        break;
                    case 52:
                        $scope.skifttyper.valgt = 4;
                        break;
                }
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

            $scope.eventSources = [];
        }
    ]);