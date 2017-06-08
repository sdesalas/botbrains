"use strict";

const path = require('path');
const http = require('http');
const qs = require('querystring');
const nodeStatic = require('node-static');
const io = require('socket.io');

class Toolkit {

    static serve(port) {
        if (!this.server) {
            let ns = new nodeStatic.Server(__dirname + '/../static');
            this.server = http.createServer((request, response) => {
                request.on('end', () => ns.serve(request, response)).resume();
            });
            this.server.listen(port);
            this.server.port = port;
            if (this.io) {
                this.io.disconnect() || this.io.close();
            }
            this.io = io.listen(this.server);
            this.io.sockets.on('connection', this.connection.bind(this));
        }
        return this.server
    }

    static connection(socket) {
        console.log('Toolkit.connection()');
        socket.emit('connection', this.network && this.network.export());
        this.network.on('fire', (id, potential) => socket.emit('fire', id) && this.verbose && console.log(`firing ${id} with potential ${potential}`));
        socket.on('learn', () => socket.emit('update', this.network.learn().export()) && this.verbose && console.log('learn', this.network.synapses[0].w));
        socket.on('unlearn', () => socket.emit('update', this.network.unlearn().export()) && this.verbose && console.log('unlearn', this.network.synapses[0].w));
    }

    static visualise(network, port) {
        if (network) {
            this.network = network;
            return this.serve(port || 8811);
        }
    }

}

module.exports = Toolkit;
