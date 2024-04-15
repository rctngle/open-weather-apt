const fs = require('fs')
const path = require('path')
const { createCanvas, Image } = require('canvas')

const { equalizeHistogram } = require('./open-weather-apt')

// Replace 'yourDirectoryPath' with the actual path to your directory
const directoryPath = '../archive/image'

// Read the directory synchronously
const files = fs.readdirSync(directoryPath)

// Filter out only PNG files
const pngFiles = files.filter(file => path.extname(file).toLowerCase() === '.png')

pngFiles.forEach(file => {
	const filePath = path.join(directoryPath, file)
	const imageSrc = fs.readFileSync(filePath)
	const image = new Image()
	image.src = imageSrc

	// Create a canvas with the same dimensions as the image
	const canvas = createCanvas(image.width, image.height)
	const ctx = canvas.getContext('2d')

	// Draw the image onto the canvas
	ctx.drawImage(image, 0, 0, image.width, image.height)


	// original image AB
	const originalFilename = path.basename(filePath, path.extname(filePath)) + '-AB.png'
	const originalOutputPath = path.join('processed', originalFilename)
	const originalBuffer = canvas.toBuffer('image/png')
	fs.writeFileSync(originalOutputPath, originalBuffer)
	saveHalves(canvas, filePath, false)


	// equalized AB
	const equalizedFilename = path.basename(filePath, path.extname(filePath)) + '-AB-equalized.png'
	const equalizedOutputPath = path.join('processed', equalizedFilename)
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
	equalizeHistogram(imageData)
	ctx.putImageData(imageData, 0, 0)
	const equalizedBuffer = canvas.toBuffer('image/png')
	fs.writeFileSync(equalizedOutputPath, equalizedBuffer)
	saveHalves(canvas, filePath, true)

	process.exit()
})

function saveHalves(canvas, filePath, equalized) {
	const width = canvas.width / 2
	const height = canvas.height

	for (let side of ['A', 'B']) {
		const sideCanvas = createCanvas(width, height)
		const sideCtx = sideCanvas.getContext('2d')

		if (side === 'A') {
			// Draw left half
			sideCtx.drawImage(canvas, 0, 0, width, height, 0, 0, width, height)
		} else {
			// Draw right half
			sideCtx.drawImage(canvas, width, 0, width, height, 0, 0, width, height)
		}

		const baseName = path.basename(filePath, path.extname(filePath))
		const fileName = (equalized)
			? `${baseName}-${side}-equalized.png`
			: `${baseName}-${side}.png`

		const outputPath = path.join('processed', fileName)

		// Save the file
		const buffer = sideCanvas.toBuffer('image/png')
		fs.writeFileSync(outputPath, buffer)
	
	}
}