'use strict';

const EventEmitter = require('events');
const NetworkShaper = require('./NetworkShaper');
const Random = require('./Random');
const Utils = require('./Utils');

const DEFAULTS = {
  shape: 'tube',              // shaper function name in NetworkShaper.js
  connectionsPerNeuron: 4,    // average synapses per neuron
  signalSpeed: 20,            // neurons per second
  signalFireThreshold: 0.3,   // potential needed to trigger chain reaction
  learningPeriod: 10 * 1000,  // milliseconds in the past on which learning applies
  learningRate: 0.05,         // max % increase/decrease to synapse strength when learning
  retentionRate: 0.05         // shift in retention of new memories to long term memory
};

class NeuralNetwork extends EventEmitter {
    
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
    this.setMaxListeners(20);
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
      this.shaper = NetworkShaper[opts.shape || DEFAULTS.shape];
      this.opts = Object.assign({}, DEFAULTS, opts);
      break;
    // new NeuralNetwork(100);
    // new NeuralNetwork(100, 'sausage');
    case 'undefined':
    case 'string':
      this.shaper = NetworkShaper[opts || DEFAULTS.shape];
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
     * @param {float} [rate=1] rate of learning (between 0 and 1)
     */
  learn(rate) {
    const opts = this.opts;
    const synapses = this.synapses;
    const now = new Date().getTime();
    const learningPeriod = opts.learningPeriod;
    const cutoff = now - learningPeriod;
    rate = Utils.constrain(isNaN(rate) ? 1 : rate, -1, 1);

    // Decay synapses to allow new learning
    const decay = this.decay(synapses, rate);
    // Strengthen synapses that fired recently
    const potentiation = this.potentiate(synapses, rate, cutoff);
    // Spread difference to maintain network weight
    const diff = potentiation - decay;
    const count = synapses.length;
    if (rate > 0) {
      // If the feedback was positive just spread difference
      // evenly over all synapses
      for (let i = 0; i < count; i++) {
        synapses[i].w = Utils.constrain(synapses[i].w - diff/count, -0.5, 1);
      }
    } else {
      // Otherwise when something bad has happens, we assume
      // the lack of synapses firing is also part of the problem,
      // so we can reactivate old/unused synapses for re-use.
      const reuse = [];
      for (let i = 0; i < count; i++) {
        const s = synapses[i];
        if ((!s.l || s.l < cutoff) // not used or less than the cutoff
            && Math.random() < 0.05) // random 5% only
        {
          reuse.push(s);
        }
      }
      for (let i = 0; i < reuse.length; i++) {
        reuse[i].w = Utils.constrain(reuse[i].w - diff/reuse.length, -0.5, 1);
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
  decay(synapses, rate) {
    const opts = this.opts;
    const tendency = this.strength / 2 + Math.abs(rate * opts.learningRate) / 2;
    const stableLevel = opts.signalFireThreshold / 2;
    let decay = 0;
    for (let i = 0; i < synapses.length; i++) {
      const s = synapses[i];
      // short term weight decays fast towards the average of long term and stable levels
      const target = (s.ltw + stableLevel) / 2;
      const loss = (s.w - target) * tendency;
      s.w = s.w - loss;
      // long term weight shifts depending on retention rate
      s.ltw = s.w * opts.retentionRate + s.ltw * (1-opts.retentionRate);
      decay += loss;
    }
    return decay;
  }

  /**
   * Strengthen / weaken synapses that fired recently
   * in proportion to how recently they fired
   * @param {float} rate rate of learning (betweent 0 and 1)
   * @param {int} cutoff the cutoff time for strengthening synapses
   */
  potentiate(synapses, rate, cutoff) {
    const opts = this.opts;
    const learningPeriod = opts.learningPeriod;
    let total = 0;
    for (let i = 0; i < synapses.length; i++) {
      const s = synapses[i];
      const recency = s.l - cutoff;
      if (recency > 0) {
        // Synapse potentiation applies to both excitatory and inhibitory connections
        let potentiation = (s.w > 0 ? 1 : -1) * (recency / learningPeriod) * (rate * opts.learningRate);
        // Make sure weight is between -0.5 and 1
        // Allow NEGATIVE weighing as real neurons do,
        // inhibiting onward connections in some cases.
        if (s.w + potentiation > 1) {
          potentiation = 1 - s.w;
        } else if (s.w + potentiation < -0.5) {
          potentiation = -0.5 - s.w;
        }
        s.w += potentiation;
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
    const site = location[label || Random.alpha(4).toUpperCase()] = [];
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
        const potential = Utils.constrain(data, 0, 1);
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
    const observable = new EventEmitter();
    const outputNodes = this.outputs[label] || this.createSite(this.outputs, label, bits);
    this.on('fire', id => {
      const neuron = this.nodes[id];
      if (outputNodes.includes(neuron)) {
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
    if (network && network.nodes) {
      if (this !== network) {
        network = network instanceof NeuralNetwork ? network : new NeuralNetwork(network);
        const additionalNodes = network.nodes.splice(0, network.size).map(n => n.shift(offset));
        additionalNodes.forEach(n => n.on('fire', (i, p) => this.emit('fire', i, p)));
        this.nodes.push(...additionalNodes);
        Object.keys(network.inputs).forEach(k => this.inputs[k] = network.inputs[k]);
        Object.keys(network.outputs).forEach(k => this.outputs[k] = network.outputs[k]);
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
          const n = Neuron.generate(i, this.size, () => Random.integer(offset, offset + range), this.opts);
          neuron.synapses.push(...n.synapses.map(s => Object.assign(s, { target: this.nodes[s.t] })));
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
    let active = 0;
    for (let i = 0; i < synapses.length; i++) {
      const s = synapses[i];
      if (s.w > this.opts.signalFireThreshold) {
        active++;
      }
    }
    return active / synapses.length;
  }

  /** Average weight of the network */
  get weight() {
    const synapses = this.synapses;
    let weight = 0;
    for (let i = 0; i < synapses.length; i++) {
      weight += synapses[i].w;
    }
    return weight / synapses.length;
  }

  /** Array of synapses */
  get synapses() {
    const result = [];
    for (let i = 0; i < this.nodes.length; i++) {
      result.push(...this.nodes[i].synapses);
    }
    return result;
  }

  /** Network signature - used to detect changes */
  get hash() {
    return Math.floor(this.synapses.reduce((acc, s, i) => acc + s.w * (i << 10), 0)); 
  }
}

class Neuron extends EventEmitter {

  constructor(index, synapses, opts) {
    super();
    this.synapses = synapses || [];
    this.id = index > -1 ? index : Random.alpha(6);
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
    const synapses = new Array(Random.integer(1, opts.connectionsPerNeuron * 2 - 1))
      .fill()
      .map((s, i) => {
        // target is defined by shaper function
        const t = shaper(index, size, i),
          // initial weight is between -0.5 and 0.75, gaussian distribution around 0.125
          w = -0.5 + Random.gaussian() * 1.25;

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
   * Shifts a neuron, useful when concatenating networks
   * @param {int} offset number used to offset neuron id by 
   */
  shift(offset) {
    offset = offset || 0;
    this.id += offset;
    this.synapses.forEach(s => s.t += offset);
    return this;
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
    // Should we fire onward connections?
    if (this.potential > opts.signalFireThreshold) {
      this.isfiring = true;
      this.timeout = setTimeout(() => {
        this.emit('fire', this.id, potential);
        // Attempt firing onward connections
        let i = this.synapses.length;
        while(i--) {
          const s = this.synapses[i];
          if (s && s.target && s.target.fire((s.w + this.potential) / 2).isfiring) {
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
    // Bring neuron potential back down
    setTimeout(() => this.potential -= potential, signalFireDelay);
    return this;
  }

}

// Nested class
NeuralNetwork.Neuron = Neuron;

module.exports = NeuralNetwork;
