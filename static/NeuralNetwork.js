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
        } while (length > 0 && output.length < length);
        return output;
    }
}

var Random_1 = Random;

class NetworkShaper {

    // Random ball shape
    // (neurons linked at random)
    static ball (index, size) {
        var i = Random_1.integer(0, size);
        if (i !== index) {
            return i;
        }
        return null;
    }

    // Tube shape
    static tube (index, size) {
        var i, range = Math.ceil(size / 5);
        for (var tries = 0; tries < 3; tries++) {
            var from = -1 * range + index;
            var to = range + index;
            i = Random_1.integer(from, to);
            if (i > 0 && i < size && i !== index) {
                return i;
            }
        }
        return null;
    }

    // Snake shape
    static snake (index, size) {
        var i, range = Math.ceil(size / 20);
        for (var tries = 0; tries < 3; tries++) {
            var from = -1 * range + index;
            var to = range + index;
            i = Random_1.integer(from, to);
            if (i > 0 && i < size && i !== index) {
                return i;
            }
        }
        return null;
    }

    // Forward-biased sausage shape
    // (neurons linked to neurons with similar id, slightly ahead of each other)
    static sausage (index, size) {
        var i, range = Math.ceil(size / 10);
        var offset = index + Math.floor(range / 2);
        for (var tries = 0; tries < 3; tries++) {
            var from = -1 * range + offset;
            var to = range + offset;
            i = Random_1.integer(from, to);
            if (i > 0 && i < size && i !== index) {
                return i;
            }
        }
        i = Random_1.integer(0, size);
        if (i !== index) {
            return i;
        }
        return null;
    }

    // Doughnut shape
    static ring (index, size) {
        var i, range = Math.ceil(size / 20);
        var offset = index + Math.floor(range / 2);
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
            if (i !== index) {
                return i;
            }
        }
        return null;
    }
}


var NetworkShaper_1 = NetworkShaper;

class Utils {

    // Fast string hashing algorithm
    // Converts string to int predictably
    static hash(str){
        var char, hash = 0;
        if (!str) return hash;
        for (var i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    // Constrains a number between two others
    static constrain(n, from, to) {
        if (!isNaN(n)) {
            n = n < from ? from : n;
            n = n > to ? to : n;
        }
        return n;
    }

}

var Utils_1 = Utils;

const DEFAULTS = {
    shape: 'tube',              // shaper function name in NetworkShaper.js
    connectionsPerNeuron: 4,    // average synapses per neuron
    signalSpeed: 10,            // neurons per second
    signalFireThreshold: 0.3,   // potential needed to trigger chain reaction
    learningPeriod: 10 * 1000,  // milliseconds in the past on which learning applies
    learningRate: 0.08,         // max increase/decrease to connection strength when learning
};

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
    constructor(size, opts) {
        super();
        this.nodes = [];
        this.inputSites = [];
        this.outputSites = [];
        if (typeof size === 'number') {
            // Initialize with size
            this.init(opts);
            this.nodes = new Array(size)
                .fill()
                .map((n, i) => Neuron.generate(i, size, this.shaper, this.opts));
        }
        else if (size && size.nodes && size.nodes instanceof Array) {
            // Initialize with exported network
            let network = size;
            this.init(network.opts);
            this.nodes = network.nodes.map((n, i) => {
                let neuron = new Neuron(n.id, n.s, network.opts);
                neuron.synapses.forEach(s => s.i = s.t);
                return neuron;
            });
            this.inputSites = network.inputSites.slice();
            this.outputSites = network.outputSites.slice();
        }
        // Extra initialization per neuron
        this.nodes.forEach(neuron => {
            neuron.on('fire', (i, p) => this.emit('fire', i, p));
            // Add synapse ref pointers to corresponding target neurons
            neuron.synapses.forEach(s => s.t = this.nodes[s.i]);
        });
    }

    // Initialise
    init(opts) {
        switch(typeof opts) {
        // new NeuralNetwork(100, function shaper() {...} )
        case 'function':
            this.shaper = opts;
            this.opts = Object.assign({}, DEFAULTS);
            break;
        // new NeuralNetwork(100, { learningRate: 0.5, shape: 'sausage' });
        case 'object':
            this.shaper = NetworkShaper_1[opts.shape || DEFAULTS.shape];
            this.opts = Object.assign({}, DEFAULTS, opts);
            break;
        // new NeuralNetwork(100);
        // new NeuralNetwork(100, 'sausage');
        case 'undefined':
        case 'string':
            this.shaper = NetworkShaper_1[opts || DEFAULTS.shape];
            this.opts = Object.assign({}, DEFAULTS);
            break;
        }
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
            opts: Object.assign({}, this.opts),
            // Clone array of arrays
            inputSites: this.inputSites.map(i => i.slice()),
            outputSites: this.outputSites.map(i => i.slice())
        };
    }

    // Reinforces/weakens synapses that fired recently
    // network.learn()
    learn(rate) {
        const opts = this.opts;
        const now = new Date().getTime();
        const learningPeriod = this.opts.learningPeriod;
        const cutoff = now - learningPeriod;

        if (rate < 0) {
            // When something bad has happened, the lack of synapses
            // firing is also part of the problem, so we can
            // reactivate old/unused synapses for re-use.
            this.synapses
                .filter(s => !s.l || s.l < cutoff) // not used or less than the cutoff
                .filter(s => Math.random() < 0.05) // random 5% only
                .forEach(s => {
                    // Strengthen by learning rate
                    s.w += -1 * (rate * opts.learningRate || opts.learningRate);
                    s.w = Utils_1.constrain(s.w, -0.5, 1);
                });
        } else {
            // Decay synapses to allow new learning
            this.decay(rate || opts.learningRate);
        }
        this.synapses.forEach(s => {
            // Strengthen / weaken synapses that fired recently
            // in proportion to how recently they fired
            let recency = s.l - cutoff;
            // If synapse hasnt fired then use inverse.
            if (recency > 0) {
                s.w += (recency / learningPeriod) * (rate * opts.learningRate || opts.learningRate);
                // Make sure weight is between -0.5 and 1
                // Allow NEGATIVE weighing as real neurons do,
                // inhibiting onward connections in some cases.
                s.w = Utils_1.constrain(s.w, -0.5, 1);
            }
        });
        return this;
    }

    // Negative reinforcement (to avoid recent neural pathways)
    // network.unlearn()
    unlearn(rate) {
        return this.learn(-1 * (rate || 1));
    }

    // Forgetting is as important as remembering, otherwise we overload the network.
    // This algorithm is adaptive, in other words, connections
    // will decay significantly faster if there are too many of them.
    decay(rate) {
        const strength = this.strength;
        const synapses = this.synapses;
        const stableLevel = this.opts.signalFireThreshold / 2;
        // Use fast recursion (instead of Array.prototype.forEach)
        let i = synapses.length;
        while(i--) {
            const s = synapses[i], 
                decay = (s.w - stableLevel) * strength * rate;
            s.w -= decay * 5;
        }
        return this;
    }

    /**
     * Creates an input site to send data INTO the network
     * ```
     * const left_mic = network.inputSite(4);            // -> 4 bit input site
     * const left_mic = network.inputSite([6,7,8,9])     // -> 4 specific neurons in input site
     * const left_mic = network.inputSite([n1,n2,n3,n4]) // -> 4 specific neurons - by ref 
     * ```
     * @param {number|number[]|Neuron[]} bits neurons involved in input site 
     * @return {number} id of input site
     */
    inputSite(bits, id) {
        return bits && this.site(bits, false);
    }

    /**
     * Creates an output site to send information OUT OF the network
     * ```
     * const left_wheel = network.outputSite(4);            // -> 4 bit output site
     * const left_wheel = network.outputSite([6,7,8,9])     // -> 4 specific neurons in output site
     * const left_wheel = network.outputSite([n1,n2,n3,n4]) // -> 4 specific neurons - by ref
     * ```
     * @param {number|number[]|Neuron[]} bits neurons involved in output site
     * @return {number} id of the input site
     */
    outputSite(bits) {
        return bits && this.site(bits, true);
    }

    site(bits, isOutput) {
        const site = isOutput ? this.outputSites : this.inputSites;
        const index = site.length;
        let nodes = bits && bits.map && bits.map(n => n instanceof Neuron ? n : this.nodes[n]);
        if (!nodes) {
            // Find starting/ending point and add nodes to site
            let startPos = isOutput ? 
                site.reduce((a, s) => Math.min.apply(null, s.concat(a)), this.size) :
                site.reduce((a, s) => Math.max.apply(null, s.concat(a)), 0);
            let endPos = this.size - 1 - startPos;
            nodes = new Array(bits)
                .fill()
                .map((n, i) => this.nodes[isOutput ? endPos - i : startPos + i]);
        }
        site[index] = nodes;
        return index;
    }

    /**
     * Input some data into the neural network
     * ```
     * // input data using a single (main) input site
     * network.input(0.45);
     * // use left/right microphone to input data
     * const left_mic_site = network.inputSite(4); 
     * const right_mic_site = network.inputSite(4);
     * left_mic.on('change', val => network.input(val / 1024, left_mic_site));
     * lect_mic.on('change', val => network.input(val / 1024, right_mic_site));
     * ```
     * @param {number} data input signal potential (between 0 and 1)  
     * @param {number} index id of input site
     */
    input(data, index) {
        let inputNodes = this.inputSites[index || 0] || this.inputSites[this.inputSite()];
        if (typeof data === 'number' && inputNodes && inputNodes.length) {
            // Distribute input signal across nodes
            const potential = Utils_1.constrain(data, 0, 1);
            let i = inputNodes.length;
            while(i--) inputNodes[i].fire(potential);
        }
    }

    /**
     * Creates an output site and returns event emitter
     * ```
     * let output = network.output(4); -> 4 bit listener
     * output.on('data', data => console.log(data)); -> fires when there is data
     * output.on('change', data => console.log(data)); -> fires when there is a change
     * ```
     * @param {number|number[]|Neuron[]} bits neurons involved in the output
     * @param {number} index 
     */
    output(bits) {
        const observable = new events();
        const outputNodes = this.outputSites[this.outputSite(bits)];
        this.on('fire', id => {
            const neuron = this.nodes[id];
            if (outputNodes.indexOf(neuron)) {
                const last = observable.lastValue;
                // Calculate average potential across all nodes
                const potential = outputNodes
                    .reduce((pot, n) => pot + (n.isfiring ? n.potential/bits : 0), 0);
                observable.emit('data', potential);
                if (last !== potential) {
                    let diff = (last - potential) || undefined;
                    observable.emit('change', potential, last, diff);
                }
                observable.lastValue = potential;
            }
        });
        return observable;
    }

    /**
     * Fire an individual neuron, used for testing and visualization
     * ```
     * network.fire(24);
     * ```
     * @param {number} id 
     * @return {NeuralNetwork}
     */
    fire(id) {
        if (id && this.nodes[id]) {
            return this.nodes[id].fire();
        }
    }

    /** 
     * Stops the network firing, used for testing and visualization
     * ```
     * network.stop();
     * ```
     * @return {NeuralNetwork}
     */
    stop() {
        this.nodes.forEach(n => clearTimeout(n.timeout));
        return this;
    }

    /** 
     * Allows 2 networks to be chained together creating a third network. 
     * ```
     * let network3 = network1.concat(network2)
     * ```
     * @param {NeuralNetwork} network extra network to append
     * @param {number} at location (between 0-1) where the network should be appended
     * @param {number} surfaceArea % of nodes overlapping
     * @return {NeuralNetwork} resulting neural network
     */
    concat(network, at, surfaceArea) {
        let clone = this.clone(); // default settings will be as per first network
        let size = clone.size;
        if (network && network.nodes) {
            network = network instanceof NeuralNetwork ? network : new NeuralNetwork(network);
            surfaceArea = surfaceArea || 0.05; // 5% nodes overlapping (bear in mind 4 synapses per node is 20% node overlap)
            at = at || 0.975; // where should we intersect? Beginning = 0, End = 1;
            let fromPos = Math.floor(at*size - size*(surfaceArea/2));
            let toPos = Math.ceil(at*size + size*(surfaceArea/2));
            clone.nodes.forEach((neuron, i) => {
                if (i >= fromPos && i <= toPos) {
                    let n = Neuron.generate(i, size, () => Random_1.integer(size, size * (1+surfaceArea)), clone.opts);
                    neuron.synapses.push(...n.synapses);
                }
            });
            let nodes = network.nodes.map(n => n.clone({ opts: clone.opts }, size));
            clone.nodes.push(...nodes);
            clone.synapses.forEach(s => s.t = clone.nodes[s.i]);
            clone.inputSites.push(...network.inputSites.map(c => c.map(n => n + size)));
            clone.outputSites.push(...network.outputSites.map(d => d.map(n => n + size)));
            nodes.forEach(n => n.on('fire', (i, p) => clone.emit('fire', i, p)));
        }
        return clone;
    }

    /** Number of neurons in network */
    get size() {
        return this.nodes.length;
    }

    /** Percentage of active synapses in network */
    get strength() {
        let synapses = this.synapses;
        return synapses.filter(s => s.w > this.opts.signalFireThreshold).length / synapses.length;
    }

    /** Array of synapses */
    get synapses() {
        return this.nodes.reduce((acc, node) => acc.concat(node.synapses), []);
    }
}

class Neuron extends events {

    constructor(index, synapses, opts) {
        super();
        this.synapses = synapses || [];
        this.id = index > -1 ? index : Random_1.alpha(6);
        this.potential = 0;
        this.opts = opts || DEFAULTS;
    }

    // Generates a neuron
    static generate(index, size, shaper, opts) {
        // Number of synapses are random based on average
        let synapses = new Array(Random_1.integer(1, opts.connectionsPerNeuron * 2 - 1))
            .fill()
            .map(() => {
                let i = shaper(index, size),
                    // weight is between -0.5 and 1, averaging around 0.25
                    w = -0.5 + Math.random() * 1.5;

                if (i) {
                    return { i, w }; // index, weight
                }
                // Cannot find suitable target
                return null;
            })
            .filter(s => !!s);
        return new Neuron(index, synapses, opts);
    }

    // Clones a neuron, useful when concatenating networks
    clone(overrides, offset) {
        overrides = overrides || {};
        offset = offset || 0;
        let synapses = this.synapses.map(s => Object.assign({}, s, { i: offset + s.i }));
        let neuron = new Neuron(offset + this.id, synapses, this.opts);
        return Object.assign(neuron, overrides);
    }

    // Should be optimised as this gets executed very frequently.
    fire(potential) {
        if (this.isfiring) return false;
        const opts = this.opts;
        const signalFireDelay = 1000 / opts.signalSpeed;
        const signalRecovery = signalFireDelay * 10;
        // Action potential is accumulated so that
        // certain patterns can trigger even weak synapses.
        potential = isNaN(potential) ? 1 : potential;
        this.potential += potential;
        // But duration is very short
        setTimeout(() => this.potential -= potential, signalFireDelay);
        // Should we fire onward connections?
        if (this.potential > opts.signalFireThreshold) {
            this.isfiring = true;
            this.timeout = setTimeout(() => {
                this.emit('fire', this.id, potential);
                // Attempt firing onward connections
                let i = this.synapses.length;
                while(i--) {
                    let s = this.synapses[i];
                    if (s && s.t && s.t.fire(s.w)) {
                        // Time synapse last fired is important
                        // to learn from recent past
                        s.l = new Date().getTime();
                    }
                }
            }, signalFireDelay);
            // Post-fire recovery
            // Ideally should bear in mind refractory periods
            // http://www.physiologyweb.com/lecture_notes/neuronal_action_potential/neuronal_action_potential_refractory_periods.html
            setTimeout(() => {
                this.potential = 0;
                this.isfiring = false;
                this.emit('ready', this.id);
            }, signalRecovery);
        }
        return this;
    }

}

// Nested class
NeuralNetwork.Neuron = Neuron;

var NeuralNetwork_1 = NeuralNetwork;

return NeuralNetwork_1;

})));
