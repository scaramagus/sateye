sateye.map = {
    mainMap: null,
    bingMapsKey: "An81HXJxaDgqEuOBSIVNCRkH4OPEx_55QMOd9dPSemaugIg565elMLC_etRL3cEV",
    cesiumConfig: {
        homeButton: false,
        navigationInstructionsInitiallyVisible: false,
        sceneMode: Cesium.SceneMode.SCENE2D,
    },

    // chunking configs. More info at docs/prediction_chunks.rst
    // how often do we check if we need to refresh predictions?
    _predictionRefreshSeconds: 5,
    // how many real seconds do we want to get on each prediction?
    _predictionRealSeconds: 240,
    // how many seconds left in the current prediction are "too litle" so we need to get a new one?
    _predictionMarginRealSeconds: 30,

    initialize: function() {
        // initialize the map module
        sateye.map.configureCesiumMap();
    },

    configureCesiumMap: function() {
        // configure the cesium map
        Cesium.BingMapsApi.defaultKey = sateye.map.bingMapsKey;
        sateye.map.mainMap = new Cesium.Viewer("main-map", sateye.map.cesiumConfig);

        // center on 0,0 with enough distance to see the whole planet
        var center = Cesium.Cartesian3.fromDegrees(0, 0);
        sateye.map.mainMap.camera.lookAt(center, new Cesium.Cartesian3(0.0, 0.0, 50000000.0));

        // day and night
        sateye.map.mainMap.scene.globe.enableLighting = true;

        // every some time, ensure we have paths for each satellite
        //sateye.map.mainMap.clock.onTick.addEventListener(sateye.map.onMapTick);
 
        setInterval(sateye.map.ensurePathsInfo, 
                    sateye.map._predictionRefreshSeconds * 1000);
    },

    onMapTick: function(clock) {
        // time has passed in the map
    },

    realToMapSeconds: function(realSeconds) {
        // convert real seconds to map seconds, because the map can be moving at a different 
        // speed
        var clock = sateye.map.mainMap.clock;
        return clock.clockStep * clock.multiplier * realSeconds;
    },

    ensurePathsInfo: function() {
        // ensure the map has enough info to display paths for shown satellites

        // if we have less than X real seconds of predictions left, then ask for Y predicted 
        // seconds
        // more info at docs/prediction_chunks.rst
        for (let satellite of sateye.satellites.active) {
            // TODO shorten with names, add comments
            if (!satellite.hasPredictionsToFillSeconds(sateye.map.realToMapSeconds(sateye.map._predictionMarginRealSeconds))) {
                var fromTime = sateye.map.mainMap.clock.currentTime;
                var secondsAhead = sateye.map.realToMapSeconds(sateye.map._predictionRealSeconds);
                satellite.getMorePredictions(fromTime, secondsAhead);
            }
        }
    },
}