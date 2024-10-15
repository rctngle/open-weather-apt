import fs from 'fs'
import { decode, demod_filter, find_sync } from './decode.js'
import { create_image, generate_histogram, generate_image_histogram } from './image.js'

const audioPath = process.argv[2]
const imagePath = process.argv[3] || 'output.png'
const sync = (process.argv[4] && process.argv[4] === '0') ? false : true
const mode = process.argv[5] || 'cos'
const channel = process.argv[6] || 'AB'
const equalize = (process.argv[7] && process.argv[7] === '0') ? false : true
const rotate = (process.argv[8] && process.argv[8] === '1') ? true : false

// read the wav
const buffer = fs.readFileSync(audioPath)

// decode and resample
let signal = decode(buffer)

// demodulate
signal = demod_filter(signal, mode)

// find the sync positions
const sync_positions = find_sync(signal)

// create image
const canvas = create_image(signal, sync_positions, sync, channel, equalize, rotate)

// generate signal histogram
const signal_histogram = generate_histogram(signal, 1000)

// generate image histogram
const image_histogram = generate_image_histogram(canvas)

// print sync positions
console.log('Sync Positions', JSON.stringify(sync_positions))

// print signal histogram
console.log('Signal Histogram', JSON.stringify(signal_histogram))

// print image histogram
console.log('Image Histogram', JSON.stringify(image_histogram))

// write the png
fs.writeFileSync(imagePath, canvas.toBuffer('image/png'))
