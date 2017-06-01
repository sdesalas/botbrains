"use strict";

const path = require('path');
const http = require('http');
const qs = require('querystring');
const nodeStatic = require('node-static');
const io = require('socket.io');

class Toolkit {

    static serve(port) {
        port = port || this.port || 8811;
        if (!this.server) {
            let ns = new nodeStatic.Server(__dirname + '/../static');
            this.server = http.createServer((request, response) => {
                request.on('end', () => ns.serve(request, response)).resume();
            });
            this.server.listen(port);
            this.server.port = port;
            this.io = io.listen(this.server);
            this.io.sockets.on('connection', this.connection.bind(this));
        }
        return this.server;
    }

    static connection(socket) {
        console.log('Toolkit.connection()');
        socket.emit('connection', this.network && this.network.export());
        this.network.on('fire', id => console.log('firing', id) || socket.emit('fire', id));
    }

    static visualise(network, port) {
        this.network = network;
        return this.serve(port);
    }

}

module.exports = Toolkit;
