// import * as d3 from 'd3'

export const equalizeHistogram = image => {
	let data = image.data

	// Calculate histogram
	let histogram = new Array(256).fill(0)
		
	for (let i = 0; i < data.length; i += 4) {
		const brightness = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3)
		histogram[brightness]++
	}

	// Calculate cumulative distribution function (CDF)
	let cdf = [...histogram]
	for (let i = 1; i < cdf.length; i++) {
		cdf[i] += cdf[i - 1]
	}

	// Normalize the CDF
	const cdfMin = cdf.find((value) => value !== 0)
	const cdfMax = cdf[cdf.length - 1]
	for (let i = 0; i < cdf.length; i++) {
		cdf[i] = ((cdf[i] - cdfMin) / (cdfMax - cdfMin)) * 255
	}

	// Map the old values to the new values
	for (let i = 0; i < data.length; i += 4) {
		const brightness = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3)
		const equalizedValue = cdf[brightness]
		data[i] = data[i + 1] = data[i + 2] = equalizedValue
	}

}

/*
	
// Alternate equalization function
// https://medium.com/planet-os/better-color-palettes-with-histogram-equalization-in-d3-js-ea6bff119128
// https://blocks.roadtolarissa.com/biovisualize/c31c5eb3bf1c5a72bde9

export const equalizeHistogram = image => {

	var colorScales = {
		'linearBlackAndWhite': function(values) {
			return d3.scale.linear()
				.domain(d3.extent(values))
				.range(['#000', '#fff'])
		},
		'histogramEqualize': function(values){
			var buckets = 100
			var quantiles = d3.scaleQuantile()
				.domain(values)
				.range(d3.range(buckets))
				.quantiles()

			var stopCount = quantiles.length
			var linearScale = d3.scaleLinear()
				.domain([0, stopCount - 1])
				.range([d3.rgb('rgb(0, 0, 0)'), d3.rgb('rgb(255, 255, 255)')])
			
			var grayScale = d3.range(stopCount).map(function(d){
				return linearScale(d)
			})

			return d3.scaleLinear().domain(quantiles).range(grayScale)
		}
	}

	var rasterData = []
	for(let j = 0; j < (image.data.length / 4); j++){
		var brightness = d3.lab(d3.rgb(image.data[j * 4], 
			image.data[j * 4 + 1], 
			image.data[j * 4 + 2])).l
		rasterData.push(image.data[j * 4] === 0 ? null : brightness)
	}

	var scale = colorScales.histogramEqualize(rasterData)

	for(let j = 0; j < rasterData.length; j++){
		var scaledColor = scale(rasterData[j])
		var color = d3.rgb(scaledColor)
		image.data[j * 4] = color.r
		image.data[j * 4 + 1] = color.g
		image.data[j * 4 + 2] = color.b
		image.data[j * 4 + 3] = 255
	}

}
*/