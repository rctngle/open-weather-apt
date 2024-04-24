const fs = require('fs')
const { createImage } = require('./open-weather-apt')

const audioPath = process.argv[2]
const imagePath = process.argv[3] || 'output.png'
const channel = process.argv[4] || 'AB'
const mode = process.argv[5] || 'cos'
const method = process.argv[6] || 'sf'

// read the wav
const buffer = fs.readFileSync(audioPath)

// create image
const outputBuffer = createImage(buffer, mode, channel, method, true)
fs.writeFileSync(imagePath, outputBuffer)


// Example: Write an array to file as JSON
const myArray = [1, 2, 3, 4, 5]
fs.writeFileSync('test-file.json', JSON.stringify(myArray))

// Example: Append values to a file
for (let i = 0; i < 100; i++) {
	let value = Math.random()
	
	// you can only write strings or buffers, not numbers, so convert the number to string
	let stringValue = value+'' // convert to string 
	let templateStringValue = `${value}` // or use a template string

	fs.appendFileSync('./test-text.txt', templateStringValue)
	fs.appendFileSync('./test-text.txt', '\n') // new line
}
