dojo.addOnLoad(function () {
    dojo.declare("HeatmapLayer", [esri.layers.DynamicMapServiceLayer], {
        /*
	{
		map: <a handle to the map>,
		domNodeId: <an id to the domNode>,
	}
	*/
        // variables
        properties: {},
        heatMap: null,
        // constructor
        constructor: function (properties) {
            dojo.safeMixin(this.properties, properties);
            // map var
            this._map = this.properties.map;
            // last data storage
            this.lastClustered = [];
            // map node
            this.domNode = document.getElementById(this.properties.domNodeId);
            // config
            this.config = {
                element: this.domNode,
                width: this._map.width,
                height: this._map.height,
                radius: 40,
                debug: false,
                visible: true,
                gradient: {
                    0.45: "rgb(000,000,255)",
                    0.55: "rgb(000,255,255)",
                    0.65: "rgb(000,255,000)",
                    0.95: "rgb(255,255,000)",
                    1.00: "rgb(255,000,000)"
                }
            };
            // mix in config for heatmap.js settings
            dojo.safeMixin(this.config, properties.config);
            // create heatmap
            this.heatMap = heatmapFactory.create(this.config);
            // loaded
            this.loaded = true;
            this.onLoad(this);
            // connect on resize
            dojo.connect(this._map, "onResize", this, this.resizeHeatmap);
            // heatlayer div styling
            this.domNode.style.position = 'relative';
            this.domNode.style.display = 'none';
        },
        resizeHeatmap: function (extent, width, height) {
            // set heatmap data size
            this.heatMap.set("width", width);
            this.heatMap.set("height", height);
            // set width and height of container
            this.domNode.style.width = width + 'px';
            this.domNode.style.height = height + 'px';
            // set width and height of canvas element inside of container
            if (this.domNode.children[0]) {
                this.domNode.children[0].width = width;
                this.domNode.children[0].height = height;
            }
            // set atx canvas width and height fix
            var actx = this.heatMap.get("actx");
            actx.canvas.height = height;
            actx.canvas.width = width;
            this.heatMap.set("actx", actx);
            // refresh image and heat map size
            this.refresh();
        },
        // stores heatmap converted data into the plugin which renders it
        storeHeatmapData: function (heatPluginData) {
            // set heatmap data
            this.heatMap.store.setDataSet(heatPluginData);
        },
        // converts parsed data into heatmap format
        convertHeatmapData: function (parsedData) {
            // variables
            var xParsed, yParsed, heatPluginData, dataPoint, screenGeometry;
            // set heat plugin data object
            heatPluginData = {
                max: parsedData.max,
                data: [] // empty data
            };
            // if data
            if (parsedData.data) {
                // for all x values
                for (xParsed in parsedData.data) {
                    // if data[x]
                    if (parsedData.data.hasOwnProperty(xParsed)) {
                        // for all y values and count
                        for (yParsed in parsedData.data[xParsed]) {
                            if (parsedData.data[xParsed].hasOwnProperty(yParsed)) {
                                // convert data point into screen geometry
                                screenGeometry = esri.geometry.toScreenGeometry(this._map.extent, this._map.width, this._map.height, parsedData.data[xParsed][yParsed].dataPoint);
                                // push to heatmap plugin data array
                                heatPluginData.data.push({
                                    x: screenGeometry.x,
                                    y: screenGeometry.y,
                                    count: parsedData.data[xParsed][yParsed].count // count value of x,y
                                });
                            }
                        }
                    }
                }
            }
            // store in heatmap plugin which will render it
            this.storeHeatmapData(heatPluginData);
        },
        // runs through data and calulates weights and max
        parseHeatmapData: function (dataPoints) {
            // variables
            var i, parsedData, dataPoint;
            // if data points exist
            if (dataPoints) {
                // create parsed data object
                parsedData = {
                    max: 0,
                    data: []
                };
                // for each data point
                for (i = 0; i < dataPoints.length; i++) {
                    // create geometry point
                    dataPoint = esri.geometry.Point(dataPoints[i].x, dataPoints[i].y, this._map.spatialReference);
                    // if point is in current extent
                    if (this._map.extent.contains(dataPoint)) {
                        // if array value is undefined
                        if (!parsedData.data[dataPoints[i].x]) {
                            // create empty array value
                            parsedData.data[dataPoints[i].x] = [];
                        }
                        // array value array is undefined
                        if (!parsedData.data[dataPoints[i].x][dataPoints[i].y]) {
                            // create object in array
                            parsedData.data[dataPoints[i].x][dataPoints[i].y] = {};
                            // if count is defined in datapoint
                            if (dataPoints[i].hasOwnProperty('count')) {
                                // create array value with count of count set in datapoint
                                parsedData.data[dataPoints[i].x][dataPoints[i].y].count = dataPoints[i].count;
                            } else {
                                // create array value with count of 0
                                parsedData.data[dataPoints[i].x][dataPoints[i].y].count = 0;
                            }
                        }
                        // add 1 to the count
                        parsedData.data[dataPoints[i].x][dataPoints[i].y].count += 1;
                        // store dataPoint var
                        parsedData.data[dataPoints[i].x][dataPoints[i].y].dataPoint = dataPoint;
                        // if count is greater than current max
                        if (parsedData.max < parsedData.data[dataPoints[i].x][dataPoints[i].y].count) {
                            // set max to this count
                            parsedData.max = parsedData.data[dataPoints[i].x][dataPoints[i].y].count;
                        }
                    }
                }
                // convert parsed data into heatmap plugin formatted data
                this.convertHeatmapData(parsedData);
            }
        },
        // set data function call. same as cluster
        setData: function (dataPoints) {
            // set width/height
            this.resizeHeatmap(null, this._map.width, this._map.height);
            // store points
            this.lastClustered = dataPoints;
            // create clusters and then store them
            this.parseHeatmapData(dataPoints);
            // redraws the heatmap
            this.refresh();
        },
        // clear data function
        clearData: function () {
            // empty heat map
            this.heatMap.clear();
            // empty array
            var empty = [];
            // set data to empty array
            this.setData(empty);
        },
        // get image
        getImageUrl: function (extent, width, height, callback) {
            // create heatmap data using last clustered data
            this.parseHeatmapData(this.lastClustered);
            // image data
            var imageUrl = this.heatMap.get("canvas").toDataURL("image/png");
            // callback
            callback(imageUrl);
        }
    });
});