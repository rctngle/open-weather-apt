const { createCanvas } = require('canvas')
const { PX_PER_CHANNEL, PX_PER_ROW, SAMPLE_RATE, FINAL_RATE } = require('./constants')
const { decode } = require('./decode')
const dsp = require('./dsp')

const create_image = (buffer, mode, channel, equalize) => {

	const [ sync_positions, signal ] = decode(buffer, mode)

	const pixel_start = get_pixel_start(channel)
	const image_width = get_image_width(channel)


	const downSampler = new dsp.Downsampler(SAMPLE_RATE, FINAL_RATE, get_coeffs())

	const lineCount = sync_positions.length
	const canvas = createCanvas(image_width, lineCount)
	const ctx = canvas.getContext('2d')
	
	const image = ctx.createImageData(image_width, lineCount)

	console.log(image_width)
	// let low = my_min(signal);

	//let high = my_max(signal);

	const [low, high] = percent(signal, 0.98)
	console.log('high %f low %f', high, low)

	
	for (let line=0; line<sync_positions.length-1; line++) {
		
		const row_samples = signal.slice(sync_positions[line][0], sync_positions[line+1][0])
		const this_line_data = downSampler.downsample(row_samples)
		//let low = Math.min(this_line_data);
		//let high = Math.max(this_line_data);


		let this_line = map_signal_u8(this_line_data, low, high)
		//console.log(row_samples)
		//console.log(this_line_data)
		//console.log("create_image row_samples len %d lhis_line_data len %d ratio %f",row_samples.length, this_line_data.length, row_samples.length/this_line_data.length);
		/*
		if (line == 0) {
			console.log(" row this_line_data map");
			console.log(row_samples);
			console.log(this_line_data);
			console.log(this_line);
			console.log(" row this_line_data map");
		}
		*/
		
		for (let column = 0; column < image_width; column++) {
			//const value = this_line_data[pixel_start + column] * 255
			const value = this_line[pixel_start + column]
			const offset = line * image_width * 4 + column * 4
			image.data[offset] = value // Red
			image.data[offset + 1] = value // Green
			image.data[offset + 2] = value // Blue
			image.data[offset + 3] = 255 // Alpha
		}

	}

	ctx.putImageData(image, 0, 0)

	return canvas.toBuffer('image/png')	

}

const map_signal_u8 = (signal, low, high) => {
	// console.log("map_signal_u8 low %f high %f", low, high);
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

const get_coeffs = () => {
	const numTaps = 50
	return dsp.getLowPassFIRCoeffs(SAMPLE_RATE, 1200, numTaps)
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

module.exports = {
	create_image,
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
		console.log('Percent given should be between 0 and 1')
	}

	// Amount of buckets
	const num_buckets = 1000

	// Count on samples that fall on each bucket
	const buckets = new Array(num_buckets).fill(0)

	// Range of input samples
	const min = get_min(signal)
	const max = get_max(signal)
	const total_range = max - min

	// console.log("in percent min %f max %f total_range %f buckets.length %d percent %f", min,max,total_range,buckets.length,percent);
	// console.log("signal.length %d", signal.length);
	// Count samples on each bucket
	let tot_cnt = 0
	for (let idx = 0; idx < signal.length; idx++) {
		let tmp = get_bucket(signal[idx], min, total_range, num_buckets)
		buckets[tmp] += 1
		tot_cnt += 1
	}
	console.log('in percent')
	/*
	for (let idx = 0; idx<num_buckets; idx++) {
		console.log("buckets idx %d buckets[idx] %d", idx, buckets[idx]);
	}
	*/
	console.log('total bucket cnt %d', tot_cnt)
	// Find `low` and high`
	let accum = 0
	const percent_cnt = Math.trunc(signal.length * percent)
	let low_cnt = signal.length
	let low_bucket = num_buckets - 1
	let high_bucket = 0
	let low_flag = true
	// console.log("in percent low_cnt %d percent_cnt %d", low_cnt, percent_cnt);
	for (let idx = 0; idx < buckets.length; idx++ ) {
		const count = buckets[idx]
		low_cnt -= count
		accum += count
		//console.log("in percent accum %d percent_cnt %d low_cnt %d ", accum, percent_cnt, low_cnt);
		if (accum > percent_cnt) {
			high_bucket = idx - 1
			break
		}
		if ((low_cnt < percent_cnt) && low_flag) {
			low_bucket = idx
			low_flag = false
		}
	}
	// console.log(" accum %d high_bucket %d low_bucket %d", accum, high_bucket, low_bucket);
	/*
	if (high_bucket > num_buckets - 1) {
		// Can happen if remainder is too close to zero, so the high_bucket
		// should be the last one.
		high_bucket = num_buckets - 1;
	}
	*/
	return [
		low_bucket / num_buckets * total_range + min,
		high_bucket / num_buckets * total_range + min
	]
}

// Get the index of the bucket where the sample falls in
const get_bucket = (x, min, total_range, num_buckets) => {
	let temp = Math.trunc((x - min) / total_range * num_buckets)
	// console.log("in get_bucket x %f min %f total_range %f temp %d",x,min,total_range,temp);
	if (temp < 0) {
		temp = 0
	}

	if (temp > (num_buckets - 1)) { 
		temp = num_buckets - 1
	}
	
	// console.log("   in get_bucket  temp %d",temp);
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