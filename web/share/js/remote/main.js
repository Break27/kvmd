"use strict";


import { $, $$$, tools } from "../tools.js";
import { fromNow } from "./relativeTime.js";


let loading = false;

let status = null;

/********************************************************/

export function main() {
	$("rf").addEventListener("click", refresh);
	createWebSocket();
	setInterval(updateOfflineTime, 5000);
}

function createWebSocket() {
	let address = `wss://${window.location.host}/api/ws`;
	let socket = new WebSocket(address);

	socket.onopen = () => {
		console.log("WebSocket connection established.");
	};
	
	socket.onmessage = (e) => {
		let { event_type, event } = JSON.parse(e.data);

		if (event_type != "remote_state") {
			return;
		}

		if (! status) { status = {}; makeView(event); }
		else event.forEach(x => updateState(x));
	};

	socket.onerror = () => {
		socket.close();
	};

	socket.onclose = () => {
		console.log("Websocket connection lost. Retrying in 5 seconds.");
		setTimeout(createWebSocket, 5000);
	};
}

function refresh(event) {
	if (loading) return;
	loading = true;

	let icon = $$$("#rf div.icon")[0];
	icon.classList.toggle("spin");

	getApiUpdate(roll => {
		roll.forEach(host => updateState(host));
		setTimeout(() => {
			icon.classList.toggle("spin");
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

function getApiUpdate(callback) {
	let http = tools.makeRequest("POST", "/api/remote/update", () => {
		let response = http.responseText;

		if (! guards(http)) return;
		if (! response) return;

		let update = JSON.parse(response).result.update;
		callback(update);
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
			let state = $$$(`.host[name='${target}'] span.state`)[0];
			state.innerHTML = '&nbsp;&nbsp;&olcross;&nbsp;&nbsp;Failed';
			setTimeout(() => updateState(status[target]), 5000);
		}
	}, body, contentType);
}

/****************************************************/

function makeView(hosts) {
	let parent = $("bulletin");

	if (! hosts) {
		parent.innerHTML = '<h4>Error</h4>';
		throw new Error('Could not load hosts');
	}

	if (hosts.length == 0) {
		parent.innerHTML = '<h4>No Hosts</h4>';
		throw new Error('No host available');
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

	status[host.name] = host;
}

function updateOfflineTime(name) {
	let attr = name ? `[name='${name}']` : '';

	for (const element of $$$(`div.host${attr}[state='offline']`)) {
		let timestamp = element.getAttribute("last-seen");
		let state = element.querySelector("span.state");

		state.innerHTML = '&nbsp;&nbsp;&ndash;&nbsp;&nbsp;' + fromNow(timestamp);
	}
}
