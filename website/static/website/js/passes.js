sateye.passes = {
  dom: {},

  initialize: function() {
    var start = dayjs().format('YYYY-MM-DD');
    var end = dayjs().add(3, 'day').format('YYYY-MM-DD');

    sateye.passes.dom.passList = $('#pass-list');
    sateye.passes.predictPasses(start, end, 1, 1);
  },

  predictPasses: function(startDate, endDate, satelliteId, locationId) {
    var self = this;
    var params = {
      start_date: startDate,
      end_date: endDate,
      location: locationId,
    };

    $.ajax({
      url: '/api/satellites/' + satelliteId + '/predict_passes/',
      cache: false,
      data: params,
    }).done(function(data) { self.onPassesRetrieved(data) });
  },

  onPassesRetrieved: function(data) {
    var date_format = 'DD/MM/YYYY HH:mm:ss'

    // TODO: Dynamic selection of satellite and location
    data.forEach(function(pass) {
      pass.max_elevation_date =  dayjs(pass.max_elevation_date).format(date_format);
    });

    var context = {
      passes: data,
      location: 'UTN Los Reyunos',
      satellite: 'ISS',
    };

    var content = sateye.templates.passList(context);
    sateye.dom.passList.html(content);
  },
};