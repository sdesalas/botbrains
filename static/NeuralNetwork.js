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

  // Random between 0 and 1 with gaussian distribution
  static gaussian(tightness) {
    tightness = tightness || 6;
    var output = 0;
    for(var i = 0; i < tightness; i++)  {
      output += Math.random();
    }
    return output / tightness;
  }
}

var Random_1 = Random;

class NetworkShaper {

  // Random ball shape
  // (neurons linked at random)
  static ball (neuron, size) {
    var target = Random_1.integer(0, size - 1);
    if (target !== neuron) {
      return target;
    }
    return undefined;
  }

  // Tube shape
  static tube (neuron, size) {
    var target, range = Math.ceil(size / 5);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + neuron;
      var to = range + neuron;
      target = Random_1.integer(from, to);
      if (target >= 0 && target < size && target !== neuron) {
        return target;
      }
    }
    return undefined;
  }

  // Snake shape
  static snake (neuron, size) {
    var target, range = Math.ceil(size / 20);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + neuron;
      var to = range + neuron;
      target = Random_1.integer(from, to);
      if (target > 0 && target < size && target !== neuron) {
        return target;
      }
    }
    return undefined;
  }

  // Forward-biased sausage shape
  // (neurons linked to neurons with similar id, slightly ahead of each other)
  static sausage (neuron, size) {
    var target, range = Math.ceil(size / 10);
    var offset = neuron + Math.floor(range / 2);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + offset;
      var to = range + offset;
      target = Random_1.integer(from, to);
      if (target > 0 && target < size && target !== neuron) {
        return target;
      }
    }
    target = Random_1.integer(0, size);
    if (target !== neuron) {
      return target;
    }
    return undefined;
  }

  // Ring shape
  static ring (neuron, size) {
    var target, range = Math.ceil(size / 20);
    var offset = neuron + Math.floor(range / 2);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + offset;
      var to = range + offset;
      target = Random_1.integer(from, to);
      if (target >= size) {
        return target - size; // Link to beginning
      }
      if (target < 0) {
        return size + target; // Link to end
      }
      if (target !== neuron) {
        return target;
      }
    }
    return undefined;
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
  signalSpeed: 20,            // neurons per second
  signalFireThreshold: 0.3,   // potential needed to trigger chain reaction
  learningPeriod: 10 * 1000,  // milliseconds in the past on which learning applies
  learningRate: 0.15,          // max % increase/decrease to synapse strength when learning
};

class NeuralNetwork extends events {
    
  /**
     * Initialize neural network
     * Either using size or serialized version
     * ```
     * new NeuralNetwork(20);
     * new NeuralNetwork({ nodes: [
     *   {id: 0, s: [{i: 1, w: 0.41}] },
     *   {id: 1, s: [{i: 2, w: 0.020}, {t: 3, w: 0.135}] },
     *   {id: 2, s: [{i: 5, w: 0.241}] },
     *   {id: 3, s: [{i: 1, w: 0.02}] },
     *   {id: 4, s: [{i: 6, w: 0.92}, {t: 2, w: 0.41}] },
     *   {id: 5, s: [{i: 2, w: 0.41}] }
     * ]});
     * ```
     * @param {int|Object} size 
     * @param {Object} opts 
     */
  constructor(size, opts) {
    super();
    this.nodes = [];
    this.inputs = {};
    this.outputs = {};
    if (typeof size === 'number') {
      // Initialize with size
      this.init(opts);
      this.nodes = new Array(size)
        .fill()
        .map((n, i) => Neuron.generate(i, size, this.shaper, this.opts));
    }
    else if (size && size.nodes && size.nodes instanceof Array) {
      // Initialize with exported network
      const network = size;
      this.init(network.opts);
      this.nodes = network.nodes.map(n => new Neuron(n.id, n.s, network.opts));
      Object.keys(network.inputs || {}).forEach(k => this.inputs[k] = network.inputs[k].map(i => this.nodes[i]));
      Object.keys(network.outputs || {}).forEach(k => this.outputs[k] = network.outputs[k].map(i => this.nodes[i]));
    }
    // Extra initialization per neuron
    this.nodes.forEach(neuron => {
      neuron.on('fire', (i, p) => this.emit('fire', i, p));
      // Add synapse ref pointers to corresponding target neurons
      neuron.synapses.forEach(s => s.target = this.nodes[s.t]);
    });
  }

  /** Initialise options */ 
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

  /**
     * Clones network, useful to mutating network to determine fittest alternative
     */
  clone() {
    return new NeuralNetwork(this.export());
  }

  /**
     * Exports network, useful for cloning and saving to disk
     */
  export() {
    const inputs = {}, outputs = {};
    for(const k in this.inputs) { inputs[k] = this.inputs[k].map(n => n.id); }
    for(const k in this.outputs) { outputs[k] = this.outputs[k].map(n => n.id); }
    return {
      nodes: this.nodes.map(node => Object({
        id: node.id,
        s: node.synapses
          .slice()
          // Remove circular ref pointers, use long term synapse weight
          .map(s => Object({t: s.t, w: s.w}))
      })),
      opts: Object.assign({}, this.opts),
      // Clone arrays inside hashmaps
      inputs,
      outputs
    };
  }

  /**
     * Reinforces/weakens synapses that fired recently
     * ```
     * network.learn();    // Do more of something in recent past
     * network.learn(-1):  // Do less of something in recent past
     * network.learn(0.1); // Same with 10% strength
     * ```
     * @param {float} [rate=1] rate of learning (betweent 0 and 1)
     */
  learn(rate) {
    const opts = this.opts;
    const now = new Date().getTime();
    const learningPeriod = this.opts.learningPeriod;
    const cutoff = now - learningPeriod;
    rate = Utils_1.constrain(isNaN(rate) ? 1 : rate, -1, 1);

    if (rate < 0) {
      // When something bad has happened, the lack of synapses
      // firing is also part of the problem, so we can
      // reactivate old/unused synapses for re-use.
      this.synapses
        .filter(s => !s.l || s.l < cutoff) // not used or less than the cutoff
        .filter(s => Math.random() < 0.05) // random 5% only
        .forEach(s => {
          // Strengthen by learning rate
          s.w += -1 * rate * opts.learningRate;
          s.w = Utils_1.constrain(s.w, -0.5, 1);
        });
    }
    // Decay synapses to allow new learning
    this.decay(rate * opts.learningRate);
    //}
    // Strengthen / weaken synapses that fired recently
    // in proportion to how recently they fired
    this.synapses.forEach(s => {
      const recency = s.l - cutoff;
      // If synapse hasnt fired then use inverse.
      if (recency > 0) {
        s.w *= 1 + (recency / learningPeriod) * (rate * opts.learningRate);
        // Make sure weight is between -0.5 and 1
        // Allow NEGATIVE weighing as real neurons do,
        // inhibiting onward connections in some cases.
        s.w = Utils_1.constrain(s.w, -0.5, 1);
      }
    });
    return this;
  }

  /**
     * Negative reinforcement (to avoid recent neural pathways)
     * ```
     * network.unlearn();    // Avoid something in recent past
     * network.unlearn(0.1); // Same with 10% strength
     * ```
     * @param {float} [rate=1]
     */
  unlearn(rate) {
    return this.learn(-1 * (rate || 1));
  }

  /**
     * Forgetting is as important as remembering, otherwise we overload the network.
     * This algorithm is adaptive, in other words, connections
     * will decay significantly faster if there are too many of them.
     * @param {float} [rate=1] rate of decay, between 0 and 1 
     */
  decay(rate) {
    const strength = (1-Math.pow(1-this.strength, 6)) * Math.abs(rate);
    const synapses = this.synapses;
    const stableLevel = this.opts.signalFireThreshold / 2;
    // Use fast recursion (instead of Array.prototype.forEach)
    let i = synapses.length;
    while(i--) {
      const s = synapses[i], 
        avgWeight = (s.w + s.ltw) / 2;
      // short term weight decays fast
      s.w = strength * stableLevel + (1-strength) * avgWeight;
      // long term weight decays slowly
      s.ltw = s.ltw * 3/4 + avgWeight * 1/4;
    }
    return this;
  }

  /**
     * Creates a site to send information INTO or OUT OF the network
     * ```
     * // 1 bit output site
     * const left_wheel = network.createSite(this.outputs, 'Wheel (L)');
     * // 4 bit output site        
     * const left_wheel = network.createSite(this.outputs, 'Wheel (L)', 4); 
     * // 4 specific neurons in output site
     * const left_wheel = network.createSite(this.outputs, 'Wheel (L)', [6,7,8,9]);
     * // 4 specific neurons (by ref)
     * const left_wheel = network.createSite(this.outputs, 'Wheel (L)', [n1,n2,n3,n4]);
     * ```
     * @param {Object} location the location (either network.inputs or network.outputs)
     * @param {String} label a label describing what the input/output is for
     * @param {int|int[]|Neuron[]} [bits=1] neurons involved in input/output site
     * @return {Array} the input/output site
     */
  createSite(location, label, bits) {
    const isOutput = location === this.outputs;
    const site = location[label || Random_1.alpha(4).toUpperCase()] = [];
    let nodes = bits && bits.map && bits.map(n => n instanceof Neuron ? n : this.nodes[n]);
    if (!nodes) {
      // Find starting/ending point and add nodes to site
      const pos = isOutput ? 
        Object.keys(location).reduce((a, k) => Math.min.apply(null, location[k].map(n => n.id).concat(a)), this.size) - 2 :
        Object.keys(location).reduce((a, k) => Math.max.apply(null, location[k].map(n => n.id).concat(a)), 0) + 2;
      nodes = new Array(bits || 1)
        .fill()
        .map((b, i) => this.nodes[isOutput ? pos - i : pos + i]);
    }
    site.push(...nodes);
    return site;
  }

  /**
     * Creates an input site and returns a function
     * ```
     * // use left/right microphone to input data
     * const right_mic_input = network.input('Right Mic');
     * ```
     * @param {String} label a label describing what the input is for
     * @param {int|int[]|Neuron[]} [bits=1] neurons involved in input site 
     * @return {Function} a function used to input data into the network
     */
  input(label, bits) {
    const inputNodes = this.inputs[label] || this.createSite(this.inputs, label, bits);
    /**
     * Inputs some data into the neural network
     * ```
     * left_mic.on('change', val => network.input('Left Mic')(val / 1024));
     * ```
     * @param {float} data a number between 0 and 1
     */
    return function(data) {
      if (typeof data === 'number' && inputNodes && inputNodes.length) {
        // Distribute input signal across nodes
        const potential = Utils_1.constrain(data, 0, 1);
        let i = inputNodes.length;
        while(i--) inputNodes[i].fire(potential);
      }
    };
  }

  /**
     * Creates an output site and returns event emitter
     * ```
     * const output = network.output('Motor (R)'); 
     * output.on('data', data => console.log(data)); -> fires when there is data
     * output.on('change', data => console.log(data)); -> fires when there is a change
     * ```
     * @param {String} label a label describing what the output is for
     * @param {int|int[]|Neuron[]} bits neurons involved in the output
     * @return {EventEmitter} an event emitter used to capture output from the network
     */
  output(label, bits) {
    const observable = new events();
    const outputNodes = this.outputs[label] || this.createSite(this.outputs, label, bits);
    this.on('fire', id => {
      const neuron = this.nodes[id];
      if (outputNodes.indexOf(neuron)) {
        const last = observable.lastValue;
        // Calculate average potential across all nodes
        const potential = outputNodes
          .reduce((pot, n) => pot + (n.isfiring ? n.potential/bits : 0), 0);
        observable.emit('data', potential);
        if (last !== potential) {
          const diff = (last - potential) || undefined;
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
     * @param {int} id 
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
     * @param {float} at location (between 0-1) where the network should be appended
     * @param {float} surfaceArea % of nodes overlapping
     * @return {NeuralNetwork} resulting neural network
     */
  concat(network, at, surfaceArea) {
    const clone = this.clone(); // default settings will be as per first network
    const size = clone.size;
    if (network && network.nodes) {
      network = network instanceof NeuralNetwork ? network : new NeuralNetwork(network);
      surfaceArea = surfaceArea || 0.05; // 5% nodes overlapping (bear in mind 4 synapses per node is 20% node overlap)
      at = at || 0.975; // where should we intersect? Beginning = 0, End = 1;
      const fromPos = Math.floor(at*size - size*(surfaceArea/2));
      const toPos = Math.ceil(at*size + size*(surfaceArea/2));
      clone.nodes.forEach((neuron, i) => {
        if (i >= fromPos && i <= toPos) {
          const n = Neuron.generate(i, size, () => Random_1.integer(size, size * (1+surfaceArea)), clone.opts);
          neuron.synapses.push(...n.synapses);
        }
      });
      const nodes = network.nodes.map(n => n.clone({ opts: clone.opts }, size));
      clone.nodes.push(...nodes);
      clone.synapses.forEach(s => s.target = clone.nodes[s.t]);
      Object.keys(network.inputs).forEach(k => clone.inputs[k] = network.inputs[k].map(n => clone.nodes[n.id + size]));
      Object.keys(network.outputs).forEach(k => clone.outputs[k] = network.outputs[k].map(n => clone.nodes[n.id + size]));
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
    const synapses = this.synapses;
    return synapses.filter(s => s.w > this.opts.signalFireThreshold).length / synapses.length;
  }

  /** Average weight of the network */
  get weight() {
    const synapses = this.synapses;
    return synapses.reduce((acc, s) => acc + s.w, 0) / synapses.length;
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

  /**
   * Generates a neuron
   * @param {int} index position of neuron in network
   * @param {int} size network size (total neurons)
   * @param {Function} shaper function used for shaping onward connections
   * @param {Object} opts network options
   */
  static generate(index, size, shaper, opts) {
    // Number of synapses are random based on average
    const synapses = new Array(Random_1.integer(1, opts.connectionsPerNeuron * 2 - 1))
      .fill()
      .map((s, i) => {
        // target is defined by shaper function
        const t = shaper(index, size, i),
          // initial weight is between -0.5 and 0.75, gaussian distribution around 0.125
          w = -0.5 + Random_1.gaussian() * 1.25;

        if (t && t < size) {
          // index, weight, long term weight
          return { t, w, ltw: w }; 
        }
        // Cannot find suitable target
        return null;
      })
      .filter(s => !!s);
    return new Neuron(index, synapses, opts);
  }

  /**
   * Clones a neuron, useful when concatenating networks
   * @param {Object} overrides properties to override in resulting neuron
   * @param {int} offset number used to offset neuron id by 
   */
  clone(overrides, offset) {
    overrides = overrides || {};
    offset = offset || 0;
    const synapses = this.synapses.map(s => Object.assign({}, s, { t: offset + s.t }));
    const neuron = new Neuron(offset + this.id, synapses, this.opts);
    return Object.assign(neuron, overrides);
  }

  /** Should be optimised as this gets executed very frequently. */ 
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
          const s = this.synapses[i];
          if (s && s.target && s.target.fire((s.w + potential) / 2).isfiring) {
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
