import fs from 'fs'
import { decode, demod_filter, find_sync } from './decode.js'
import { create_image } from './image.js'

const audioPath = process.argv[2]
const imagePath = process.argv[3] || 'output.png'
const sync = (process.argv[4] && process.argv[4] === '0') ? false : true
const mode = process.argv[5] || 'cos'
const channel = process.argv[6] || 'AB'
const equalize = (process.argv[7] && process.argv[7] === '0') ? false : true

// read the wav
const buffer = fs.readFileSync(audioPath)

// decode and resample
let signal = decode(buffer)

// demodulate
signal = demod_filter(signal, mode)

// find the sync positions
const sync_positions = find_sync(signal)

// create image
const result = create_image(signal, sync_positions, sync, channel, equalize)

// print sync positions
console.log('Sync Positions', JSON.stringify(result.sync_positions))

// print signal histogram
console.log('Signal Histogram', JSON.stringify(result.signal_histogram))

// write the png
fs.writeFileSync(imagePath, result.canvas.toBuffer('image/png'))
