/*
 * filters.js
 * to make and run filters for open-weather
 *
 * Created by bill_liles on 4/20/24.
 *
 * this is a rewrite of filters.rust and dsp.rust as used by noaa-apt at
 * https://github.com/martinber/noaa-apt
 *
 * Filter and then resample.
 *
 * Does both things at the same time, so it's faster than calling `filter()`
 * and then resampling. Make sure that the filter prevents aliasing.
 *
 * The filter should have the frequencies referenced to the `input_rate`.
 *
 * High-level function for decoding APT.
 * Final signal sample rate.
 *
 */


import {
	Rate,
} from './freqrate.js'

export function resample_with_filter(signal, input_rate, output_rate, filt) {

	if (output_rate.get_hz() == 0) {
		console.log('resample_with_filter Cant resample to 0Hz')
		throw new Error()
	}
	console.log(' resample with filter in %d out %d ', input_rate.get_hz(), output_rate.get_hz())
	
	const gcdv = gcd(input_rate.get_hz(), output_rate.get_hz())
	console.log('gcd value %d', gcdv)
	
	// Note I use L and M instead of lowercase l and m as in NOAA-APT
	// The reason is the lowercase l looks to similar to the number 1.
	const L = output_rate.get_hz() / gcdv // interpolation factor
	const M = input_rate.get_hz() / gcdv // decimation factor

	let result

	if (L > 1) {
		// If we need interpolation
		// Reference the frequencies to the rate we have after interpolation
		const interpolated_rate = new Rate(L * input_rate.get_hz())
		console.log(' interpolated_rate %d L %d M %d', interpolated_rate.get_hz(), L, M)

		filt.resample(input_rate, interpolated_rate)
		const coeff = filt.design()

		result = fast_resampling(signal, L, M, coeff, input_rate)

	} else {

		// let filtered = filter(signal, filt)
		// result = decimate(filtered, m)

	}

	return result
}

/*
 * Resample a signal using a given filter.
 *
 * Low-level function used by `resample_with_filter`.
 *
 * I expect you to read this while looking at the diagram on the documentation
 * to figure out what the letters mean.
 *
 * Resamples by expansion by `l`, filtering and then decimation by `m`. The
 * expansion is equivalent to the insertion of `l-1` zeros between samples.
 *
 * The given filter coefficients should be designed for the signal after
 * expansion by `l`, so you might want to divide every frequency by `l` when
 * designing the filter.
 *
 * I've tried to make it faster several times, that's why it's so ugly. It's
 * much more efficient than expanding, filtering and decimating, because skips
 * computed values that otherwise would be dropped on decimation.
 *
 * Should be careful because it's easy to overflow usize when on 32 bits
 * systems. Specifically the variables that can overflow are:
 * `interpolated_len`, `n`, `t`.
 */

function fast_resampling( signal, L, M, coeff, input_rate) {

	// Check the diagram on the documentation to see what the letters mean

	// Length that the interpolated signal should have, as u64 because this can
	// easily overflow if usize is 32 bits long
	console.log('in fast resampling')
	const interpolated_len = signal.length * L

	// Length of the output signal, this should fit in 32 bits anyway.
	const output_len = Math.floor(interpolated_len / M)

	const output = new Array(output_len)
	console.log('input_rate %d l %d m %d', input_rate.get_hz(), L, M)
	console.log('interpolated_len %d signal len %d output len %d', interpolated_len, signal.length, output_len)

	// Save expanded and filtered signal if we need to export that step
	const expanded_filtered = new Array(L)
	console.log('expanded_filtered len %d', expanded_filtered.length)
	// note that context.export_resample_filtering is false
	/*
	let mut expanded_filtered = if context.export_resample_filtered {
		// Very likely to overflow usize on 32 bits systems
		match usize::try_from(interpolated_len) {
			Ok(l) => Vec::with_capacity(l),
			Err(_) => {
				error!('Expanded filtered signal can't fit in memory, skipping step');
				context.export_resample_filtered = false;
				Vec::new() // Not going to be used
			}
		}
	} else {
		Vec::new() // Not going to be used
	};
	*/
	// Filter delay in the n axis, half of filter width
	const offset = Math.floor((coeff.length - 1) / 2)

	let n // Current working n

	let t = offset // Like n but fixed to the current output
	// sample to calculate
	console.log('while begin offset %d t %d ', offset, t)
	
	// Iterate over each output sample
	let idx = 0
	while (t < interpolated_len) {
		// Find first n inside the window that has a input sample that I
		// should multiply with a filter coefficient
		if (t > offset) {
			n = t - offset // Go to n at start of filter
			// not sure if this if statement does the match stmt correctly
			if ( n % L != 0 ) {
				n += L - ( n % L)
			} 
		} else {
			// In this case the first sample in window is located at 0
			n = 0
		}

		// Loop over all n inside the window with input samples and
		// calculate products
		
		let sum = 0.
		let  x = Math.floor(n / L) // Current input sample
		while (n <= t + offset) {
			// Check if there is a sample in that index, in case that we
			// use an index bigger that signal.len()
			/*
			if let Some(sample) = signal.get(x as usize) {
				// n+offset-t is equal to j
				sum += coeff[(n + offset - t) as usize] * sample;
			}
			*/
			if (x < signal.length) {
				sum += coeff[n + offset -t] * signal[x]
				/*
				console.log('frs while x %d n %d t %d offset %d coeff %f sample %f', x, n, t, offset, coeff[n + offset - t], signal[x]);
				if(cnt > 20) {throw new Error('Something went badly wrong!');}
				cnt += 1;
				*/
				
			}
			x += 1
			n += L
		}

		// note that context.export_resample_filtering is false
		/*
		if context.export_resample_filtered {
			// Iterate over every sample on the n axis, inefficient because we
			// only need to push to `output` the samples that would survive
			// a decimation.
			expanded_filtered[idx_ef] = sum;
			t += 1;
			if t % m == 0 {
				output[idx] = sum;
				idx += 1;
			}
		} else {
			// Iterate over the samples that would survive a decimation.
			output[idx] = sum;
			idx += 1;
			t += m; // Jump to next output sample
		}
		*/
		// Iterate over the samples that would survive a decimation.
		output[idx] = sum
		//console.log('fsr idx %d sum %f', idx, sum);
		idx += 1
		/*
		cnt += 1;
		if (cnt > 20) {throw new Error('Something went badly wrong!');}
		*/
		t += M // Jump to next output sample

	}
	//console.log(output);
	return output
}


// Decimate withoug filtering
// The signal should be accordingly bandlimited previously to avoid aliasing
/*
function decimate(signal, M) {
	const decimated = new Array(Math.floor(signal.length / M))
	for (let idx = 0; idx < decimated.length; idx++) {
		decimated[idx] = signal[idx * M]
	}
	return decimated
}
*/

// eed GCD function. This method is simple and works
function gcd(a, b) {
	if (b == 0) {
		return a
	}
	return gcd(b, a % b)
}

/*
 * below is from martinber and modified for js
 * changed to js class style
 * Filter and then resample.
 *
 * Lowpass and DC removal FIR filter, windowed by a kaiser window.
 *
 * Attenuation in positive decibels. It's actually a bandpass filter so has two
 * transition bands, one is the same transition band that `lowpass()` has:
 * `cutout - delta_w / 2` to `cutout + delta_w / 2`. The other transition band
 * goes from `0` to `delta_w`.
 */

export class LowpassDcRemoval {
	constructor (cutout, atten, delta_w) {
		this.cutout = cutout
		this.atten = atten
		this.delta_w = delta_w
	}

	//Filter for LowpassDcRemoval
	design() {
		console.log('cutout %f atten %f delta_w %f ', this.cutout.get_pi_rad(), this.atten,  this.delta_w.get_pi_rad())
	
		const win = kaiser(this.atten, this.delta_w)
	
		if (win.length % 2 == 0) {
			console.log('Kaiser win length should be odd')
			throw new Error()
		}
	
		const filter = new Array(Math.floor(win.length))
	
		const m = win.length
		let idx = 0
		for (let n = Math.floor(-(m - 1) / 2.); n < Math.floor((m - 1) / 2) + 1; n++) {
			if (n == 0) {
				//filter.push(self.cutout.get_pi_rad() - (self.delta_w / 2.).get_pi_rad());
				//filter[idx] =(self.cutout.get_pi_rad() - (self.delta_w / 2.).get_pi_rad());
				filter[idx] = this.cutout.get_pi_rad() - (this.delta_w.get_pi_rad() / 2.)
			} else {
				
				filter[idx] =
					Math.sin(n * Math.PI * this.cutout.get_pi_rad()) / (n * Math.PI)
						- Math.sin(n * Math.PI * (this.delta_w.get_pi_rad() / 2.)) / (n * Math.PI)
	
			}
			idx++
		}
	
		//console.log(filter)
		return product(filter, win)
	}

	resample(input_rate, output_rate) {
		const ratio = output_rate.get_hz()  / input_rate.get_hz()
		console.log('resample output %d input %d ', output_rate.get_hz(),input_rate.get_hz())
		console.log('ratio %f', ratio)
		console.log(' old cutout %f delta_w %f', this.cutout.get_pi_rad(), this.delta_w.get_pi_rad())
		this.cutout.set_pi_rad(this.cutout.get_pi_rad() / ratio)
		this.delta_w.set_pi_rad(this.delta_w.get_pi_rad() / ratio)
		console.log(' new cutout %f delta_w %f', this.cutout.get_pi_rad(), this.delta_w.get_pi_rad())
	}
}

export class Lowpass {
	constructor (cutout, atten, delta_w) {
		this.cutout = cutout
		this.atten = atten
		this.delta_w = delta_w
	}

	//Filter for Lowpass  
	design() { 
		console.log('in lp design cutout.get_pi_rad %f atten %f delta_w.get_pi_rad %f', this.cutout.get_pi_rad(), this.atten, this.delta_w.get_pi_rad())
		
		const win = kaiser(this.atten, this.delta_w)

		if (win.length % 2 == 0) {
			console.log('Kaiser window length should be odd')
			throw new Error()
		}

		const filter = new Array(win.length)

		const m = win.length
		let idx = 0
		for (let n = Math.floor( -(m - 1) / 2); n < (Math.floor((m - 1) / 2)) + 1; n++) {
			if (n == 0) {
				filter[idx] = this.cutout.get_pi_rad()
			} else {
				filter[idx] = Math.sin(n * Math.PI * this.cutout.get_pi_rad()) / (n * Math.PI)
			}
			idx += 1
		}
		
		console.log('low pass filter')
		console.log(filter)

		console.log('low pass window')
		console.log(win)

		console.log('low pass product')
		console.log(product(filter, win))
		
		const rtn_pro = product(filter,win)
		console.log('rtn_pro in lp design')
		console.log(rtn_pro)
		return rtn_pro
	}
}
	

 

// Product of two vectors, element by element.
function product(v1, v2)  {
	if (v1.length != v2.length) {
		console.log('in product Both vectors must have the same length')
		throw new Error()
	}

	for (let i = 0; i < v1.length; i++) {
		v1[i] *= v2[i]
	}

	return v1
}

/*
 * Design Kaiser window from parameters.
 *
 * Created by bill_liles on 4/24/24.
 * adapted from noaa-apt filters.js
 * https://github.com/martinber/noaa-apt
 * The length depends on the parameters given, and it's always odd.
 */

function kaiser(atten, delta_w) {
	
	let beta
	if (atten > 50.) {
		beta = 0.1102 * (atten - 8.7)
	} else if (atten < 21.) {
		beta = 0.
	} else {
		beta = 0.5842 * (atten - 21.) ** 0.4 + 0.07886 * (atten - 21.)
	}

	// Filter length, we want an odd length
	let length = Math.ceil((atten - 8.) / (2.285 * delta_w.get_rad()))  + 1
	if (length % 2 == 0) {
		length += 1
	}

	const win = new Array(Math.floor(length))
	let idx = 0
	const m = length
	//for n in -(length - 1) / 2..=(length - 1) / 2 {
	for (let n = Math.floor(-(length -2) / 2); n < Math.floor((length -1) / 2) + 1; n++) {
		
		win[idx] = (bessel_i0(beta * Math.sqrt(1. - (n / (m / 2.)) ** 2)) / bessel_i0(beta))
		idx++
	}

	return win
}

/*
 *  bessel.js
 *
 * Created by bill_liles on 4/23/24.
 * adapted from noaa-apt misc.js
 * https://github.com/martinber/noaa-apt
 *
 * Lookup table for numbers used in `bessel_i0()`
 *
 * 1 / (n! * 2^n)^2
 *
 * First Kind modified Bessel function of order zero.
 * From this
 * [post](https://dsp.stackexchange.com/questions/37714/kaiser-window-approximation/37715#37715).
*/

function bessel_i0(x) {

	const bessel_table = [
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

	let result = 0.
	const limit = 8
	
	for (let k = limit; k > 0; k--) {
		result += bessel_table[k]
		result *= x**2
	}
	
	return result + 1.
}

/// Filter a signal.
export function dsp_filter(signal, filter) {
	const coeff = filter.design()
	//let coeff_sub = coeff.slice(0, 50);
	console.log('lp post demod coeff values')
	console.log(coeff)
	
	const output = new Array(signal.length)
	
	console.log('inside dsp_filter')
	console.log('signal length %d coeff length %d', signal.length, coeff.length)

	for (let i = 0; i < signal.length; i++) {
		let  sum = 0.0
		for (let j = 0; j < coeff.length; j++) {
			if (i > j) {
				sum += signal[i - j] * coeff[j]
				if ( i == 38) {
					console.log('j %d signal[i-j] %f coeff[j] %f sum %f', j, signal[i-j],coeff[j], sum)
				}
			}
		}
		output[i] = sum
	}
	
	console.log('leaving dsp_filter')
	return output
}

