const { createCanvas } = require('canvas')
const { PX_PER_CHANNEL, PX_PER_ROW, SAMPLE_RATE, FINAL_RATE } = require('./constants')
const { decode } = require('./decode')
const dsp = require('./dsp')

const create_image = (buffer, mode, channel, equalize) => {

	const [ sync_positions, signal ] = decode(buffer, mode)

	const pixel_start = get_pixel_start(channel)
	const image_width = get_image_width(channel)


	const downSampler = new dsp.Downsampler(SAMPLE_RATE, FINAL_RATE, getCoeffs())

	const lineCount = sync_positions.length
	const canvas = createCanvas(image_width, lineCount)
	const ctx = canvas.getContext('2d')
	
	const image = ctx.createImageData(image_width, lineCount)

	console.log(image_width)

	
	for (let line=0; line<sync_positions.length-1; line++) {

		
		const row_samples = signal.slice(sync_positions[line][0], sync_positions[line+1][0])
		const this_line_data = downSampler.downsample(row_samples)
		console.log(row_samples)
		console.log(this_line_data)
		
		for (let column = 0; column < image_width; column++) {
			const value = this_line_data[pixel_start + column] * 255
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

const getCoeffs = () => {
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