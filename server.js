import { OPEN, WebSocketServer } from 'ws';
import 'dotenv/config';

const password = process.env.WEBSOCKET_PASSWORD;
const port = process.env.PORT || 8090;
const wss = new WebSocketServer({ port, maxPayload: 10000 });

let espSocket = null;
let webSockets = [];

const WSCmdType_ESP_STATE = 0x0f;

wss.on('connection', (ws, req) => {
	let protocols = (req.headers['sec-websocket-protocol'] || '')
		.split(',')
		.map((p) => p.trim());

	if (protocols.length < 2 || protocols[1] != password) {
		console.log('Unauthorized connection: ', protocols);
		ws.close(1008, 'Unauthorized connection');
		return;
	}

	if (protocols[0] === 'webapp') {
		console.log('Webapp connected');
		webSockets.push(ws);
		ws.send([WSCmdType_ESP_STATE, espSocket == null ? 0 : 1]);

		ws.on('close', () => {
			webSockets = webSockets.filter((client) => client !== ws);
			console.log('Webapp disconnected');
		});
	}

	if (protocols[0] === 'esp') {
		console.log('Esp connected');
		espSocket = ws;
		webSockets.forEach((webSocket) => {
			webSocket.send([WSCmdType_ESP_STATE, espSocket && espSocket.readyState == OPEN]);
		});

		ws.on('close', () => {
			espSocket = null;
			console.log('Esp disconnected');

			webSockets.forEach((webSocket) => {
				webSocket.send([WSCmdType_ESP_STATE, 0]);
			});
		});
	}

	ws.on('message', (data) => {
		console.log('Message received');

		if (protocols[0] === 'esp') {
			console.log('Sending message to webapps');
			webSockets.forEach((webSocket) => {
				webSocket.send(data);
			});
		}

		if (protocols[0] === 'webapp') {
			console.log('Sending message to esp');
			if (espSocket) {
				espSocket.send(data);
			}
		}
	});
});

console.log('WebSocketServer listening on address: ', wss.address());