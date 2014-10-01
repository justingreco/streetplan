var config = {
    streetTypeService: "http://maps.raleighnc.gov/arcgis/rest/services/Planning/StreetTypology/MapServer",
    addressService: "http://maps.raleighnc.gov/arcgis/rest/services/Addresses/MapServer/0/query",
    geometry: "http://maps.raleighnc.gov/arcgis/rest/services/Utilities/Geometry/GeometryServer"
};
var map, popup, graphics;

function init() {
    require(["esri/map","esri/geometry/Extent", "esri/layers/WebTiledLayer", "dojo/domReady!"], function(Map, Extent, WebTiledLayer) { 
        createSearch();
        map = new Map("map", {
            extent: new Extent({xmin: -8791095, ymin: 4245981, xmax: -8719039, ymax: 4301383, spatialReference: {wkid: 102100}}),
            logo: false,
            showAttribution: false,
            maxScale: 9000
        });
        var wtl = new WebTiledLayer("http://${subDomain}.tile.stamen.com/toner-lite/${level}/${col}/${row}.png",
            {id: "Stamen Toner", subDomains: ['a', 'b', 'c', 'd']});
        map.addLayer(wtl);
        mapLoaded();
        map.on("load", mapLoaded);
        map.on("click", mapClicked);
        loadLegend();
        $("img").click(function(){
            alert(map.getScale());
        });
    });
}

function mapClicked(e) {
    "use strict";
    require(["esri/tasks/IdentifyTask","esri/tasks/IdentifyParameters","esri/symbols/SimpleLineSymbol","esri/Color", "esri/graphic", "esri/dijit/Popup","esri/dijit/PopupTemplate"], function(IdentifyTask, IdentifyParameters, SimpleLineSymbol, Color, Graphic, Popup, PopupTemplate) { 
        var it = new IdentifyTask(config.streetTypeService),
            params = new IdentifyParameters(),
            lids = [],
            template = null,
            sym = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255, 255, 0, 0.6]), 4);
        params.mapExtent = map.extent;
        params.geometry = e.mapPoint;
        params.layerOption = IdentifyParameters.LAYER_OPTION_ALL;
        params.tolerance = 5;
        params.returnGeometry = true;
        it.execute(params, function (results) {
            $(results).each(function (i, result) {
                if ($.inArray(result.layerId, lids) === -1) {
                    lids.push(result.layerId);
                    if (result.layerId === 0) {
                        template = new PopupTemplate({title: result.feature.attributes["Street Type"]});
                        result.feature.setInfoTemplate(template);
                        if (popup) {
                            popup.destroy();
                        }
                        popup = new Popup({anchor: 'bottom', titleInBody: false, lineSymbol: sym, highlight: true}, dojo.create("div"));
                        popup.setMap(map);
                        popup.setFeatures([result.feature]);
                        popup.show(e.mapPoint);
                        map.centerAt(e.mapPoint);
                        graphics.clear();
                        graphics.add(new Graphic(result.feature.geometry, sym, null, null));
                    }
                }
            });
        });
    });


}

function createSearch() {
    "use strict";

    window.query_cache = {};

    $(".typeahead").typeahead({
        minLength: 4,
        source: function (query, process) {
            if (query_cache[query]) {
                process(query_cache[query]);
                return;
            }
            if (typeof searching != "undefined") {
                clearTimeout(searching);
                process([]);
            }
            query = query.toUpperCase().replace(" W ", " WEST ").replace(" E ", " EAST ").replace(" N ", " NORTH ").replace(" S ", " SOUTH ");

            var searching = setTimeout(function() {
                return $.ajax({
                    url: config.addressService,
                    dataType: "jsonp",
                    data: {
                        f: "json",
                        where: "UPPER(ADDRESS) LIKE '" + query.toUpperCase() + "%'",
                        returnGeometry: false,
                        outFields: "ADDRESS",
                        orderByFields: "ADDRESS"
                    },
                    success: function (data) {
                        query_cache[query] = data;
                        var options = [];
                        $(data.features).each(function (i, feature) {
                            options.push(feature.attributes.ADDRESS);
                        });
                        return process(options);
                    }
                });
            });
        },
        matcher: function (item) {
            return true;
        },
        updater: function (address) {
            $.ajax({
                url: config.addressService,
                dataType: "jsonp",
                data: {
                    where: "ADDRESS = '" + address + "'",
                    returnGeometry: true,
                    outSr: JSON.stringify(map.spatialReference),
                    f: "json"
                },
                success: function (data) {
                    if (data.features.length > 0) {
                        var point = new esri.geometry.Point(data.features[0].geometry.x, data.features[0].geometry.y, map.spatialReference);
                        map.centerAndZoom(point, 16);
                        map.graphics.clear();
                        map.graphics.add(new esri.Graphic(point, new esri.symbol.PictureMarkerSymbol("img/pin.png", 40, 40)));
                    }
                }
            });
        }
    });
}

function loadLegend() {
    "use strict";
    var legend = null,
        div = null;
    $.ajax({
        url: config.streetTypeService + "/legend",
        dataType: "jsonp",
        data: {
            f: "json"
        },
        success: function (data) {
            $(data.layers).each(function (i, layer) {
                switch (i) {
                case 0:
                    div = $("#legend");
                    legend = $("<ul></ul>").appendTo(div);
                    $(layer.legend).each(function (j, item) {
                        if (item.label.indexOf("Proposed") === -1) {
                            legend.append("<li><img class='legendimg' src='data:image/png;base64," + item.imageData + "'/>" + item.label + "</li>");
                        }
                    });
                    break;
                }
                div.append("<p/><div class='span12'>* dashed lines are proposed</div>");
            });
        }
    });
}

function mapLoaded() {
    "use strict";
    require(["esri/layers/ArcGISDynamicMapServiceLayer","esri/layers/WebTiledLayer", "esri/layers/GraphicsLayer"], function(ArcGISDynamicMapServiceLayer, WebTiledLayer, GraphicsLayer) { 
        var layer = new ArcGISDynamicMapServiceLayer(config.streetTypeService, {opacity: 1});
        map.addLayer(layer);
        layer.setVisibleLayers([0]);

        var wtl = new WebTiledLayer("http://${subDomain}.tile.stamen.com/toner-labels/${level}/${col}/${row}.png",
            {id: "Stamen Toner Labels", subDomains: ['a', 'b', 'c', 'd']});
        map.addLayer(wtl);
        graphics = new GraphicsLayer();
        map.addLayer(graphics);
        map.resize();
    });
}


var listeners = [];


function removeListeners() {
    "use strict";
    $(listeners).each(function (i, listener) {
        dojo.disconnect(listener);
    });
    listeners = [];
}


$(document).ready(function () {
    "use strict";
    init();
});