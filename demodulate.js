import FFT from 'fft.js'
// import FFT from './fft.js'

export const demodulate = (signal, mode) => {

	if (mode === 'abs') {
		return demod_abs(signal)
	} else if (mode === 'cos') {
		return demod_cos(signal)
	} else if (mode === 'hilbertfft') {
		return demod_hilbert_fft(signal)
	}
}

const demod_abs = input => {
	const data = []

	for (let i = 0; i < input.length; i++) {
		data[i] = Math.abs(input[i])
	}

	return data
}

const demod_cos = input => {
	const data = []
	let cnt = 0

	// 2400 is the frequency of the carrier
	const smp_rate = 6240

	// const trig_arg = Math.PI * 2 * 2400.0 / 11025;
	const trig_arg = Math.PI * 2 * 2400.0 / smp_rate

	const cos2 = 2.0 * Math.cos(trig_arg)
	const sin_rg = Math.sin(trig_arg)
	
	for (let c = 1; c < input.length; c++) {
		
		const temp = Math.sqrt(Math.pow(input[c - 1], 2) + Math.pow(input[c], 2) - input[c - 1] * input[c] * cos2)
		data[c] = temp / sin_rg
		if (cnt < 25 ) {
			cnt += 1
		}
	}
	
	//data[0] = data[1]; // as in open-weather
	data[0] = 0 // as in noaa-apt

	return data
}

const demod_hilbert_fft = input => {
	const padded_wav_file = pad_array_fft(input)
	const iq_data = hilbert_fft(padded_wav_file)
	iq_data.length = input.length * 2
	const data = envelope_detection(iq_data)
	return data
}

const pad_array_fft = data => {
	const new_data = [...data]
	const new_length = nearest_upper_pow_2(new_data.length)
	const diff = new_length - new_data.length

	for (let i = 0; i < diff; i++) {
		new_data.push(0)
	}

	return new_data
}

const nearest_upper_pow_2 = v => {
	v--
	v |= v >> 1
	v |= v >> 2
	v |= v >> 4
	v |= v >> 8
	v |= v >> 16
	return ++v
}

const envelope_detection = data => {
	const amp = []
	for (let ii = 0; ii < Math.floor(data.length / 2); ii++) {
		amp[ii] = Math.sqrt(data[2 * ii] ** 2 + data[2 * ii + 1] ** 2)
	}
	return amp
}

const hilbert_fft = data => {
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
	// st_neg_freq is where the negative freqs start in out
	// recall that out and cpxData are arrays of twice the input
	// data array since the values are now complex
	// the 0 Hz complex freqa are in out[0] and out[1]
	// the positive freqs are from out[2] and out[3] up to and
	// including out[len-2] and out[len-1]
	// skip over out[len] and out[len+1]
	// the negative frequeices start at out[len+2] and oit[len+3)
	// and end at out[2*len-2] and out[2*len-1]
	// these negative frequcies are set to zero
	const st_neg_freq = len + 2
	for (let ii = st_neg_freq; ii < len * 2; ++ii) {
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
