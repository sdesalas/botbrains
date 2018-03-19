'use strict';

const http = require('http');
const nodeStatic = require('node-static');
const io = require('socket.io');
const osUtils = require('os-utils');
const os = require('os');

let cpuLoad = 0;

class Toolkit {

  static visualise(network, port) {
    if (network) {
      this.network = network;
      this.network.on('fire', (id, potential, by) => this.verbose && console.log(`Firing ${id} with potential ${potential} by ${by}`));
      return this.serve(port || 8811);
    }
  }

  static serve(port) {
    if (!this.server) {
      const staticServer = new nodeStatic.Server(__dirname + '/../static');
      this.server = http.createServer((request, response) => {
        request.on('end', () => staticServer.serve(request, response)).resume();
      }).listen(port);
      if (this.io) {
        this.io.disconnect() || this.io.close();
      }
      this.io = io.listen(this.server, {'forceNew': true });
      this.io.sockets.on('connection', this.onConnection.bind(this));
    }
    return this.server;
  }

  static onConnection(socket) {
    socket.emit('connection', this.network && this.network.export());
    // Track connected clients
    let clientCount = 0;
    console.log(`connection. clients: ${++clientCount}`);
    // Track neuron change reactions, using 'volatile' mode if needed
    this.network.on('fire', (id) => {
      if (cpuLoad < 0.8 && this.network.size < 600) socket.emit('fire', id);
      else socket.volatile.emit('fire', id);
    });
    // Handle incoming events
    ['learn', 'unlearn'].forEach(event => {
      socket.on(event, data => this.handle(socket, event, data));
    });
    // Polling to keep client updated of the state of the network
    const statsInterval = setInterval(() => this.getStats(stats => socket.emit('stats', stats)), 200);
    const updateInterval = setInterval(() => this.checkUpdate(socket, this.network.hash), 1000);
    // Disconnect
    socket.on('disconnect', () => {
      console.log(`disconnect. clients: ${--clientCount}`);
      clearInterval(statsInterval);
      clearInterval(updateInterval);
    });
    // Load data
    socket.on('upload', data => console.log({data}));
  }

  static handle(socket, event, data) {
    if (this.verbose) console.log(`Toolkit.handle(socket, ${event})`);
    switch(event) {
      case 'learn':
        this.network.learn();
        return;
      case 'unlearn':
        this.network.unlearn();
        return;
    }
  }

  static checkUpdate(socket, hash) {
    // Send event, but only if the network has changed
    //console.log(`Checking hash ${hash} vs lastHash ${this.lastHash} = ${(!this.lastHash || this.lastHash !== hash) ? 'UPDATE!!' : ''}`);
    if (!this.lastHash || this.lastHash !== hash) {
      this.lastHash = hash;
      socket.emit('update', this.network.export());
    }
  }

  static getStats(callback) {
    osUtils.cpuUsage(cpu => {
      const totalmem = os.totalmem();
      const usedmem = totalmem - os.freemem();
      const mem = usedmem/totalmem;
      cpuLoad = cpu;
      callback({
        cpu: Number(cpu.toFixed(2)),
        mem: Number(mem.toFixed(2))
      });
    });
  }

}

module.exports = Toolkit;
