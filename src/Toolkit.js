'use strict';

const http = require('http');
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
      if (this.io) {
        this.io.disconnect() || this.io.close();
      }
      this.io = io.listen(this.server);
      this.io.sockets.on('connection', this.connection.bind(this));
    }
    return this.server;
  }

  static connection(socket) {
    socket.emit('connection', this.network && this.network.export());
    this.network.on('fire', (id, potential) => socket.emit('fire', id) && this.verbose && console.log(`firing ${id} with potential ${potential}`));
    socket.on('learn', () => socket.emit('update', this.network.learn().export()) && this.verbose && console.log('learn', this.network.synapses[0].w));
    socket.on('unlearn', () => socket.emit('update', this.network.unlearn().export()) && this.verbose && console.log('unlearn', this.network.synapses[0].w));
    setInterval(() => socket.emit('update', this.network.export()), 1000);
  }

  static visualise(network, port) {
    if (network) {
      this.network = network;
      return this.serve(port || 8811);
    }
  }

}

module.exports = Toolkit;
