export const equalize_histogram = (image, channel) => {
	let data = image.data
	let width = image.width
	let halfWidth = width / 2

	// Function to equalize histogram for a specific part of the image
	const processPart = (startX, endX) => {
		// Calculate histogram
		let histogram = new Array(256).fill(0)
		
		for (let y = 0; y < image.height; y++) {
			for (let x = startX; x < endX; x++) {
				let i = (y * width + x) * 4
				const brightness = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3)
				histogram[brightness]++
			}
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
		for (let y = 0; y < image.height; y++) {
			for (let x = startX; x < endX; x++) {
				let i = (y * width + x) * 4
				const brightness = Math.floor((data[i] + data[i + 1] + data[i + 2]) / 3)
				const equalizedValue = cdf[brightness]
				data[i] = data[i + 1] = data[i + 2] = equalizedValue
			}
		}
	}

	
	if (channel === 'AB') {
		// Process left half
		processPart(0, halfWidth)
		// Process right half
		processPart(halfWidth, width)
	} else {
		// Process the whole image
		processPart(0, width)
	}
}
