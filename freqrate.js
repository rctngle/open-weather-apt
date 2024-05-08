export class Freq {
	
	constructor(pi_rad) {
		// expects fractional pi_rad
		this.pi_rad = pi_rad
	}

	static hz(freq, rate) {
		let pi_rad = 2. * freq / rate.get_hz()
		return new Freq(pi_rad)
	}

	static rad(rad) {
		return new Freq(rad / Math.PI)
	}

	static pi_rad(pi_rad) {
		return new Freq(pi_rad)
	}

	set_pi_rad(pi_rad) {
		this.pi_rad = pi_rad
	}

	// get radians / sec
	get_rad() {
		return this.pi_rad * Math.PI
	}

	// get fractions of pi radians /sec
	get_pi_rad() {
		return this.pi_rad
	}

	// get frequency in Hertz
	get_hz(rate) {
		console.log(this.pi_rad * rate.get_hz() / 2)
		return this.pi_rad * rate.get_hz() / 2
	}
}

export class Rate {
	constructor(freq) {
		this.freq = freq
	}

	get_hz() {
		return this.freq
	}
}
