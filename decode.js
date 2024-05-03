const wav = require('node-wav')

const { 
	PX_PER_ROW, 
	FIL_SAMPLE_RATE, 
	FINAL_RATE, 
	CUTOFF_FREQ, 
	HIGH_PASS_CUTOFF,
	DEMODULATION_ATTEN,
} = require('./constants')

const {
	Freq,
	Rate,
} = require('./freqrate')

const { 
	Lowpass, 
	LowpassDcRemoval, 
	resample_with_filter, 
	dsp_filter,
} = require('./filters')

const { 
	demodulate,
} = require('./demodulate')

const decode =(buffer, mode) => {

	const result = wav.decode(buffer)
	//result.channelData[0] result.sampleRate 	
	const data = result.channelData[0]
	let signal = new Array(data.length)
	for (let idx = 0; idx < data.length; idx++) {
		signal[idx] = data[idx] * 32768
	}


	// let signal_str = format!("{:?}",signal);
	// let mut signal_file = File::create("noaa-apt_sig.txt").expect("creation failure");
	// signal_file.write(signal_str.as_bytes()).expect("write file");
	// Samples on each image row when at `WORK_RATE`.
	const samples_per_work_row = PX_PER_ROW * FIL_SAMPLE_RATE / FINAL_RATE

	const work_rate = new Rate(FIL_SAMPLE_RATE)
	const input_rate = new Rate(result.sampleRate)

	const cutout = Freq.hz(CUTOFF_FREQ, input_rate)

	const atten = 30
	const delta_w = Freq.hz(HIGH_PASS_CUTOFF, input_rate)
	
	console.log('decode before new LowpassDcRemoval')
	const filter = new LowpassDcRemoval(cutout, atten, delta_w)


	// Cutout frequency of the resampling filter, only the AM spectrum should go
	// through to avoid noise, 2 times the carrier frequency is enough
 
	// Width of transition band, we are using a DC removal filter that has a
	// transition band from zero to delta_w. I think that APT signals have

	const cutpr = cutout
	const deltapr = delta_w
	console.log('decode pre dsp resample cutout hz %d pi_rad %f delta_w hz %d pi_rad %f input_rate hz %d', cutpr.get_hz(input_rate), cutpr.get_pi_rad(), deltapr.get_hz(input_rate),deltapr.get_pi_rad(),input_rate.get_hz())
	
	signal = resample_with_filter(signal, input_rate, work_rate, filter)

	if (signal.length < 10 * samples_per_work_row) {
		console.log('Got less than 10 rows of samples, audio file is too short')
	}

	/*
	let spec_pred = hound::WavSpec {
		channels: 1,
		sample_rate: 12480,
		bits_per_sample: 16,
		sample_format: hound::SampleFormat::Int,
	};
	let path_pred = Path::new("noaa-apt_pred.wav");
	wav::write_wav(&path_pred, &signal, spec_pred);
	*/

	/*
	let signal_str = format!("{:?}",signal);
	let mut signal_file = File::create("noaa-apt_sig_pred.txt").expect("creation failure");
	signal_file.write(signal_str.as_bytes()).expect("write file");
	*/
	
	const demod_sig = demodulate(signal, mode)
	const demod_sig_sub = demod_sig.slice(0, 50)
	console.log('demod values', demod_sig_sub)

	const cutout_lp = Freq.pi_rad(FINAL_RATE / work_rate.get_hz())
	console.log('cutout_lp %f ratio %f', cutout_lp.get_pi_rad(), FINAL_RATE / work_rate.get_hz())
	console.log('before lp filter work_rate %f', work_rate.get_hz())

	const delta_cutout = cutout_lp.get_pi_rad() / 5.
	console.log('before lp after mod delta_cutout %f', delta_cutout)

	const delta_w_lp = Freq.pi_rad(delta_cutout)
	// set atten to settings.demodulation_atten
	const filter_lp = new Lowpass (cutout_lp, DEMODULATION_ATTEN, delta_w_lp)
	signal = dsp_filter(demod_sig, filter_lp)

	const demod_fil_sub = signal.slice(0, 25)
	console.log('filter after demod values')
	console.log(demod_fil_sub)	
	// Filter a signal.
	const sync_pos = find_sync(signal, work_rate, FINAL_RATE, PX_PER_ROW )

	return [ sync_pos, signal ]
}

const generate_sync_frame = (work_rate, FINAL_Rate) => {
	
	//const FINAL_RATE = 4160;
	const sync_a = [-1,-1,1,-1,1,-1,1,-1,1,-1,1,-1,1,-1,1,-1,-1,-1,-1]
	
	if (work_rate.get_hz() % FINAL_RATE != 0) {
		console.log('work_rate is not a integer multiple of FINAL_RATE')
		throw new Error()
	}

	const pixel_width = work_rate.get_hz() / FINAL_RATE
	const sync_pulse_width = pixel_width * 2
	const pulse_train = new Array(sync_pulse_width * sync_a.length)
	console.log('pixel_width %d synch_pulse_width %d pulse_train len %d', pixel_width, sync_pulse_width, pulse_train.length)
	
	for (let idx = 0; idx < sync_a.length; idx++) {
		const curr = sync_a[idx]
		for (let jdx = 0; jdx < sync_pulse_width; jdx++) {
			pulse_train[idx * sync_pulse_width + jdx] = curr
		}

	}
	
	return pulse_train
}



// Find sync frame positions.
//
// Returns list of found sync frames positions.
const find_sync = (signal, work_rate, final_rate, PX_PER_ROW) => {

	console.log('in find_sync work_rate hz %d', work_rate.get_hz())
	const guard = generate_sync_frame(work_rate, FINAL_RATE)

	// list of maximum correlations found: (index, value)
	const peaks = new Array()
	peaks.push([0, 0.])

	// Samples on each image row when at `WORK_RATE`.
	const samples_per_work_row = PX_PER_ROW * work_rate.get_hz() / FINAL_RATE

	// Minimum distance between peaks, some arbitrary number smaller but close
	// to the number of samples by line
	const min_distance = samples_per_work_row * 8 / 10
	
	/*
	// Save cross-correlation if exporting steps
	let correlation = if context.export_steps {
		Vec::with_capacity(signal.len() - guard.len())
	} else {
		Vec::with_capacity(0) // Not going to be used
	};
	*/

	for (let i = 0; i <  (signal.length - guard.length); i++) {
		let corr = 0.
		for (let j = 0; j < guard.length; j++) {
			if (guard[j] == 1) {
				corr += signal[i + j]
			} else {
				corr -= signal[i + j]
			}
			
		}

		/*
		if context.export_steps {
			correlation.push(corr);
		}
		*/

		// If previous peak is too far, keep it and add this value to the
		// list as a new peak
		if ((i - ar_last(peaks)[0]) > min_distance) {
			// If it looks that we have too few sync frames considering the
			// length of the signal so far
			while (i / samples_per_work_row  > peaks.length) {
				peaks.push([i, corr])
			}
		}
		// Else if this value is bigger than the previous maximum, set this
		// one
		else if (corr > ar_last(peaks)[1]) {
			peaks.pop()
			peaks.push([i, corr])
		}
	}
	/*
	if context.export_steps {
		context.step(Step::signal("sync_correlation", &correlation, None))?;
	}
	*/
	console.log('Found %d sync frames', peaks.length)

	//Ok(peaks.iter().map(|(index, _value)| *index).collect())
	console.log('peaks found')
	console.log(peaks)
	return peaks
}

// function to get last element of an array
const ar_last = arry => {
	const temp = arry[arry.length - 1]
	return temp
}

module.exports = {
	decode,
}
