import { createCanvas, ImageData as NodeImageData } from 'canvas'
import { PX_PER_CHANNEL, PX_PER_ROW, SAMPLE_RATE, FINAL_RATE } from './constants.js'
import { equalize_histogram } from './equalize.js'

// export const create_image = (buffer, sync, mode, channel, equalize, canvas = null) => {

export const create_image = (signal, sync_positions, sync, channel, equalize, rotate, canvas = null) => {

	const pixel_start = get_pixel_start(channel)
	const image_width = get_image_width(channel)

	const [low, high] = percent(signal, 0.98)	

	const lines = []
	let num_lines = 0

	const samples_per_line = (SAMPLE_RATE / 2)

	if (sync) {
		// to produce a synced image, get lines by sync position
		num_lines = sync_positions.length
		for (let line = 0; line < sync_positions.length-1; line++) {
			const row_samples = signal.slice(sync_positions[line][0], sync_positions[line][0] + samples_per_line) // wcl
			lines.push(row_samples)
		}
	} else {
		// to produce an unsynced image, start a new line every 6240 samples
		num_lines = Math.floor(signal.length / samples_per_line)
		for (let line = 0; line < num_lines; line++) {
			const row_samples = signal.slice(line * samples_per_line, line * samples_per_line + samples_per_line)
			lines.push(row_samples)
		}
	}

	let rotatedImage

	if (canvas) {
		canvas.width = image_width
		canvas.height = num_lines
		rotatedImage = new ImageData(image_width, num_lines)
	} else {
		canvas = createCanvas(image_width, num_lines)	
		rotatedImage = new NodeImageData(image_width, num_lines)
	}
	
	const ctx = canvas.getContext('2d')
	let image = ctx.createImageData(image_width, num_lines)

	const pixels = []
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

			pixels.push(value)
		}
	}

	if (equalize) {
		equalize_histogram(image, channel)
	}

	if (rotate) {
		image = rotate_image_180_degrees(rotatedImage, image)
	}

	ctx.putImageData(image, 0, 0)

	return canvas
}

/*
const flip_image_over_x_axis = (flippedImage, image) => {
	const { width, height } = image
	
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			for (let channel = 0; channel < 4; channel++) {
				// Set the pixel in the new image to the pixel from the corresponding position in the original image
				flippedImage.data[(y * width + x) * 4 + channel] = image.data[((height - y - 1) * width + x) * 4 + channel]
			}
		}
	}

	return flippedImage
}
*/

const rotate_image_180_degrees = (rotatedImage, image) => {
	const { width, height } = image
	
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			for (let channel = 0; channel < 4; channel++) {
				// Set the pixel in the new image to the pixel from the corresponding position in the original image
				rotatedImage.data[(y * width + x) * 4 + channel] = image.data[((height - y - 1) * width + (width - x - 1)) * 4 + channel]
			}
		}
	}

	return rotatedImage
}


export function generate_image_histogram(canvas) {

	const ctx = canvas.getContext('2d')
	const image_data = ctx.getImageData(0, 0, canvas.width, canvas.height)
	const data = image_data.data
	const values = []

	for (let i = 0; i < data.length; i += 4) {
		let grayscale = data[i]
		values.push(grayscale)
	}

	return generate_histogram(values, 255)
}

export function generate_histogram(signal, num_bins = 1000) {
	const smin = get_min(signal)
	const smax = get_max(signal)
	const bin_width = (smax - smin) / num_bins
	let bins = new Array(num_bins).fill(0)

	signal.forEach(value => {
		const binIndex = Math.floor((value - smin) / bin_width)
		if (binIndex < num_bins) {
			bins[binIndex]++
		}
	})

	return {
		bin_width: bin_width,
		bins: bins.map((count, index) => {
			const bin_start = smin + index * bin_width
			const bin_end = bin_start + bin_width
			return {
				min: bin_start,
				max: bin_end,
				count: count
			}
		})
	}
	
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