const { createCanvas } = require('canvas')
const dsp = require('./dsp')
const FFT = require('./fft')




const finaleRate = 4160
const workRate = 11025


/*
 * Start of our attempt to find the sync start
 */

function generateSyncFrame() {

	const pixelWidth = workRate / finaleRate
	const syncPulseWidth = pixelWidth * 2
	const patternLength = 7 * 2 * syncPulseWidth + 8 * pixelWidth // Total length of the pattern

	let pattern = []

	// Generate the repeating pattern
	for (let i = 0; i < patternLength; i++) {
		// First part of the cycle: 7 repeats of [-1, -1, 1, 1]
		if (i < 7 * 2 * syncPulseWidth) {
			pattern.push((Math.floor(i / syncPulseWidth) % 2 === 0) ? -1 : 1)
		} else {
			// Last part: 8 * pixelWidth of -1
			pattern.push(-1)
		}
	}

	return pattern
}

function findSyncFrames(signal, correlationThreshold = 2) {
	const guard = generateSyncFrame(workRate) // Generate the sync frame pattern based on workRate
	let peaks = [] // To store the index and correlation value of detected peaks
	let correlation = [] // Optional: For debugging or analysis

	// Minimum distance between peaks, dynamically calculated based on the signal characteristics
	// This calculation can be adjusted based on your specific requirements
	const minDistance = Math.floor((1040 * workRate / 11025) * 0.8)

	// Compute the noise level across the signal to dynamically adjust the correlation threshold
	const noiseLevels = calculateNoiseLevels(signal, guard.length)
	let dynamicCorrelationThreshold

	for (let i = 0; i <= signal.length - guard.length; i++) {
		let corr = 0 // Calculate correlation for this position

		for (let j = 0; j < guard.length; j++) {
			corr += signal[i + j] * guard[j]
		}

		correlation.push(corr) // Optional: Collect correlation data for analysis

		// Dynamically adjust correlation threshold based on local noise level
		dynamicCorrelationThreshold = adjustThresholdBasedOnNoise(noiseLevels[i], correlationThreshold)

		// Detect peaks with significant correlation and sufficient distance from the last peak
		if (corr > dynamicCorrelationThreshold && (peaks.length === 0 || i - peaks[peaks.length - 1][0] > minDistance)) {
			peaks.push([i, corr])
		}
	}

	// Refine detected peaks based on additional criteria, if necessary
	peaks = refinePeaks(peaks, signal)

	// Return just the indices of the sync frames, discarding the correlation values
	return peaks.map(peak => peak[0])
}



function calculateNoiseLevels(signal, windowSize) {
	let noiseLevels = []
	for (let i = 0; i < signal.length - windowSize + 1; i++) {
		let window = signal.slice(i, i + windowSize)
		let mean = window.reduce((acc, val) => acc + val, 0) / window.length
		let variance = window.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / window.length
		let stdDev = Math.sqrt(variance)
		noiseLevels.push(stdDev)
	}
	
	// Fill the remaining part of the array to ensure noiseLevels align with signal indices
	let lastComputedNoiseLevel = noiseLevels[noiseLevels.length - 1]
	for (let i = 0; i < windowSize - 1; i++) {
		noiseLevels.push(lastComputedNoiseLevel)
	}
	return noiseLevels
}

function adjustThresholdBasedOnNoise(noiseLevel, baseThreshold) {
	// This is a simple linear adjustment. You may need to tune the scaling factor based on your signal characteristics.
	const scalingFactor = 1.5 // Example scaling factor
	return baseThreshold + noiseLevel * scalingFactor
}

function refinePeaks(peaks, signal) {
	if (peaks.length < 3) return peaks // Not enough data to refine

	// Calculate the average distance between peaks for dynamic thresholding
	let totalDistance = 0
	for (let i = 1; i < peaks.length; i++) {
		totalDistance += (peaks[i][0] - peaks[i - 1][0])
	}
	const avgDistance = totalDistance / (peaks.length - 1)

	// Calculate average correlation value for amplitude comparison
	const avgCorrelation = peaks.reduce((acc, cur) => acc + cur[1], 0) / peaks.length

	return peaks.filter((peak, index, arr) => {
		// Dynamic distance check based on average distance
		const isTooCloseToPrev = index > 0 && (peak[0] - arr[index - 1][0] < avgDistance * 0.8)
		const isTooCloseToNext = index < arr.length - 1 && (arr[index + 1][0] - peak[0] < avgDistance * 0.8)
		
		// Amplitude check against average correlation
		const isAmplitudeOutlier = Math.abs(peak[1] - avgCorrelation) / avgCorrelation > 0.5 // Adjust as necessary

		// Filter out peaks too close to neighbors or with outlier amplitude
		return !isTooCloseToPrev && !isTooCloseToNext && !isAmplitudeOutlier
	})
}

/*
 * End of our attempt to find the sync start
 */







function calcSyncStart() {
	const secs = 360

	// what does that mean in bits of info received?
	// each bit is 0.00024 seconds so multi by 4166.67... i think
	const words = secs * 4166

	return words
}


function createImage(fileBaseName, mode, channel, wavFile, equalize) {


	const numTaps = 50
	const coeffs = dsp.getLowPassFIRCoeffs(11025, 1200, numTaps)

	const sampleRate = wavFile.sampleRate

	let inputWavData = wavToArray(wavFile)

	if (sampleRate !== 11025) {
		inputWavData = changeSampleRate(inputWavData, wavFile.sampleRate, 11025)
	}


	let wavData

	switch (mode) {
	case 'abs': {
		wavData = demodAbs(inputWavData)
		break
	}
	case 'cos': {
		wavData = demodCos(inputWavData)
		break
	}
	case 'hilbertfft': {
		const paddedWavFile = padArrayFFT(inputWavData)
		const IQdata = HilbertFFT(paddedWavFile)
		IQdata.length = inputWavData.length * 2

		wavData = envelopeDetection(IQdata)

		break
	}
	}

	const filtered = filterSamples(wavData, coeffs)
	const normalizedMean = normalizeData(filtered)
	const normalizedData = normalizedMean[0]
	const signalMean = normalizedMean[1]

	const syncFrames = findSyncFrames(normalizedData)

	let syncStart
	if (syncFrames.length > 0) {
		console.log('yes')
		syncStart = syncFrames[0]
	} else {
		console.log('no')
		syncStart = calcSyncStart()
	}




	const startingIndex = convolveWithSync(syncStart, 22050, normalizedData, signalMean).index
	let pixelStart
	let imgWidth

	if (channel === 'A') {
		pixelStart = 0
		imgWidth = 1040
	} else if (channel === 'B') {
		pixelStart = 1040
		imgWidth = 1040
	} else if (channel === 'AB') {
		pixelStart = 0
		imgWidth = 2080
	}

	let lineCount = Math.floor(normalizedData.length / 5513)
	lineCount -= Math.floor(syncStart / 5513)

	const canvas = createCanvas(imgWidth, lineCount)
	const ctx = canvas.getContext('2d')

	const image = ctx.createImageData(imgWidth, lineCount)

	let lineStartIndex = startingIndex
	const downSampler = new dsp.Downsampler(11025, 4160, coeffs)
	
	let thisLineData

	for (let line = 0; line < lineCount; line++) {
		thisLineData = downSampler.downsample(normalizedData.slice(lineStartIndex + 20, lineStartIndex + 5533))

		for (let column = 0; column < imgWidth; column++) {
			const value = thisLineData[pixelStart + column] * 255
			const offset = line * imgWidth * 4 + column * 4
			image.data[offset] = value // Red
			image.data[offset + 1] = value // Green
			image.data[offset + 2] = value // Blue
			image.data[offset + 3] = 255 // Alpha
		}

		const conv = convolveWithSync(lineStartIndex + 5512 - 40, 80, normalizedData, signalMean)
		if (conv.score > 5) {
			lineStartIndex = conv.index
		} else {
			lineStartIndex += 5512
		}
	}

	if (equalize) {
		equalizeHistogram(image)
	}

	ctx.putImageData(image, 0, 0)

	return canvas.toBuffer('image/png')	
}

function equalizeHistogram(image) {
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


function convolveWithSync(start, range, normalizedData, signalMean) {
	const sync = [-1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]

	let maxVal = 0
	let maxIndex = 0

	for (let i = start; i < start + range; i++) {
		let sum = 0
		for (var c = 0; c < sync.length; c++) {
			if (normalizedData) {
				sum += (normalizedData[i + c] - signalMean) * sync[c]				
			}
		}
		if (sum > maxVal) {
			maxVal = sum
			maxIndex = i
		}
	}

	return {
		index: maxIndex,
		score: maxVal,
	}
}

function wavToArray(input) {

	const data = []

	if (input.channelData) {
		const channelData = input.channelData[0]

		for (let i = 0; i < channelData.length; i++) {
			data[i] = channelData[i]
		}

		return data

	} else if (input.dataSamples) {
		
		for (let i = 0; i < input.dataSamples.length; i++) {
			data[i] = input.dataSamples[i]
		}

	}

	return data
}




function changeSampleRate(input, input_rate, output_rate) {

	var data = []

	// ex: 11025 / 48000 = 0.2296875

	// given the existing file at the current rate
	// figure out the desired length of the new array
	var ratio = output_rate / input_rate
	var newLength = Math.floor(input.length * ratio)

	for (var i = 0; i < newLength; i++) {

		var x = Math.floor(map(i, 0, newLength, 0, input.length))

		data.push(input[x])
	}

	return data
}


function map(inputNum, inputMin, inputMax, outputMin, outputMax) {
	return outputMin + (inputNum - inputMin) * (outputMax - outputMin) / (inputMax - inputMin)
}

function filterSamples(input, coeffs) {
	
	const filter = new dsp.FIRFilter(coeffs)

	const f32samples = new Float32Array(input.length)

	for (var i = 0; i < input.length; i++) {
		f32samples[i] = input[i] / 32768
	}

	filter.loadSamples(f32samples)
	var filteredData = new Float32Array(f32samples.length)

	for (let i = 0; i < f32samples.length; i++) {
		filteredData[i] = filter.get(i)
	}

	return filteredData
}


function normalizeData(input) {

	var normalized = []
	var mean = 0

	var maxVal = 0
	var minVal = 1

	for (let i = 0; i < input.length; i++) {
		if (input[i] > maxVal) {
			maxVal = input[i]
		}
		if (input[i] < minVal) {
			minVal = input[i]
		}
	}
	for (let i = 0; i < input.length; i++) {
		normalized[i] = (input[i] - minVal) / (maxVal - minVal)
		mean += normalized[i] // COULD BE WRONG
	}

	mean = mean / input.length

	return [normalized, mean]

}


function demodAbs(input) {
	var data = []

	for (var i = 0; i < input.length; i++) {
		data[i] = Math.abs(input[i])
	}

	return data
}


function demodCos(input) {
	var data = []

	// 2400 is the frequency of the carrier
	var trigArg = Math.PI * 2 * 2400.0 / 11025
	var cos2 = 2.0 * Math.cos(trigArg)
	var sinArg = Math.sin(trigArg)
	for (var c = 1; c < input.length; c++) {
		var temp = Math.sqrt(Math.pow(input[c - 1], 2) + Math.pow(input[c], 2) - input[c - 1] * input[c] * cos2)
		data[c] = temp / sinArg
	}

	data[0] = data[1]

	return data
}


function padArrayFFT(data) {

	var newData = [...data]

	// console.log("newData length is " + newData.length);

	var newLength = nearestUpperPow2(newData.length)

	var diff = newLength - newData.length

	for (var i = 0; i < diff; i++) {
		newData.push(0)
	}

	return newData
}


function nearestUpperPow2(v) {
	v--
	v |= v >> 1
	v |= v >> 2
	v |= v >> 4
	v |= v >> 8
	v |= v >> 16
	return ++v
}

function HilbertFFT(data) {
	// computes the IQ valies for the real data input
	// returns the IQ values in an array with even number
	// elements being the I value and the odd number elements
	// being the Q value.
	// for example out[0] = 1st I value
	//             out[1] = 2nd Q value
	// this uses the fft code from
	//  https://github.com/indutny/fft.js/
	//const FFT = require('/Users/williamliles/fftjs/lib/fft.js');
	// note that data lenght must be equal to a power of 2
	// an erro check should be put here
	const len = data.length
	const f = new FFT(len)
	const out = f.createComplexArray()
	const cpxData = f.createComplexArray()
	f.realTransform(out, data)
	// set negative frequencies to zero
	// stNegFreq is where the negative freqs start in out
	// recall that out and cpxData are arrays of twice the input
	// data array since the values are now complex
	// the 0 Hz complex freqa are in out[0] and out[1]
	// the positive freqs are from out[2] and out[3] up to and
	// including out[len-2] and out[len-1]
	// skip over out[len] and out[len+1]
	// the negative frequeices start at out[len+2] and oit[len+3)
	// and end at out[2*len-2] and out[2*len-1]
	// these negative frequcies are set to zero
	const stNegFreq = len + 2
	for (let ii = stNegFreq; ii < len * 2; ++ii) {
		out[ii] = 0
	}
	// double magnitude of real frequency values
	// since the negative freqs wer set to zero we must recover the
	// energy in them by doubling the magnitude of the positive
	// frequency values
	for (let ii = 2; ii < len; ++ii) {
		out[ii] *= 2.0
	}
	// compute inverse fft
	f.inverseTransform(cpxData, out)
	return cpxData

}

function envelopeDetection(data) {

	const amp = []

	for (let ii = 0; ii < Math.floor(data.length / 2); ii++) {
		amp[ii] = Math.sqrt(data[2 * ii] ** 2 + data[2 * ii + 1] ** 2)
	}

	return amp
}


module.exports = {
	createImage: createImage,
	equalizeHistogram: equalizeHistogram,
}