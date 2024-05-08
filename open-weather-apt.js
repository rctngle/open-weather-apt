import fs from 'fs'
import { create_image } from './image.js'

const audioPath = process.argv[2]
const imagePath = process.argv[3] || 'output.png'
const channel = process.argv[4] || 'AB'
const mode = process.argv[5] || 'cos'

// read the wav
const buffer = fs.readFileSync(audioPath)

// create image
const outputBuffer = create_image(buffer, mode, channel, true)

// write the png
fs.writeFileSync(imagePath, outputBuffer)
