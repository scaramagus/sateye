sateye.passes = function() {
    var self = {};
    self.dom = {};
    self.instances = [];

    self.initialize = function() {
        // references to the dom
        self.dom.passesList = $('#passes-list');

        // samples passes retrieved, placeholder until we have GUI to ask for passes
        var startDate = sateye.map.viewer.clock.currentTime;
        var endDate = sateye.addSeconds(startDate, 3600 * 24 * 10);
        setTimeout(function() {self.getPassesPredictions(startDate, endDate, 1, 1)}, 5000)
    }

    self.createPass = function(passData) {
        // create a new pass instance, parsing the json received from an api
        return {
            aos: sateye.parseDate(passData.aos),
            los: sateye.parseDate(passData.los),
            tca: sateye.parseDate(passData.tca),
            tcaElevation: passData.tca_elevation,
            sunElevation: passData.sun_elevation,
        };
    }

    self.getPassesPredictions = function(startDate, endDate, satelliteId, locationId) {
        // get passes predictions of a satellite over a location during a period of time
        $.ajax({
            url: '/api/satellites/' + satelliteId + '/predict_passes/',
            cache: false,
            data: {
                start_date: startDate.toString(),
                end_date: endDate.toString(),
                location_id: locationId,
            },
        }).done(self.onPassesRetrieved);
    }

    self.onPassesRetrieved = function(data) {
        // list of passes received, populate the passes list
        var dashboard = sateye.dashboards.current;
        console.log(data)
        var satellite = dashboard.getSatellite(data.satellite_id);
        var location = dashboard.getLocation(data.location_id);
        console.log(satellite);
        console.log(location);

        if (satellite === null || location === null) {
            sateye.showAlert(sateye.Alert.ERROR, 
                             "Something went wrong retrieving the passes predictions.");
            return;
        }

        var context = {
            satellite: satellite,
            location: location,
            passes: [],
        };

        for (let passData of data.passes) {
            context.passes.push(self.createPass(passData));
        }

        var content = sateye.templates.passesList(context);
        self.dom.passesList.html(content);
    }

    return self;
}();
