import fs from 'fs'
import { create_image } from './image.js'

const audioPath = process.argv[2]
const imagePath = process.argv[3] || 'output.png'
const sync = (process.argv[4] && process.argv[4] === '0') ? false : true
const mode = process.argv[5] || 'cos'
const channel = process.argv[6] || 'AB'
const equalize = (process.argv[7] && process.argv[7] === '0') ? false : true

// read the wav
const buffer = fs.readFileSync(audioPath)

// create image
const canvas = create_image(buffer, sync, mode, channel, equalize)

// write the png
fs.writeFileSync(imagePath, canvas.toBuffer('image/png'))
