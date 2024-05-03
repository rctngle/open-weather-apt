const CARRIER_FREQ = 2400

module.exports = {

	// Final signal sample rate.
	SAMPLE_RATE:  12480,

	// This signal has one sample per pixel.
	FINAL_RATE:  4160,

	// Channel sync frame, in pixels.
	PX_SYNC_FRAME:  39,

	// Deep space data and minute markers.
	PX_SPACE_DATA:  47,

	// Channel image data.
	PX_CHANNEL_IMAGE_DATA:  909,

	// Telemetry data.
	PX_TELEMETRY_DATA:  45,

	// Source: https://www.sigidwiki.com/wiki/Automatic_Picture_Transmission_(APT)#Structure
	// Pixels per channel. A channel contains:
	// PX_SYNC_FRAME | PX_SPACE_DATA | PX_CHANNEL_IMAGE_DATA | PX_TELEMETRY_DATA
	PX_PER_CHANNEL:  1040,

	// Pixels per image row. A row contains 2 channels.
	PX_PER_ROW:  2080,

	// AM carrier frequency in Hz.
	CARRIER_FREQ:  CARRIER_FREQ,
	
	// first low pass cutoff freq
	CUTOFF_FREQ:  2 * CARRIER_FREQ,
	
	// high pass cutoff freq
	HIGH_PASS_CUTOFF:  1000,
	
	// sample rate for first filter
	FIL_SAMPLE_RATE:  12480,

	// attenuation for the filter after the deodulation
	DEMODULATION_ATTEN:  25,
}