// Final signal sample rate.
export const SAMPLE_RATE = 12480

// This signal has one sample per pixel.
export const FINAL_RATE = 4160

// Channel sync frame in pixels.
export const PX_SYNC_FRAME = 39

// Deep space data and minute markers.
export const PX_SPACE_DATA = 47

// Channel image data.
export const PX_CHANNEL_IMAGE_DATA = 909

// Telemetry data.
export const PX_TELEMETRY_DATA = 45

// Source: https://www.sigidwiki.com/wiki/Automatic_Picture_Transmission_(APT)#Structure
// Pixels per channel. A channel contains:
// PX_SYNC_FRAME | PX_SPACE_DATA | PX_CHANNEL_IMAGE_DATA | PX_TELEMETRY_DATA
export const PX_PER_CHANNEL = 1040

// Pixels per image row. A row contains 2 channels.
export const PX_PER_ROW = 2080

// AM carrier frequency in Hz.
export const CARRIER_FREQ = 2400

// first low pass cutoff freq
export const CUTOFF_FREQ = 2 * 2400

// high pass cutoff freq
export const HIGH_PASS_CUTOFF = 1000

// sample rate for first filter
export const FIL_SAMPLE_RATE = 12480

// attenuation for the filter after the deodulation
export const DEMODULATION_ATTEN = 25
