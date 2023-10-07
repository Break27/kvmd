"use strict";


import { $, $$$, tools } from "../tools.js";
import { fromNow } from "./relativeTime.js";


let prev_state = {};

let loading = false;

/********************************************************/

export function main() {
	loadRemoteApi(x => makeView(x));
	setInterval(update, 10000);

	$("rf").addEventListener("click", refresh);
}

function update() {
	loadRemoteApi(x => x.forEach(y => updateState(y)));
	updateOfflineTime();
}

function refresh(event) {
	if (loading) return;
	loading = true;

	let icon = $$$("#rf div.icon")[0];
	icon.classList.toggle("spin");

	prev_state = {};
	loadRemoteApi(x => {
		x.forEach(y => updateState(y));
		setTimeout(() => {
			icon.classList.toggle("spin")
			loading = false;
		}, 950);
	});
}

/********************************************************/

function guards(http) {
	if (http.readyState !== 4) {
		return false;
	}

	if (http.status === 401 || http.status === 403) {
		document.location.href = "/login";
		return false;
	}

	if (http.status !== 200) {
		return false;
	}

	return true;
}

function loadRemoteApi(callback) {
	let http = tools.makeRequest("POST", "/api/remote", () => {
		let response = http.responseText;

		if (! guards(http)) return;
		if (! response) return;

		let hosts = JSON.parse(response).result.hosts;
		let diff = stateDiff(hosts);

		callback(diff);
	});
}

function actionPerform(target, action) {
	let body = JSON.stringify({ target, action });
	let contentType = "application/json";

	let http = tools.makeRequest("POST", "/api/remote/control", () => {
		if (! guards(http)) return;

		let response = http.responseText;
		let result = JSON.parse(response).result;

		if (result.code != 0) {
			delete prev_state[target];
			let state = $$$(`.host[name='${target}'] span.state`)[0];

			state.innerHTML = '&nbsp;&nbsp;&olcross;&nbsp;&nbsp;Failed';
			setTimeout(update, 3000);
		}
	}, body, contentType);
}

/****************************************************/

function makeView(hosts) {
	let parent = $("bulletin");

	if (! hosts) {
		parent.innerHTML = '<h4>Error</h4>';
		return;
	}

	if (hosts.length == 0) {
		parent.innerHTML = '<h4>No Hosts</h4>';
		return;
	}

	parent.innerHTML = `
	  <div id="hosts">
	    <div id="separator"></div>
	  </div>
	`;

	for (const host of hosts) {
		let child = document.createElement("div");
		child.setAttribute("name", host.name);
		child.classList.add("host");

		child.innerHTML = `
		  <div>
		    <div>
	              <span class="bulb"></span>
		      <span class="hostname">${host.name}</span>
		    </div>
		    <span class="state"></span>
		  </div><div class="remote-actions">
		  </div>
		`;

		let actions = child.querySelector(".remote-actions");
		for (const action of host.actions) {
			let button = document.createElement("button");
			button.classList.add("remote-action");
			button.setAttribute("action", action);
			button.onclick = () => {
        			child.setAttribute("state", "unknown");
				child.querySelector("span.state")
				     .innerHTML = '&nbsp;&nbsp;&DoubleRightArrow;&nbsp;&nbsp;'
				                + action[0] + action.slice(1).toLowerCase();
				actionPerform(host.name, action);
			};
			actions.appendChild(button);
		}
		updateState(host, child);
	}
}

function updateState(host, child) {
	let parent = $("hosts");
	let separator = $("separator");
	let element = child ?? $$$(`div.host[name='${host.name}']`)[0];

    element.setAttribute("state", host.online ? 'online' : 'offline');
	element.setAttribute("last-seen", host.last_seen);

	if (host.online) {
		parent.insertBefore(element, separator);
		element.querySelector("span.state").innerHTML = '';
	} else {
		separator.after(element);
		updateOfflineTime(host.name);
	}
}

function updateOfflineTime(name) {
	let attr = name ? `[name='${name}']` : '';

	for (const element of $$$(`div.host${attr}[state='offline']`)) {
		let timestamp = element.getAttribute("last-seen");
		let state = element.querySelector("span.state");

		state.innerHTML = '&nbsp;&nbsp;&ndash;&nbsp;&nbsp;' + fromNow(timestamp);
	}
}

function stateDiff(hosts) {
	let diff = [];

	for (const host of hosts) {
		if (! (host.name in prev_state)
		    || prev_state[host.name].online != host.online)
		{
			diff.push(host);
		}
		prev_state[host.name] = host;
	}

	return diff;
}
