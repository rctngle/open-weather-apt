const fs = require('fs')
const path = require('path')
const wav = require('node-wav')
const { createImage } = require('./open-weather-apt')



const decode = (audioPath, imagePath) => {

	
	// Get the file extension
	const fileExt = path.extname(audioPath)

	// Remove the extension from the file name
	const fileBaseName = path.basename(audioPath, fileExt)

	// Read the wav file
	const buffer = fs.readFileSync(audioPath)

	const wavFile = wav.decode(buffer)

	// const channels = ['A', 'B', 'AB']
	// const modes = ['abs', 'cos', 'hilbertfft']

	const channels = ['AB']
	const modes = ['hilbertfft']

	channels.forEach(channel => {
		modes.forEach(mode => {

			const outputBuffer = createImage(fileBaseName, mode, channel, wavFile, true)
			// fs.writeFileSync(`${outputDir}/${fileBaseName}-${channel}-${mode}.png`, outputBuffer)
			fs.writeFileSync(imagePath, outputBuffer)

			// const outputBufferEqualized = createImage(fileBaseName, mode, channel, wavFile, true)
			// fs.writeFileSync(`${outputDir}/${fileBaseName}-${channel}-${mode}-equalized.png`, outputBufferEqualized)
		})
	})

}


const audioPath = process.argv[2]
const imagePath = process.argv[3]
decode(audioPath, imagePath)


// try {
// 	const rawData = fs.readFileSync('../archive/files/json/archive.json', 'utf8')
// 	// Parse the JSON content
// 	const recordings = JSON.parse(rawData)

// 	recordings.forEach(recording => {
// 		const inputFile = `../archive/files/wav/${recording.audio}`
// 		const outputDir = '../archive/files/image/'
// 		decode(inputFile, outputDir)
// 	})
// } catch (err) {
// 	console.error(err)
// }
