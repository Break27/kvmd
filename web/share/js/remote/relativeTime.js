"use strict";


const RTF = new Intl.RelativeTimeFormat('en', {
	numeric: "always",
	style: "long"
});

const Time = {
	year: 29030400,
	month: 2419200,
	week: 604800,
	day: 86400,
	hour: 3600,
	minute: 60,
	second: 1
}


export function fromNow(timestamp) {
	if (timestamp == 0) return "never seen";

	let now = Date.now() / 1000;
	let time = now - timestamp;

	for (const unit in Time) if (time >= Time[unit]) {
		let value = Math.floor(time / Time[unit]);
		return RTF.format(-value, unit);
        }

	return "just now";
}
