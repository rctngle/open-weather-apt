const fs = require('fs')
const { createImage } = require('./open-weather-apt')


const audioPath = process.argv[2]
const channel = process.argv[3] || 'AB'
const mode = process.argv[4] || 'cos'
// const imagePath = process.argv[5] || undefined

// read the wav
const buffer = fs.readFileSync(audioPath)

// create image
createImage(buffer, mode, channel, true)
