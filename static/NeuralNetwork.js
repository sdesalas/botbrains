(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.botbrain = global.botbrain || {}, global.botbrain.NeuralNetwork = factory());
}(this, (function () { 'use strict';

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
var events = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

class Random {

    // Inclusive random integers
    static integer(from, to) {
        if (!from && !to) return 0;
        if (!to) { to = from; from = 0; }
        var diff = to + 1 - from;
        return Math.floor(Math.random() * diff) + from;
    }

    static alpha(length) {
        var output = '';
        do {
            output += Math.random().toString('16').substr(2);
            if (output.length > length) {
                output = output.substr(0,length);
            }
        } while (length > 0 && output.length < length)
        return output;
    }
}

var Random_1 = Random;

class NetworkShaper {

    // Random ball shape
    // (neurons linked at random)
    static ball (position, size) {
        var i = Random_1.integer(0, size);
        if (i !== position) {
            return i;
        }
        return null;
    }

    // Tube shape
    static tube (position, size) {
        var i, range = Math.ceil(size / 5);
        for (var tries = 0; tries < 3; tries++) {
            var from = -1 * range + position;
            var to = range + position;
            i = Random_1.integer(from, to);
            if (i > 0 && i < size && i !== position) {
                return i;
            }
        }
        return null;
    }

    // Snake shape
    static snake (position, size) {
        var i, range = Math.ceil(size / 20);
        for (var tries = 0; tries < 3; tries++) {
            var from = -1 * range + position;
            var to = range + position;
            i = Random_1.integer(from, to);
            if (i > 0 && i < size && i !== position) {
                return i;
            }
        }
        return null;
    }

    // Forward-biased sausage shape
    // (neurons linked to neurons with similar id, slightly ahead of each other)
    static sausage (position, size) {
        var i, range = Math.ceil(size / 10);
        var offset = position + Math.floor(range / 2);
        for (var tries = 0; tries < 3; tries++) {
            var from = -1 * range + offset;
            var to = range + offset;
            i = Random_1.integer(from, to);
            if (i > 0 && i < size && i !== position) {
                return i;
            }
        }
        i = Random_1.integer(0, size);
        if (i !== position) {
            return i;
        }
        return null;
    }

    // Doughnut shape
    static ring (position, size) {
        var i, range = Math.ceil(size / 20);
        var offset = position + Math.floor(range / 2);
        for (var tries = 0; tries < 3; tries++) {
            var from = -1 * range + offset;
            var to = range + offset;
            i = Random_1.integer(from, to);
            if (i >= size) {
                return i - size; // Link to beginning
            }
            if (i < 0) {
                return size + i; // Link to end
            }
            if (i !== position) {
                return i;
            }
        }
        return null;
    }
}


var NetworkShaper_1 = NetworkShaper;

const NETWORK_DEFAULT_SHAPE = 'sausage';
const SYNAPSE_AVG_PER_NEURON = 4;
const SIGNAL_MAX_FIRE_DELAY = 200;
const SIGNAL_RECOVERY_DELAY = 1250;
const SIGNAL_FIRE_THRESHOLD = 0.3;
const LEARNING_RATE = 0.3;
const LEARNING_PERIOD = 60 * 1000;
const MESSAGE_DEFAULT_SIZE = 10; // 10 bit messages by default (max 1024)

class NeuralNetwork extends events {

    // Initialize neural network
    // Either using size or network definition
    // new NeuralNetwork(20);
    // new NeuralNetwork({ nodes: [
    //   {id: 1, s: [{t: 1, w: 0.41}] },
    //   {id: 2, s: [{t: 2, w: 0.020}, {t: 3, w: 0.135}] },
    //   {id: 3, s: [{t: 5, w: 0.241}] },
    //   {id: 4, s: [{t: 1, w: 0.02}] },
    //   {id: 5, s: [{t: 6, w: 0.92}, {t: 2, w: 0.41}] },
    //   {id: 6, s: [{t: 2, w: 0.41}] }
    // ]})
    constructor(size, shape) {
        super();
        this.shape = shape || NETWORK_DEFAULT_SHAPE;
        this.nodes = [];
        this.channels = []; // input sites
        this.drains = []; // output sites
        if (typeof size === 'number') {
            // Initialize with size
            this.nodes = new Array(size)
                .fill()
                .map((n, i) => Neuron.random(i, size, this.shape));
        }
        else if (size && size.nodes && size.nodes instanceof Array) {
            // Initialize with exported network
            let network = size;
            this.nodes = network.nodes.map((n, i) => {
                let neuron = new Neuron(n.s, n.id);
                neuron.synapses.forEach(s => s.i = s.t);
                return neuron;
            });
            this.channels = network.channels.slice();
            this.drains = network.drains.slice();
        }
        // Extra initialization per neuron
        this.nodes.forEach(neuron => {
            neuron.on('fire', id => this.emit('fire', id));
            // Add synapse ref pointers to corresponding target neurons
            neuron.synapses.forEach(synapse => {
                synapse.t = this.nodes[synapse.i];
            });
        });
        //this.on('fire', id => console.log(id));
    }

    // Clones network, useful to mutating network to determine fittest alternative
    // network.clone()
    clone() {
        return new NeuralNetwork(this.export());
    }

    // Exports network, useful for cloning and saving to disk
    // network.export()
    export() {
        return {
            nodes: this.nodes.map(node => Object({
                id: node.id,
                s: node.synapses
                    .slice()
                    // Remove circular ref pointers
                    .map(s => Object({t: s.i, w: s.w}))
            })),
            // Clone array of arrays
            channels: this.channels.map(i => i.slice()),
            drains: this.drains.map(i => i.slice())
        }
    }

    // Reinforces synapses that fire recently
    // network.learn()
    learn(rate) {
        const start = new Date().getTime() - LEARNING_PERIOD;
        this.synapses
            .forEach(s => {
                const recency = s.l - start;
                if (recency > 0) {
                    s.w += (recency / LEARNING_PERIOD) * (rate || LEARNING_RATE);
                    s.w = s.w < 0 ? 0 : s.w;
                    s.w = s.w > 1 ? 1 : s.w;
                }
            });
    }

    // Weakens synapses that fired recently
    // network.unlearn()
    unlearn(rate) {
        this.learn(-1 * (rate || LEARNING_RATE));
    }

    // Creates channel, defaulted to MESSAGE_DEFAULT_SIZE bits (neurons)
    // network.channel() -> inward, next available
    // network.channel(2) -> inward at slot 2 (ie, 3rd slot -> 0-indexed)
    // network.channel(2, 16) -> inward, slot 2 at set size
    // network.channel(2, 16, true) -> outward, slot 2 at set size
    // network.channel(2, [2,3,4,5,6,7]) -> inward slot 2 with array of predefined nodes
    channel(index, bits, outward) {
        let channels = outward ? this.drains : this.channels;
        index = index || channels.length;
        bits = typeof bits === 'number' ? bits : MESSAGE_DEFAULT_SIZE;
        let nodes = bits instanceof Array ? bits : undefined;
        if (!nodes) {
            // Find starting/ending point and add nodes to channel
            let startPos = channels.reduce((a, c) => a + c.length, 0);
            let endPos = network.size - 1 - startPos;
            nodes = new Array(bits).fill().map((n, i) => outward ? endPos - i : startPos + i);
        }
        channels[index] = nodes;
        return nodes;
    }

    // Input some data into the neural network
    // network.input(71); -> input at main
    // network.input(23, 1); -> input at 1 (2nd slot, 0-indexed)
    input(data, index) {
        let bytes,
            inputNodes = this.channels[index || 0] || this.channel();
        const max = Math.pow(2, MESSAGE_DEFAULT_SIZE) - 1;
        if (typeof data === 'number' && inputNodes && inputNodes.length) {
            data = (data > max) ? max : (data < 0) ? 0 : data;
            bytes = data.toString(2).split('');
            while (bytes.length < inputNodes.length) {
                bytes.unshift('0');
            }
            // Apply bits in data to each neuron listed under inputs
            // 1 = fire neuron, 0 = skip
            bytes.forEach((byte, i) => {
                let node = this.nodes[inputNodes[i]];
                if (byte === '1' && node) {
                    node.fire();
                }
            });
            return bytes.join('');
        }
    }

    // Registers an output drain and returns event emitter
    // let observable = network.output(4); -> 4 bit listener
    // observable.on('data', data => console.log(data)); -> fires when there is data
    // observable.on('change', data => consoe.log(data)); -> fires when there is a change
    output(bits) {
        let observable = new events();
        let index = this.drains.length,
            outputNodes = this.channel(index, bits, true);
        this.on('fire', id => {
            if (outputNodes.indexOf(id)) {
                let data = outputNodes.map(i => this.nodes[i] && this.nodes[i].isfiring ? 1 : 0);
                observable.emit('data', data);
            }
        });
        return observable;
    }

    // Fire a neuron, used for testing and visualization
    // network.fire(24);
    fire(id) {
        if (id && this.nodes[id]) {
            this.nodes[id].fire();
        }
    }

    // Stops the network firing, used for testing and visualization
    // network.stop();
    stop() {
        this.synapses.forEach(s => clearTimeout(s.c));
    }

    get size() {
        return this.nodes.length;
    }

    get strength() {
        let synapses = this.synapses;
        return synapses.map(s => s.w).reduce((a,b) => a+b, 0) / synapses.length;
    }

    get synapses() {
        return this.nodes.reduce((acc, node) => acc.concat(node.synapses), []);
    }
}

class Neuron extends events {

    constructor(synapses, index) {
        super();
        this.synapses = synapses || [];
        this.id = index > -1 ? index : Random_1.alpha(6);
        this.potential = 0;
    }

    // Generates a random neuron
    static random(position, networkSize, shape) {
        // Number of synapses are random based on average
        let synapses = new Array(Random_1.integer(1, SYNAPSE_AVG_PER_NEURON * 2 - 1))
            .fill()
            .map(() => {
                let shaper = NetworkShaper_1[shape],
                    i = shaper(position, networkSize),
                    w = Math.pow(Math.random(), 3);

                if (i) {
                    return { i, w }; // index, weight
                }
                // Cannot find suitable target
                return null;
            })
            .filter(s => !!s);
        return new Neuron(synapses, position);
    }

    // Should be optimised as this gets executed very frequently.
    fire(potential) {
        if (this.isfiring) return false;
        // Action potential is accumulated so that
        // certain patterns can trigger even
        // weak synapses.
        this.potential += potential || 1;
        setTimeout(() => this.potential -= potential, SIGNAL_RECOVERY_DELAY / 2);
        if (this.potential > SIGNAL_FIRE_THRESHOLD) {
            // Fire signal
            this.isfiring = true;
            this.emit('fire', this.id);
            this.synapses.forEach(synapse => {
                if (synapse.t) {
                    // Stronger connections will fire quicker
                    // @see Conduction Velocity: https://faculty.washington.edu/chudler/cv.html
                    synapse.c = setTimeout(() => {
                        if (synapse.t.fire(synapse.w)) {
                            // Avoid epileptic spasm by tracking when last fired
                            synapse.l = new Date().getTime();
                        }
                    }, Math.round(SIGNAL_MAX_FIRE_DELAY * (1 - synapse.w)));

                }
            });
            // Post-fire recovery
            setTimeout(() => {
                this.potential = 0;
                this.isfiring = false;
                this.emit('ready', this.id);
            }, SIGNAL_RECOVERY_DELAY);
        }
        return true;
    }

}


var NeuralNetwork_1 = NeuralNetwork;

return NeuralNetwork_1;

})));
