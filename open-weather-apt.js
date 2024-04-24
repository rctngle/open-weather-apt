const fs = require('fs')
const wav = require('node-wav')
const waveResampler = require('wave-resampler')

const DSP = require('dsp.js')
const dsp = require('./dsp')
const FFT = require('fft.js')

const SAMPLE_RATE = 12480 // 6240

const createImage = (buffer, mode, channel, equalize) => {

	console.log('bessel_i0 test', bessel_i0(2.116625))

	// resample
	const resampled = resampleWav(buffer)

	// to array
	let signal = wavToArray(resampled)

	// high pass and low pass filters
	signal = bandpassFilter(signal)	

	// demodulate
	signal = demodulate(mode, signal)
	
	// filter sample
	signal = filterSamples(signal)

	const normalizedMean = normalizeData(signal)
	signal = normalizedMean[0]
		
}

const resampleWav = buffer => {
	const result = wav.decode(buffer)
	const resampledSamples = waveResampler.resample(result.channelData[0], result.sampleRate, SAMPLE_RATE)	

	const resampledBuffer = wav.encode([resampledSamples], {
		sampleRate: SAMPLE_RATE,
		float: false, // Use 32-bit float if your data is in float format
		bitDepth: 16 // Adjust bit depth according to your needs
	})

	const resampled = wav.decode(resampledBuffer)

	fs.writeFileSync('wav-resampled.wav', resampledBuffer)

	return resampled
}

const getImageWidth = channel => {
	if (channel === 'A') {
		return 1040
	} else if (channel === 'B') {
		return 1040
	} else if (channel === 'AB') {
		return 2080
	}
}

const getPixelStart = channel => {
	if (channel === 'A') {
		return 0
	} else if (channel === 'B') {
		return 1040
	} else if (channel === 'AB') {
		return 0
	}
}

const filterSamples = signal => {

	const numTaps = 50
	const coeffs = dsp.getLowPassFIRCoeffs(SAMPLE_RATE, 1200, numTaps)
	const filter = new dsp.FIRFilter(coeffs)

	const f32samples = new Float32Array(signal.length)

	for (var i = 0; i < signal.length; i++) {
		f32samples[i] = signal[i] / 32768
	}

	filter.loadSamples(f32samples)
	var filteredData = new Float32Array(f32samples.length)

	for (let i = 0; i < f32samples.length; i++) {
		filteredData[i] = filter.get(i)
	}

	return filteredData

}


const normalizeData = input => {

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


const wavToArray = input => {

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

const bandpassFilter = signal => {

	// Create the highpass filter for 300 Hz
	const highPassFilter = new DSP.IIRFilter(DSP.HIGHPASS, 300, 1, SAMPLE_RATE)
	
	// Create the lowpass filter for 4800 Hz
	const lowPassFilter = new DSP.IIRFilter(DSP.LOWPASS, 4800, 1, SAMPLE_RATE)
	
	// Process the signal with the highpass filter
	highPassFilter.process(signal)

	// Process the result of the highpass filter with the lowpass filter
	lowPassFilter.process(signal)

	return signal
}

const demodulate = (mode, signal) => {
	if (mode === 'abs') {
		return demodAbs(signal)
	} else if (mode === 'cos') {
		return demodCos(signal)
	} else if (mode === 'hilbertfft') {
		return demodHilbertFFT(signal)
	}
}


const demodAbs = input => {
	var data = []

	for (var i = 0; i < input.length; i++) {
		data[i] = Math.abs(input[i])
	}

	return data
}

const demodCos = input => {
	var data = []

	// 2400 is the frequency of the carrier
	var trigArg = Math.PI * 2 * 2400.0 / SAMPLE_RATE
	var cos2 = 2.0 * Math.cos(trigArg)
	var sinArg = Math.sin(trigArg)
	for (var c = 1; c < input.length; c++) {
		var temp = Math.sqrt(Math.pow(input[c - 1], 2) + Math.pow(input[c], 2) - input[c - 1] * input[c] * cos2)
		data[c] = temp / sinArg
	}

	data[0] = data[1]

	return data
}

const demodHilbertFFT = input => {
	const paddedWavFile = padArrayFFT(input)
	const IQdata = HilbertFFT(paddedWavFile)
	IQdata.length = input.length * 2
	const data = envelopeDetection(IQdata)
	return data
}

const padArrayFFT = data => {

	const newData = [...data]
	const newLength = nearestUpperPow2(newData.length)
	const diff = newLength - newData.length

	for (let i = 0; i < diff; i++) {
		newData.push(0)
	}

	return newData
}

const nearestUpperPow2 = v => {
	v--
	v |= v >> 1
	v |= v >> 2
	v |= v >> 4
	v |= v >> 8
	v |= v >> 16
	return ++v
}

const envelopeDetection = data => {
	const amp = []
	for (let ii = 0; ii < Math.floor(data.length / 2); ii++) {
		amp[ii] = Math.sqrt(data[2 * ii] ** 2 + data[2 * ii + 1] ** 2)
	}
	return amp
}

const HilbertFFT = data => {
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

const bessel_i0 = x => {
	//
	//  bessel.js
	//
	//
	//  Created by bill_liles on 4/23/24.
	// adapted from noaa-apt misc.js
	// https://github.com/martinber/noaa-apt
	//

	/// Lookup table for numbers used in `bessel_i0()`
	///
	/// 1 / (n! * 2^n)^2

	const BESSEL_TABLE = [
		1.0,
		0.25,
		0.015625,
		0.00043402777777777775,
		6.781684027777777e-06,
		6.781684027777778e-08,
		4.709502797067901e-10,
		2.4028075495244395e-12,
		9.385966990329842e-15,
		2.896903392077112e-17,
		7.242258480192779e-20,
		1.4963343967340453e-22,
		2.5978027721077174e-25,
		3.842903509035085e-28,
		4.9016626390753635e-31,
		5.4462918211948485e-34,
		5.318644356635594e-37,
		4.60090342269515e-40,
		3.5500798014623073e-43,
		2.458504017633177e-46,
	]

	/// First Kind modified Bessel function of order zero.
	///
	/// From this
	/// [post](https://dsp.stackexchange.com/questions/37714/kaiser-window-approximation/37715#37715).

	var result = 0.
	var limit = 8
	
	for (let k = limit; k > 0; k--) {
		result += BESSEL_TABLE[k]
		result *= x**2
	}
	
	return result + 1.0
}

module.exports = {
	createImage: createImage,
}

