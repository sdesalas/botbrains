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
  static ball (count, index) {
    var target = Random_1.integer(0, count - 1);
    if (target !== index) {
      return target;
    }
    return undefined;
  }

  // Drum shape
  static drum (count, index) {
    const width = count / 3;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < count) {
      return target; 
    }
    return undefined;
  }

  // Tube shape
  static tube (count, index) {
    const width = count / 5;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < count) {
      return target; 
    }
    return undefined;
  }

  // Classic shape (number of layers depends on connections per neuron)
  static classic (count, index, connectionCount, connectionIndex) {
    const layers = Math.ceil(count / connectionCount);
    const offset = Math.floor(count / layers);
    const layer = Math.floor((index / count) * layers) + 1;
    const target = offset * layer + connectionIndex;
    if (target < count) {
      return target;
    }
    return undefined;
  }

  // Snake shape
  static snake (count, index) {
    const width = count / 10;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < count) {
      return target;
    }
    return undefined;
  }

  // Forward-biased sausage shape
  static sausage (count, index) {
    const width = count / 4;
    const forwardBias = Math.ceil(width * Math.random());
    let target = index + forwardBias;
    if (target < count) {
      return target;
    }
    target = Random_1.integer(0, count - 1);
    if (target !== index) {
      return target;
    }
    return undefined;
  }

  // Ring shape
  static ring (count, index) {
    const width = count / 12;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < count) {
      return target;
    }
    return target - count; // link to beginning
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
    return n > to ? to : (n < from ? from : n);
  }

}

var Utils_1 = Utils;

const DEFAULTS = {
  shape: 'drum',              // shaper function name in NetworkShaper.js
  connectionsPerNeuron: 16,   // average synapses per neuron
  signalSpeed: 20,            // neurons per second
  signalFireThreshold: 0.3,   // potential needed to trigger chain reaction
  learningPeriod: 20 * 1000,  // milliseconds in the past on which learning applies
  learningRate: 0.05,         // max % increase/decrease to synapse strength when learning
  retentionRate: 0.95         // % retention of long term memory during learning
};


class NeuralNetwork extends events {
    
  /**
     * Initialize neural network
     * Either using size 
     * ```
     * new NeuralNetwork(20);
     * ```
     * or using serialized JSON
     * ```
     * new NeuralNetwork({ 
     *  nodes: 200,
     *  synapses: [
     *     {s: 0, t: 1, w: 0.41},
     *     {s: 1, t: 2, w: 0.02},
     *     {s: 1, t: 3, w: 0.13},
     *     {s: 2, t: 5, w: 0.24},
     *     {s: 3, t: 1, w: 0.02},
     *     {s: 4, t: 6, w: 0.92},
     *     {s: 4, t: 2, w: 0.41},
     *     {s: 5, t: 4, w: 0.63}
     *   ]
     * });
     * ```
     * @param {int|Object} size 
     * @param {Object} opts 
     */
  constructor(size, opts) {
    super();
    this.nodes = [];
    this.synapses = [];
    this.inputs = {};
    this.outputs = {};
    this.setMaxListeners(20);
    if (typeof size === 'number') {
      // Initialize with size
      this.init(size, opts);
    }
    else if (size && size.nodes && size.synapses) {
      // Initialize with exported network
      this.import(size);
    }
  }

  /** Initialise using size */ 
  init(size, opts) {
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
    // Initialize nodes and synapses
    if (size) {
      this.nodes = new Array(size).fill()
        .map((n, i) => Neuron.generate(size, i, this.opts, this.shaper));
    }
    this.nodes.forEach(neuron => {
      neuron.on('fire', (i, p, b) => this.emit('fire', i, p, b));
      neuron.synapses.forEach(s => {
        s.target = this.nodes[s.target];
        s.source = this.nodes[s.source];
      });
      this.synapses.push(...neuron.synapses);
    });
    return this;
  }

  /**
   * Imports a JSON-serialized network object
   * @param {Object} network 
   */
  import(network) {
    this.synapses = [];
    this.nodes = new Array(network.nodes).fill().map((n, i) => new Neuron(i, network.opts));
    network.synapses.forEach(s => this.nodes[s.s].synapses.push({ source: s.s, target: s.t, weight: s.w, ltw: s.w }));
    Object.keys(network.inputs || {}).forEach(k => {
      if (k in this.inputs) {
        // If array exists then maintain it (due to input fn)
        this.inputs[k].splice(0, this.inputs[k].length, ...network.inputs[k]);
      } else {
        this.inputs[k] = network.inputs[k].slice();
      }
    });
    Object.keys(network.outputs || {}).forEach(k => {
      if (k in this.outputs) { 
        // If array exists then maintain it (due to output observables)
        this.outputs[k].splice(0, this.outputs[k].length, ...network.outputs[k]);
      } else {
        this.outputs[k] = network.outputs[k].slice();
      }
    });
    return this.init(undefined, network.opts);
  }

  /**
   * Exports network as serialized JSON, useful for cloning and saving to disk
   */
  export() {
    const inputs = {}, outputs = {};
    for(const k in this.inputs) { inputs[k] = this.inputs[k].slice(); }
    for(const k in this.outputs) { outputs[k] = this.outputs[k].slice(); }
    return {
      nodes: this.nodes.length,
      synapses: this.synapses.map(s => ({ s: s.source.id, t: s.target.id, w: Number(s.weight.toFixed(5)) })),
      opts: Object.assign({}, this.opts),
      inputs,
      outputs
    };
  }

  /**
   * Clones network, useful to mutating network to determine fittest alternative
   */
  clone() {
    return new NeuralNetwork(this.export());
  }

  /**
     * Reinforces/weakens synapses that fired recently
     * ```
     * network.learn();    // Do more of something in recent past
     * network.learn(-1):  // Do less of something in recent past
     * network.learn(0.1); // Same with 10% strength
     * ```
     * @param {float} [rate=1] rate of learning (between 0 and 1)
     */
  learn(rate) {
    const opts = this.opts;
    const synapses = this.synapses;
    const now = new Date().getTime();
    const learningPeriod = opts.learningPeriod;
    const cutoff = now - learningPeriod;
    rate = Utils_1.constrain(isNaN(rate) ? 1 : rate, -1, 1);

    // Decay synapses to allow new learning
    const decay = this.decay(rate);
    // Strengthen synapses that fired recently
    const potentiation = this.potentiate(rate, cutoff);
    // Spread difference to maintain network weight
    const diff = potentiation - decay;
    const count = synapses.length;
    if (rate > 0) {
      // If the feedback was positive just spread difference
      // evenly over all synapses
      let diffPerSynapse = diff/count;
      for (let i = 0; i < count; i++) {
        const weight = synapses[i].weight - diffPerSynapse;
        const constrained = Utils_1.constrain(weight, -0.5, 1);
        synapses[i].weight = constrained;
        if (constrained !== weight) {
          // Make sure overall network weight doesnt shift because of constrained weigth
          diffPerSynapse -= (weight-constrained) / (count-i);
        }
      }
    } else {
      // Otherwise when something bad has happens, we assume
      // the lack of synapses firing is also part of the problem,
      // so we can reactivate old/unused synapses for re-use.
      const reuse = [];
      for (let i = 0; i < count; i++) {
        const s = synapses[i];
        if ((!s.fired || s.fired < cutoff) // not used or less than the cutoff
            && Math.random() < 0.5) // random 50%
        {
          reuse.push(s);
        }
      }
      const gain = -1 * diff/reuse.length;
      for (let i = 0; i < reuse.length; i++) {
        reuse[i].weight = Utils_1.constrain(reuse[i].weight + gain, -0.5, 1);
      }
    }
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
     * @return {float} loss of weight by the network 
     */
  decay(rate) {
    const opts = this.opts;
    const tendency = (this.strength + opts.learningRate) / 2;
    const stableLevel = opts.signalFireThreshold / opts.connectionsPerNeuron;
    let total = 0;
    for (let i = 0, n = this.synapses.length; i < n; i++) {
      const s = this.synapses[i];
      // short term weight decays fast towards the average of long term and stable levels
      const target = (s.ltw + stableLevel) / 2;
      const decay = (s.weight - target) * Math.abs(rate) * tendency;
      s.weight = s.weight - decay;
      // long term memories change depending on retention rate
      s.ltw = s.ltw * opts.retentionRate + s.weight * (1-opts.retentionRate);
      total += decay;
    }
    return total;
  }

  /**
   * Strengthen / weaken synapses that fired recently
   * in proportion to how recently they fired
   * @param {float} rate rate of learning (betweent 0 and 1)
   * @param {int} cutoff the cutoff time for strengthening synapses
   */
  potentiate(rate, cutoff) {
    const opts = this.opts;
    const learningPeriod = opts.learningPeriod;
    const learningRate = opts.learningRate;
    let total = 0;
    for (let i = 0, n = this.synapses.length; i < n; i++) {
      const s = this.synapses[i];
      const recency = s.fired - cutoff;
      if (recency > 0) {
        // Synapse potentiation applies to both excitatory and inhibitory connections
        let potentiation = (s.weight > 0 ? 1 : -1) * (recency / learningPeriod) * (rate * learningRate);
        // Make sure weight is between -0.5 and 1
        // Allow NEGATIVE weighing as real neurons do,
        // inhibiting onward connections in some cases.
        potentiation = Utils_1.constrain(potentiation, -0.5, 1);
        s.weight += potentiation;
        total += potentiation;
      }
    }
    return total;
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
     * ```
     * @param {Object} location the location (either network.inputs or network.outputs)
     * @param {String} label a label describing what the input/output is for
     * @param {int|int[]} [bits=1] neurons involved in input/output site
     * @return {int[]} the input/output site (an array of int)
     */
  createSite(location, label, bits) {
    const isOutput = location === this.outputs;
    const site = location[label || Random_1.alpha(4).toUpperCase()] = [];
    let nodes = bits && bits.slice && bits.slice();
    if (!nodes) {
      // Find starting/ending point and add nodes to site
      const pos = isOutput ? 
        Object.keys(location).reduce((a, k) => Math.min.apply(null, location[k].map(n => n.id).concat(a)), this.size) - 2 :
        Object.keys(location).reduce((a, k) => Math.max.apply(null, location[k].map(n => n.id).concat(a)), 0) + 2;
      nodes = new Array(bits || 1)
        .fill()
        .map((b, i) => isOutput ? pos - i : pos + i);
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
     * @param {int|int[]} [bits=1] neurons involved in input site 
     * @return {Function} a function used to input data into the network
     */
  input(label, bits) {
    const input = this.inputs[label] || this.createSite(this.inputs, label, bits);
    /**
     * Inputs some data into the neural network
     * ```
     * left_mic.on('change', val => network.input('Left Mic')(val / 1024));
     * ```
     * @param {float} data a number between 0 and 1
     */
    input.fn = input.fn || (data => {
      const ids = this.inputs[label];
      if (typeof data === 'number' && ids.length) {
        // Distribute input signal across nodes
        // multiplying signal so even small inputs can trigger a signal
        for (let i = 0, n = ids.length; i < n; i++) {
          this.nodes[ids[i]].fire(Utils_1.constrain(data*(i+1), 0, 1), label);
        }
      }
    });
    return input.fn;
  }

  /**
     * Creates an output site and returns event emitter
     * ```
     * const output = network.output('Motor (R)'); 
     * output.on('data', data => console.log(data)); -> fires when there is data
     * output.on('change', data => console.log(data)); -> fires when there is a change
     * ```
     * @param {String} label a label describing what the output is for
     * @param {int|int[]} bits neurons involved in the output
     * @return {EventEmitter} an event emitter used to capture output from the network
     */
  output(label, bits) {
    const output = this.outputs[label] || this.createSite(this.outputs, label, bits);
    if (output.observable) {
      return output.observable;
    }
    const observable = output.observable = new events();
    this.on('fire', id => {
      const index = output.indexOf(id);
      if (index >= 0) {
        const nodes = output.map(id => this.nodes[id]);
        // Calculate average potential across all nodes
        let potential = 0;
        for (let i = 0, count = nodes.length; i < count; i++) {
          potential += nodes[i].potential/count;
        }
        potential = Utils_1.constrain(potential, 0, 1);
        if (potential) {
          observable.emit('data', potential);
          const last = observable.lastValue;
          if (last !== potential) {
            const diff = (last - potential) || undefined;
            observable.emit('change', potential, last, diff);
          }
          observable.lastValue = potential;
        }
      }
    });
    return observable;
  }

  /**
     * Fire an individual neuron, used for testing and visualization
     * ```
     * network.fire(24);
     * network.fire(24, 0.56); // use potential
     * ```
     * @param {int} id the neuron to fire
     * @param {float} [potential=1] the signal strength (potential) to use
     * @return {NeuralNetwork}
     */
  fire(id, potential) {
    if (id && this.nodes[id]) {
      return this.nodes[id].fire(potential);
    }
    return this;
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
     * let network3 = network1.join(network2)
     * ```
     * @param {NeuralNetwork} network extra network to append
     * @param {float} at location (between 0-1) where the network should be appended
     * @param {float} surfaceArea % of nodes overlapping
     * @return {NeuralNetwork} resulting neural network
     */
  join(network, at, surfaceArea) {
    let offset = this.size;
    if (network && network.nodes && network.synapses) {
      if (this !== network) {
        // Make a copy and extract all nodes/synapses/inputs/outputs
        network = network instanceof NeuralNetwork ? network.clone() : new NeuralNetwork(network);
        network.nodes.forEach(n => {
          n.id += this.size; // shift ids past the end
          n.on('fire', (i, p, b) => this.emit('fire', i, p, b));
        });
        this.nodes.push(...network.nodes.splice(0));
        this.synapses.push(...network.synapses.splice(0));
        Object.keys(network.inputs).forEach(k => {
          this.inputs[k] = network.inputs[k].map(id => id+offset);
          this.inputs[k].fn = network.inputs[k].fn;
        });
        Object.keys(network.outputs).forEach(k => {
          this.outputs[k] = network.outputs[k].map(id => id+offset);
          this.outputs[k].observable = network.outputs[k].observable;
        });
      }
      // Add attachment points
      surfaceArea = surfaceArea || 0.05; // 5% nodes overlapping (bear in mind 4 synapses per node is 20% node overlap)
      at = at || 0.975; // where should we intersect? Beginning = 0, End = 1;
      const range = offset*surfaceArea;
      const begining = Math.floor(at*offset - range/2);
      const end = Math.ceil(at*offset + range/2);
      if (this === network) {
        offset = 0; // Allow attaching to same network
      }
      this.nodes.forEach((neuron, i) => {
        if (i >= begining && i <= end) {
          // Generate additional connections
          const synapses = Neuron.generate(this.nodes.length, i, this.opts, () => Random_1.integer(offset, offset+range)).synapses;
          synapses.forEach(s => {
            s.source = this.nodes[s.source];
            s.target = this.nodes[s.target];
          });
          neuron.synapses.push(...synapses);
          this.synapses.push(...synapses);
        }
      });
    }
    return this;
  }

  /** Number of neurons in network */
  get size() {
    return this.nodes.length;
  }

  /** Percentage of active synapses in network */
  get strength() {
    const synapses = this.synapses;
    const threshold = this.opts.signalFireThreshold;
    let active = 0;
    for (let i = 0, n = synapses.length; i < n; i++) {
      if (synapses[i].weight > threshold) {
        active++;
      }
    }
    return active / synapses.length;
  }

  /** Average weight of the network */
  get weight() {
    const synapses = this.synapses;
    let weight = 0;
    for (let i = 0, n = synapses.length; i < n; i++) {
      weight += synapses[i].weight;
    }
    return weight / synapses.length;
  }

  /** Network signature - used to detect changes */
  get hash() {
    const synapses = this.synapses;
    let hash = 0;
    for (let i = 0, n = synapses.length; i < n; i++) {
      hash = hash + synapses[i].weight * (i << 10);
    }
    return Math.floor(hash); 
  }
}

class Neuron extends events {

  constructor(id, opts, synapses = []) {
    super();
    this.synapses = synapses;
    this.id = id > -1 ? id : Random_1.alpha(6);
    this.potential = 0;
    this.opts = opts || DEFAULTS;
  }

  /**
   * Generates a neuron
   * @param {int} size the size of the network 
   * @param {int} index position of neuron in network
   * @param {Object} opts network options
   * @param {Function} shaperFn the shaper function
   */
  static generate(size, index, opts, shaperFn) {
    const count = opts.connectionsPerNeuron;
    const neuron = new Neuron(index, opts);
    for (let s = 0; s < count; s++) {
      // target is defined by shaper function
      const target = shaperFn(size, index, count, s),
        // the more connections per neuron, the lower the weight per connection
        weight = opts.signalFireThreshold / count;
      
      if (target >= 0) {
        neuron.synapses.push({ source: index, target, weight, ltw: weight }); 
      }
    }
    return neuron;
  }

  /** Should be optimised as this gets executed very frequently. */ 
  fire(potential, by) {
    if (this.isfiring) return false;
    const opts = this.opts;
    const signalFireDelay = 1000 / opts.signalSpeed;
    const signalRecovery = signalFireDelay * 10;
    // Action potential is accumulated so that
    // certain patterns can trigger even weak synapses.
    // https://en.wikipedia.org/wiki/Excitatory_postsynaptic_potential
    potential = isNaN(potential) ? 1 : potential;
    this.potential += potential;
    // Should we fire onward connections?
    if (this.potential > opts.signalFireThreshold) {
      this.isfiring = true;
      this.timeout = setTimeout(() => {
        this.emit('fire', this.id, this.potential, by);
        // Attempt firing onward connections
        for (let i = 0; i < this.synapses.length; i++) {
          const s = this.synapses[i];
          // Firing strength depends on both connection weight AND incoming potential,
          // it can also be inhibitory (if connection polarity is negative)
          // https://en.wikipedia.org/wiki/Inhibitory_postsynaptic_potential
          const firePotential = (s.weight < 0 ? -1 : 1) * (Math.abs(s.weight) + this.potential) / 2;
          if (s && s.target && s.target.fire(firePotential, this.id).isfiring) {
            // Time synapse last fired is important
            // to learn from recent past
            s.fired = new Date().getTime();
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
    } else {
      // Bring neuron potential back down after a small delay, 
      // this allows potentials to become cummulative
      setTimeout(() => this.potential -= potential, signalFireDelay * 1.5);
    }
    return this;
  }

}

// Nested class
NeuralNetwork.Neuron = Neuron;

var NeuralNetwork_1 = NeuralNetwork;

return NeuralNetwork_1;

})));
