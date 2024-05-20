import { createCanvas } from 'canvas'
import { PX_PER_CHANNEL, PX_PER_ROW, SAMPLE_RATE, FINAL_RATE } from './constants.js'
import { decode } from './decode.js'
import { equalizeHistogram } from './equalize.js'

let decoded

export const create_image = (buffer, sync, mode, channel, equalize, canvas = null) => {

	if (buffer) {
		decoded = decode(buffer, mode)
	}

	const [ sync_positions, signal ] = decoded

	const pixel_start = get_pixel_start(channel)
	const image_width = get_image_width(channel)

	const line_count = sync_positions.length

	if (canvas) {
		canvas.width = image_width
		canvas.height = line_count
	} else {
		canvas = createCanvas(image_width, line_count)	
	}
	
	const ctx = canvas.getContext('2d')
	
	const image = ctx.createImageData(image_width, line_count)

	const [low, high] = percent(signal, 0.98)	

	const lines = []
	if (sync) {
		// to produce a synced image, get lines by sync position
		for (let line = 0; line < sync_positions.length-1; line++) {
			const row_samples = signal.slice(sync_positions[line][0], sync_positions[line+1][0])
			lines.push(row_samples)
		}	
	} else {
		// to produce an unsynced image, start a new line every 6240 samples
		const samples_per_line = (SAMPLE_RATE / 2)
		const num_lines = Math.floor(signal.length / samples_per_line)
		for (let line = 0; line < num_lines; line++) {
			const row_samples = signal.slice(line * samples_per_line, line * samples_per_line + samples_per_line)
			lines.push(row_samples)
		}
	}


	for (let line = 0; line < lines.length; line++) {

		const row_samples = lines[line]
		const this_line_data = downsample(row_samples, SAMPLE_RATE, FINAL_RATE)
		let this_line = map_signal_u8(this_line_data, low, high)

		for (let column = 0; column < image_width; column++) {
			const value = this_line[pixel_start + column]
			const offset = line * image_width * 4 + column * 4
			image.data[offset] = value // Red
			image.data[offset + 1] = value // Green
			image.data[offset + 2] = value // Blue
			image.data[offset + 3] = 255 // Alpha
		}
	}


	if (equalize) {
		equalizeHistogram(image, channel)
	}

	ctx.putImageData(image, 0, 0)

	return canvas

}

const downsample = (samples, input_rate, output_rate) => {

	const rate_mull = input_rate / output_rate
	const arr = new Float32Array(Math.floor(samples.length / rate_mull))

	for (var idx = 0; idx < arr.length; idx++) {
		arr[idx] = samples[idx * rate_mull]
	}
	return arr
}

const map_signal_u8 = (signal, low, high) => {
	const range = high - low
	const raw_data = new Array(signal.length)
	for (let idx = 0; idx < signal.length; idx++) {
		let temp = Math.round(((signal[idx] - low) / range) * 255)
		if ( temp < 0) {
			temp = 0
		} else if (temp > 255) {
			temp = 255
		}
		raw_data[idx] = temp
	}
	return raw_data
}


const get_image_width = channel => {
	if (channel === 'A') {
		return PX_PER_CHANNEL
	} else if (channel === 'B') {
		return PX_PER_CHANNEL
	} else if (channel === 'AB') {
		return PX_PER_ROW
	}
}

const get_pixel_start = channel => {
	if (channel === 'A') {
		return 0
	} else if (channel === 'B') {
		return PX_PER_CHANNEL
	} else if (channel === 'AB') {
		return 0
	}
}


/*
 * Returns lowest and highest values that fall inside the percent given.
 *
 * Returns tuple of `(low, high)`. The values returned are approximate. The
 * percent given should be between 0 and 1.
 *
 * Means that `percent` samples of the `Signal` are bigger than `low` and
 * smaller than `high`. Also, `(1 - percent) / 2` are smaller than `low` and
 * `(1 - percent) / 2` are bigger than `high`.
 *
 * For example
 * -----------
 *
 * - If the signal has values uniformly distributed between 0 and 1 and the
 *   percent given is `0.50`, `low` will be 0.25 and `high` 0.75.
 *
 * - If the signal has values uniformly distributed between 1 and 2 and the
 *   percent given is `0.90`, `low` will be 1.05 and `high` 1.95.
 *
 * How it works
 * ------------
 *
 * Creates 1000 buckets, uniformly distributed from the minimum and maximum
 * values on `signal`. For each sample, increment one on the bucket the sample
 * falls in.
 *
 * Finally count the values on each bucket and return an approximate value for
 * `low` and `high`
 */

const percent = (signal, percent) => {
	if (percent < 0. || percent > 1.) {
		throw new Error('Percent given should be between 0 and 1')
	}

	// Amount of buckets
	const num_buckets = 1000

	// Count on samples that fall on each bucket
	const buckets = new Array(num_buckets).fill(0)

	// Range of input samples
	const min = get_min(signal)
	const max = get_max(signal)
	const total_range = max - min

	// Count samples on each bucket
	for (let idx = 0; idx < signal.length; idx++) {
		let tmp = get_bucket(signal[idx], min, total_range, num_buckets)
		buckets[tmp] += 1
	}

	// Find `low` and high`
	let accum = 0
	const percent_cnt = Math.trunc(signal.length * percent)
	let low_cnt = signal.length
	let low_bucket = num_buckets - 1
	let high_bucket = 0
	let low_flag = true

	for (let idx = 0; idx < buckets.length; idx++ ) {
		const count = buckets[idx]
		low_cnt -= count
		accum += count

		if (accum > percent_cnt) {
			high_bucket = idx - 1
			break
		}

		if ((low_cnt < percent_cnt) && low_flag) {
			low_bucket = idx
			low_flag = false
		}
	}

	return [
		low_bucket / num_buckets * total_range + min,
		high_bucket / num_buckets * total_range + min
	]
}

// Get the index of the bucket where the sample falls in
const get_bucket = (x, min, total_range, num_buckets) => {
	let temp = Math.trunc((x - min) / total_range * num_buckets)
	if (temp < 0) {
		temp = 0
	}

	if (temp > (num_buckets - 1)) { 
		temp = num_buckets - 1
	}
	
	return temp
}

const get_max = arr => {
	let max = arr[0]
	for (let idx in arr) {
		if (max < arr[idx]) {
			max = arr[idx]
		}
	}
	return max
}

const get_min = arr => {
	let min = arr[0]
	for (let idx in arr) {
		if (min > arr[idx]) {
			min = arr[idx]
		}
	}
	return min
}