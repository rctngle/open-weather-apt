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