	//全局变量
	var linerSource = '', lineLayer = '', lineDraw = '', measureSource = '', measureLayer = '', measureDraw = '',
		helpMsg = '',continueLineMsg = '',helpTooltipElement, measureTooltipElement, graticuleLayer = '', layerLogo = '',
		star1 = '', star2 = '', star3 = '', star4 = '', star5 = '', star6 = '', star7 = '', overlay = '', 
		earthquakeCluster = null, hiddenFeature = false;
		
	//-----------------------------------点选部分开始-----------------------------------------

	var style = new ol.style.Style({
	  fill: new ol.style.Fill({
		color: 'rgba(255, 255, 255, 0.6)'
	  }),
	  stroke: new ol.style.Stroke({
		color: '#319FD3',
		width: 1
	  }),
	  text: new ol.style.Text({})
	});
	var raster = new ol.layer.Tile({
		source: new ol.source.OSM()  //初始化地图
	}); 
	var vector = new ol.layer.Vector({  //地图矢量数据
		source: new ol.source.Vector({
			url: './china_diaoyudao.json',
			format: new ol.format.GeoJSON()
		})
	});

	var select = new ol.interaction.Select();

	var translate = new ol.interaction.Translate({
		features: select.getFeatures()
	});

	var layer_logo = new ol.layer.Vector({ //五角星标注展示
		source: new ol.source.Vector()
	});

	var map = new ol.Map({
		interactions: ol.interaction.defaults([
			select,
			translate
		]),
		layers: [raster, vector,layer_logo],
		target: 'map',
		view: new ol.View({
			center: [104.06, 30.67],
			projection: 'EPSG:4326',
			zoom: 4,
			minZoom:4
		})
	});
	var featureOverlay = new ol.layer.Vector({
		source: new ol.source.Vector(),
		map: map,
		style: new ol.style.Style({
			stroke: new ol.style.Stroke({
			  color: '#f00',
			  width: 1
			}),
			fill: new ol.style.Fill({
			  color: 'rgba(255,0,0,0.1)'
			})
		})
	});

	var highlight;
	var displayFeatureInfo = function(pixel) {
	if(hiddenFeature){
		return;
	}
	var feature = map.forEachFeatureAtPixel(pixel, function(feature) {
		return feature;
	});

	var info = document.getElementById('info');
	if (feature) {
		info.innerHTML = feature.getId() + ': ' + feature.get('name');
		$('#info').css({'display':'block'});
	} else {
		info.innerHTML = '&nbsp;';
		$('#info').css({'display':'none'});
	}
	if (feature !== highlight) {
		if (highlight) {
		  featureOverlay.getSource().removeFeature(highlight);
		}
		if (feature) {
		  featureOverlay.getSource().addFeature(feature);
		}
		highlight = feature;
	  }

	};
	map.on('pointermove', function(evt) {
		if (evt.dragging) {
			return;
		}
		var pixel = map.getEventPixel(evt.originalEvent);
		displayFeatureInfo(pixel);
	});
	map.on('click', function(evt) {
		displayFeatureInfo(evt.pixel);
	});

	//------------------------------------点选部分结束-----------------------------------

	//------------------------------------画线部分开始-----------------------------------
	var status = false;
	function drawLine(){
		// 添加一个绘制的线使用的layer
		linerSource = new ol.source.Vector();
		lineLayer = new ol.layer.Vector({
			source: linerSource,
			style: new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: 'red',
					size: 1
				}),
				
			})
		})
		map.addLayer(lineLayer);
		lineDraw = new ol.interaction.Draw({
			type: 'Polygon',
			source: lineLayer.getSource(),    // 注意设置source,存储绘制好的线
			style: new ol.style.Style({            // 设置绘制时的样式
				stroke: new ol.style.Stroke({
					color: 'blue',
					size: 1
				}),
				fill: new ol.style.Fill({
				  color: 'rgba(255,0,0,0.1)'
				})
			})
		});
		
		// 监听线绘制结束事件，获取坐标,添加样式
		lineDraw.on('drawend', function(e){
			status = true;
			var _feature = e.feature;
			_feature.setStyle(new ol.style.Style({
			 stroke: new ol.style.Stroke({
				color: 'blue',
				size: 1
			 }),
			 fill: new ol.style.Fill({
			   color: 'rgba(255,0,0,0.6)'
			 })
			}));
		});
		map.on('click', function (e) {
			var pixel = map.getEventPixel(e.originalEvent);
			var feature = map.forEachFeatureAtPixel(pixel, function (feature, layer) {
				return feature;
			});
			var coordinate = e.coordinate;
			var hdms = ol.coordinate.toStringHDMS(ol.proj.transform(
				coordinate, 'EPSG:3857', 'EPSG:4326'));
			if (feature !== undefined && status) {
				feature.setStyle(new ol.style.Style({
				 stroke: new ol.style.Stroke({
					color: 'blue',
					size: 1
				 }),
				 fill: new ol.style.Fill({
				   color: 'rgba(255,0,0,0.2)'
				 })
				}));
			}
		});
		map.addInteraction(lineDraw);
	}
	//------------------------------------画线部分结束------------------------------------


	//------------------------------------测量距离开始------------------------------------
	function measure(){
		//定义矢量数据源
		var source = measureSource = new ol.source.Vector();
		//定义矢量图层
		var vector = measureLayer = new ol.layer.Vector({
			source: source,
			style: new ol.style.Style({
				fill: new ol.style.Fill({
					color:'rgba(255,255,255,0.2)'
				}),
				stroke: new ol.style.Stroke({
					color: '#e21e0a',
					width:2
				}),
				image: new ol.style.Circle({
					radius: 5,
					fill: new ol.style.Fill({
						color:'#ffcc33'
					})
				})
			})
		});
		//将矢量图层添加到地图中
		map.addLayer(vector);
		//添加比例尺控件
		var scaleLineControl = new ol.control.ScaleLine({
			units: 'metric',
			target: 'scalebar',
			className: 'ol-scale-line'
		});
		map.addControl(scaleLineControl);	 
				 
		//创建一个WGS84球体对象
		var wgs84Sphere = new ol.Sphere(6378137);
		//创建一个当前要绘制的对象
		var sketch = new ol.Feature();
		//创建一个帮助提示信息对象
		var helpTooltip;
		//创建一个测量提示框对象
		var measureTooltipElement;
		//创建一个测量提示信息对象
		var measureTooltip;
		//继续绘制多边形的提示信息
		var continuePolygonMsg = '点击继续';
		//继续绘制线段的提示信息
		continueLineMsg = '点击继续画线';
				 
		//鼠标移动触发的函数
		var pointerMoveHandler = function (evt) {
			//如果是平移地图则直接结束
			if (evt.dragging) {
				return;
			}
			//帮助提示信息
			helpMsg = '点击画测量线';
				 
			if (sketch) {
				//获取绘图对象的几何要素
				var geom = sketch.getGeometry();
				//如果当前绘制的几何要素是多边形，则将绘制提示信息设置为多边形绘制提示信息
				if (geom instanceof ol.geom.Polygon) {
					helpMsg = continuePolygonMsg;
				} else if (geom instanceof ol.geom.LineString) {
					helpMsg = continueLineMsg;
				}
			}
			//设置帮助提示要素的内标签为帮助提示信息
			helpTooltipElement.innerHTML = helpMsg;
			//设置帮助提示信息的位置
			helpTooltip.setPosition(evt.coordinate);
			//移除帮助提示要素的隐藏样式
			$(helpTooltipElement).removeClass('hidden');
		};	 
		//触发pointermove事件
		map.on('pointermove', pointerMoveHandler);
				 
		//当鼠标移除地图视图的时为帮助提示要素添加隐藏样式
		$(map.getViewport()).on('mouseout', function () {
			$(helpTooltipElement).addClass('hidden');
		});
				 
		//获取大地测量复选框
		var geodesicCheckbox = document.getElementById('geodesic');
		//获取类型
		var typeSelect = document.getElementById('type');
		//定义一个交互式绘图对象
		var draw;
				 
		//添加交互式绘图对象的函数
		function addInteraction() {
			// 获取当前选择的绘制类型
			var type = typeSelect.value == 'area' ? 'Polygon' : 'LineString';
			//创建一个交互式绘图对象
			draw = new ol.interaction.Draw({
				//绘制的数据源
				source: source,
				//绘制类型
				type: type,
				//样式
				style: new ol.style.Style({
					fill: new ol.style.Fill({
						color:'rgba(255,255,255,0.2)'
					}),
					stroke: new ol.style.Stroke({
						color: 'rgba(0,0,0,0.5)',
						lineDash: [10, 10],
						width:2
					}),
					image: new ol.style.Circle({
						radius: 5,
						stroke: new ol.style.Stroke({
							color:'rgba(0,0,0,0.7)'
						}),
						fill: new ol.style.Fill({
							color: 'rgba(255,255,255,0.2)'
						})
					})
				})
			});
			measureDraw = draw;
			//将交互绘图对象添加到地图中
			map.addInteraction(draw);
				 
			//创建测量提示框
			createMeasureTooltip();
			//创建帮助提示框
			createHelpTooltip();
				 
			//定义一个事件监听
			var listener;
			//定义一个控制鼠标点击次数的变量
			var count = 0;
			//绘制开始事件
			draw.on('drawstart', function (evt) {
				sketch = evt.feature;
				//提示框的坐标
				var tooltipCoord = evt.coordinate;
				//监听几何要素的change事件
				 
				listener = sketch.getGeometry().on('change', function (evt) {
					//获取绘制的几何对象
					var geom = evt.target;
					//定义一个输出对象，用于记录面积和长度
					var output;
					if (geom instanceof ol.geom.Polygon) {
						map.removeEventListener('singleclick');
						map.removeEventListener('dblclick');
						//输出多边形的面积
						output = formatArea(geom);
						//获取多变形内部点的坐标
						tooltipCoord = geom.getInteriorPoint().getCoordinates();
					} else if (geom instanceof ol.geom.LineString) {
						//输出多线段的长度
						output = formatLength(geom);
						//获取多线段的最后一个点的坐标
						tooltipCoord = geom.getLastCoordinate();
					}
					
					//设置测量提示框的内标签为最终输出结果
					measureTooltipElement.innerHTML = output;
					//设置测量提示信息的位置坐标
					measureTooltip.setPosition(tooltipCoord);
				});
				
				//地图单击事件
				map.on('singleclick', function (evt) {
					//设置测量提示信息的位置坐标，用来确定鼠标点击后测量提示框的位置
					measureTooltip.setPosition(evt.coordinate);
					//如果是第一次点击，则设置测量提示框的文本内容为起点
					if (count == 0) {
						measureTooltipElement.innerHTML = "起点";
					}
				   //根据鼠标点击位置生成一个点
					var point = new ol.geom.Point(evt.coordinate);
					//将该点要素添加到矢量数据源中
					source.addFeature(new ol.Feature(point));
					//更改测量提示框的样式，使测量提示框可见
					measureTooltipElement.className = 'tooltip tooltip-static';
					//创建测量提示框
					createMeasureTooltip();
					//点击次数增加
					count++;
				});
				 
				//地图双击事件
				map.on('dblclick', function (evt) {
					//根据
					var point = new ol.geom.Point(evt.coordinate);
					source.addFeature(new ol.Feature(point));
				});
			}, this);
			//绘制结束事件
			draw.on('drawend', function (evt) {
				count = 0;
				//设置测量提示框的样式
				measureTooltipElement.className = 'tooltip tooltip-static';
				//设置偏移量
				measureTooltip.setOffset([0, -7]);
				//清空绘制要素
				sketch = null;
				//清空测量提示要素
				measureTooltipElement = null;
				//创建测量提示框
				createMeasureTooltip();
				//移除事件监听
				ol.Observable.unByKey(listener);
				//移除地图单击事件
				map.removeEventListener('singleclick');
			}, this);
		}
		//创建帮助提示框
		function createHelpTooltip() {
			//如果已经存在帮助提示框则移除
			if (helpTooltipElement) {
				helpTooltipElement.parentNode.removeChild(helpTooltipElement);
			}
			//创建帮助提示要素的div
			helpTooltipElement = document.createElement('div');
			//设置帮助提示要素的样式
			helpTooltipElement.className = 'tooltip hidden';
			//创建一个帮助提示的覆盖标注
			helpTooltip = new ol.Overlay({
				element: helpTooltipElement,
				offset: [15, 0],
				positioning:'center-left'
			});
			//将帮助提示的覆盖标注添加到地图中
			map.addOverlay(helpTooltip);
		}
		//创建测量提示框
		function createMeasureTooltip() {
			//创建测量提示框的div
			measureTooltipElement = document.createElement('div');
			measureTooltipElement.setAttribute('id','lengthLabel');
			//设置测量提示要素的样式
			measureTooltipElement.className = 'tooltip tooltip-measure';
			//创建一个测量提示的覆盖标注
			measureTooltip = new ol.Overlay({
				element: measureTooltipElement,
				offset: [0, -15],
				positioning:'bottom-center'
			});
			//将测量提示的覆盖标注添加到地图中
			map.addOverlay(measureTooltip);
		}
		//测量类型发生改变时触发事件
		typeSelect.onchange = function () {
			//移除之前的绘制对象
			map.removeInteraction(draw);
			//重新进行绘制
			addInteraction();
		};
				 
		//格式化测量长度
		var formatLength = function (line) {
			//定义长度变量
			var length;
			//如果大地测量复选框被勾选，则计算球面距离
			if (geodesicCheckbox.checked) {
				//获取坐标串
				var coordinates = line.getCoordinates();
				//初始长度为0
				length = 0;
				//获取源数据的坐标系
				var sourceProj = map.getView().getProjection();
				//进行点的坐标转换
				for (var i = 0; i < coordinates.length - 1; i++) {
					//第一个点
					var c1 = ol.proj.transform(coordinates[i], sourceProj, 'EPSG:4326');
					//第二个点
					var c2 = ol.proj.transform(coordinates[i + 1], sourceProj, 'EPSG:4326');
					//获取转换后的球面距离
					length += wgs84Sphere.haversineDistance(c1,c2);
				}
			} else {
				//计算平面距离
				length = Math.round(line.getLength() * 100) / 100;
			}
			//定义输出变量
			var output;
			//如果长度大于1000，则使用km单位，否则使用m单位
			if (length > 1000) {
				output = (Math.round(length / 1000 * 100) / 100) + ' ' + 'km'; //换算成KM单位
			} else {
				output = (Math.round(length * 100) / 100) + ' ' + 'm'; //m为单位
			}
			return output;
		};
				 
		//格式化测量面积
		var formatArea = function (polygon) {
			//定义面积变量
			var area;
			//如果大地测量复选框被勾选，则计算球面面积
			if (geodesicCheckbox.checked) {
				//获取初始坐标系
				var sourceProj = map.getView().getProjection();
				//克隆该几何对象然后转换坐标系
				var geom = polygon.clone().transform(sourceProj, 'EPSG:4326');
				//获取多边形的坐标系
				var coordinates = geom.getLinearRing(0).getCoordinates();
				//获取球面面积
				area = Math.abs(wgs84Sphere.geodesicArea(coordinates));
			} else {
				//获取平面面积
				area = polygon.getArea();
			}
			//定义输出变量
			var output;
			//当面积大于10000时，转换为平方千米，否则为平方米
			if (area > 10000) {
				output = (Math.round(area/1000000*100)/100) + ' ' + 'km<sup>2</sup>';
			} else {
				output = (Math.round(area*100)/100) + ' ' + 'm<sup>2</sup>';
			}
			return output;
		};
		//添加交互绘图对象
		addInteraction();
	}
	//------------------------------------测量距离结束------------------------------------

	//------------------------------------网格线开始--------------------------------------
	function drawGrid(){
		graticuleLayer = new ol.Graticule({
			strokeStyle: new ol.style.Stroke({
				color: 'rgba(12, 12, 12, 0.8)',
				width: 0.6
			}),
			targetSize: 80
		});
		graticuleLayer.setMap(map);
	}
	//------------------------------------网格线结束--------------------------------------

	//------------------------------------图标标注开始------------------------------------

	function drawLogo(){
		// 添加多个五角星标注
		drawStar(star1, 1, [104.06, 30.67]);
		drawStar(star2, 2, [116, 39]);
		drawStar(star3, 3, [91, 29]);
		drawStar(star4, 4, [120, 30]);
		drawStar(star5, 5, [110, 20]);
		drawStar(star6, 6, [87, 43]);
		drawStar(star7, 7, [123, 50]);
	}
	function drawStar(star, num, point){
		var _star = '';
		_star = new ol.Feature({
			geometry: new ol.geom.Point(point)
		});
		_star.setStyle(new ol.style.Style({
			image: new ol.style.RegularShape({
			  points: 5,    // 顶点个数
			  radius1: 20, // 外圈大小
			  radius2: 10, // 内圈大小
			  stroke: new ol.style.Stroke({ // 设置边的样式
				  color: 'yellow',
				  size: 4
			  }),
			  fill: new ol.style.Fill({ // 设置五星填充样式
				  color: 'red'
			  })
			})
		}));
		switch(num){
			case 1:
				star1 = _star;
				break;
			case 2:
				star2 = _star;
				break;
			case 3:
				star3 = _star;
				break;
			case 4:
				star4 = _star;
				break;
			case 5:
				star5 = _star;
				break;
			case 6:
				star6 = _star;
				break;
			case 7:
				star7 = _star;
				break;
		}
		layer_logo.getSource().addFeature(_star);
	}
	//------------------------------------图标标注结束------------------------------------

	//------------------------------------展示弹窗开始------------------------------------
	function drawPop(){
	let container = document.getElementById('popup');
	let content = document.getElementById('popup-content');
	let closer = document.getElementById('popup-closer'); 
	// 要素信息框
	overlay = new ol.Overlay({
		element: document.getElementById('popup'),
		autoPan: true,
		autoPanAnimation: {
			duration: 250
		}
	});
	map.on('click', function (evt) {
		var pixel = map.getEventPixel(evt.originalEvent);
		var feature = map.forEachFeatureAtPixel(pixel, function (feature, layer) {
			return feature;
		});
		var coordinate = evt.coordinate;
		var hdms = ol.coordinate.toStringHDMS(ol.proj.transform(
			coordinate, 'EPSG:3857', 'EPSG:4326'));
		if (feature !== undefined) {
			content.innerHTML = '<p>你点击的坐标是：</p><code>' + hdms + '</code><p>这里属于：' + feature.get('name') + '</p>';
		}
		else {
			content.innerHTML = '<p>你点击的坐标是：</p><code>' + hdms + '</code><p>这里是大海！</p>';
		}
		if(overlay){
			overlay.setPosition(coordinate);
			map.addOverlay(overlay);
		}
	});

	/** 
	 * 隐藏弹出框的函数 
	 */
	closer.onclick = function () {
		if(overlay){
			overlay.setPosition(undefined);
		}
		closer.blur();
		return false;
	};
	}
	//------------------------------------展示弹窗结束------------------------------------
	
	//------------------------------------聚合点开始--------------------------------------
	
	function drawPoly(){
		// 初始化聚集要素的半径
		let maxFeatureCount;
		let calculateClusterInfo = (resolution) => {
			maxFeatureCount = 0;
			let features = earthquakeCluster.getSource().getFeatures();
			let feature, radius;
			for (let i = features.length - 1; i >= 0; i--) {
				feature = features[i];
				let originalFeatures = feature.get('features');
				let extent = ol.extent.createEmpty();
				let j = (void 0), jj = (void 0);
				for (let j = 0, jj = originalFeatures.length; j<jj; ++j) {
					ol.extent.extend(extent, originalFeatures[j].getGeometry().getExtent());
				}
				maxFeatureCount = Math.max(maxFeatureCount, jj);
				radius = 0.15 * (ol.extent.getWidth(extent) + ol.extent.getHeight(extent)) / resolution;
				feature.set('radius', radius);
			}
		}

		// 样式函数，对每个feature返回一个样式
		let currentResolution;
		let styleFunction = (feature, resolution) => {
			if (resolution != currentResolution) {
				calculateClusterInfo(resolution);
				currentResolution = resolution;
			}
			let style;
			let size = feature.get('features').length;
			if (size > 1) {
				style = new ol.style.Style({
					image: new ol.style.Circle({
						radius: feature.get('radius'),
						fill: new ol.style.Fill({
							color: [255, 153, 0]
						})
					}),
					text: new ol.style.Text({
						text: size.toString(),
						fill: new ol.style.Fill({
							color: '#fff'
						}),
						stroke: new ol.style.Stroke({
							color: 'rgba(0, 0, 0, 0.6)',
							width: 3
						})
					})
				})
			} else {
				// 每个地震点的默认样式
				style = new ol.style.Style({
					image: new ol.style.Circle({
						radius: 3,
						fill: new ol.style.Fill({
							color: 'rgb(255, 0, 0)'
						})
					})
				});
			}
			return style;
		}

		// 聚类图层
		earthquakeCluster = new ol.layer.Vector({
			source: new ol.source.Cluster({
				distance: 80,   // 聚类阈值，当两点间距离小于20，便聚类为一个点
				source: new ol.source.Vector({
					format: new ol.format.GeoJSON(),
					url: './all_month.geojson'
				})
			}),
			style: styleFunction
		});
	}
	//------------------------------------聚合点结束--------------------------------------
	
	//清除所有要素
	function clear(_this){
		status = false;
		hiddenFeature = true;
		_this.siblings().removeClass('span-active');
		_this.addClass('span-active');
	}
	$('.clear').click(function(){
		hiddenFeature = false;
		$(this).siblings().removeClass('span-active');
		$(this).addClass('span-active');
		removeAllFeatures('all');
	})
	$('.draw-line').click(function(){
		clear($(this));
		drawLine();
	})
	$('.measure-line').click(function(){
		$('#menu').css('display','block');
		clear($(this));
		measure();
	})
	$('.draw-grid').click(function(){
		clear($(this));
		drawGrid();
	})
	$('.draw-logo').click(function(){
		clear($(this));
		drawLogo();
	})
	$('.draw-poly').click(function(){
		clear($(this));
		drawPoly();
		map.addLayer(earthquakeCluster);
	})
	$('.draw-pop').click(function(){
		clear($(this));
		drawPop();
	})
	
	//清除元素
	function removeAllFeatures(type) {
		if(linerSource){
			linerSource.clear();
			map.removeLayer(lineLayer);
			map.removeInteraction(lineDraw);
		}
		if(measureSource){
			$('#menu').css('display','none');
			measureSource.clear();
			map.removeLayer(measureLayer);
			map.removeInteraction(measureDraw);
			if (helpTooltipElement) {
				helpTooltipElement.parentNode.removeChild(helpTooltipElement);
				helpTooltipElement = '';
			}
			if($('.ol-overlaycontainer-stopevent').length>0){
				$('.ol-overlaycontainer-stopevent')[0].innerHTML = '';
			}
		}
		if(graticuleLayer){
			window.location.reload(); //清除网格暂时没有方法
		}
		if(star1){
			layer_logo.getSource().removeFeature(star1); 
			layer_logo.getSource().removeFeature(star2); 
			layer_logo.getSource().removeFeature(star3); 
			layer_logo.getSource().removeFeature(star4); 
			layer_logo.getSource().removeFeature(star5); 
			layer_logo.getSource().removeFeature(star6); 
			layer_logo.getSource().removeFeature(star7); 
			star1 = star2 = star3 = star4 = star5 = star6 = star7 = '';
		}
		if(overlay){
			overlay = '';
		}
		if(earthquakeCluster){
			map.removeLayer(earthquakeCluster);
		}
	}