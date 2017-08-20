'use strict';

const EventEmitter = require('events');
const NetworkShaper = require('./NetworkShaper');
const Random = require('./Random');
const Utils = require('./Utils');

const DEFAULTS = {
    shape: 'tube',              // shaper function name in NetworkShaper.js
    connectionsPerNeuron: 4,    // average synapses per neuron
    signalSpeed: 10,            // neurons per second
    signalFireThreshold: 0.3,   // potential needed to trigger chain reaction
    learningPeriod: 10 * 1000,  // milliseconds in the past on which learning applies
    learningRate: 0.01,         // max increase/decrease to connection strength when learning
};

class NeuralNetwork extends EventEmitter {
    
    /**
     * Initialize neural network
     * Either using size or network definition
     * ```
     * new NeuralNetwork(20);
     * new NeuralNetwork({ nodes: [
     *   {id: 1, s: [{t: 1, w: 0.41}] },
     *   {id: 2, s: [{t: 2, w: 0.020}, {t: 3, w: 0.135}] },
     *   {id: 3, s: [{t: 5, w: 0.241}] },
     *   {id: 4, s: [{t: 1, w: 0.02}] },
     *   {id: 5, s: [{t: 6, w: 0.92}, {t: 2, w: 0.41}] },
     *   {id: 6, s: [{t: 2, w: 0.41}] }
     * ]});
     * ```
     * @param {*} size 
     * @param {*} opts 
     */
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
            inputSites: this.inputSites.map(i => i.map(n => n.id)),
            outputSites: this.outputSites.map(i => i.map(n => n.id))
        };
    }

    /**
     * Reinforces/weakens synapses that fired recently
     * ```
     * network.learn();    // Do more of something in recent past
     * network.learn(0.1); // Same with 10% strength
     * ```
     * @param {float} [rate=1] rate of learning (betweent 0 and 1)
     */
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
                    s.w = Utils.constrain(s.w, -0.5, 1);
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
                s.w = Utils.constrain(s.w, -0.5, 1);
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
     * const left_mic = network.inputSite();             // -> 1 bit input site
     * const left_mic = network.inputSite(4);            // -> 4 bit input site
     * const left_mic = network.inputSite([6,7,8,9])     // -> 4 specific neurons in input site
     * const left_mic = network.inputSite([n1,n2,n3,n4]) // -> 4 specific neurons - by ref 
     * ```
     * @param {int|int[]|Neuron[]} [bits=1] neurons involved in input site 
     * @return {int} id of input site
     */
    inputSite(bits) {
        return this.site(bits || 1, false);
    }

    /**
     * Creates an output site to send information OUT OF the network
     * ```
     * const left_wheel = network.outputSite();             // -> 1 bit output site
     * const left_wheel = network.outputSite(4);            // -> 4 bit output site
     * const left_wheel = network.outputSite([6,7,8,9])     // -> 4 specific neurons in output site
     * const left_wheel = network.outputSite([n1,n2,n3,n4]) // -> 4 specific neurons - by ref
     * ```
     * @param {int|int[]|Neuron[]} [bits=1] neurons involved in output site
     * @return {int} id of the input site
     */
    outputSite(bits) {
        return this.site(bits || 1, true);
    }

    site(bits, isOutput) {
        const site = isOutput ? this.outputSites : this.inputSites;
        const index = site.length;
        let nodes = bits && bits.map && bits.map(n => n instanceof Neuron ? n : this.nodes[n]);
        if (!nodes) {
            // Find starting/ending point and add nodes to site
            const pos = isOutput ? 
                site.reduce((a, s) => Math.min.apply(null, s.map(n => n.id).concat(a)), this.size) - 2 :
                site.reduce((a, s) => Math.max.apply(null, s.map(n => n.id).concat(a)), 0) + 2;
            nodes = new Array(bits)
                .fill()
                .map((b, i) => this.nodes[isOutput ? pos - i : pos + i]);
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
     * @param {float} data input signal potential (between 0 and 1)  
     * @param {int} index id of input site
     */
    input(data, index) {
        let inputNodes = this.inputSites[index || 0] || this.inputSites[this.inputSite()];
        if (typeof data === 'number' && inputNodes && inputNodes.length) {
            // Distribute input signal across nodes
            const potential = Utils.constrain(data, 0, 1);
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
     * @param {int|int[]|Neuron[]} bits neurons involved in the output
     * @param {int} index 
     */
    output(bits) {
        const observable = new EventEmitter();
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
                    let n = Neuron.generate(i, size, () => Random.integer(size, size * (1+surfaceArea)), clone.opts);
                    neuron.synapses.push(...n.synapses);
                }
            });
            let nodes = network.nodes.map(n => n.clone({ opts: clone.opts }, size));
            clone.nodes.push(...nodes);
            clone.synapses.forEach(s => s.t = clone.nodes[s.i]);
            clone.inputSites.push(...network.inputSites.map(arr => arr.map(n => clone.nodes[n.id + size])));
            clone.outputSites.push(...network.outputSites.map(arr => arr.map(n => clone.nodes[n.id + size])));
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

class Neuron extends EventEmitter {

    constructor(index, synapses, opts) {
        super();
        this.synapses = synapses || [];
        this.id = index > -1 ? index : Random.alpha(6);
        this.potential = 0;
        this.opts = opts || DEFAULTS;
    }

    // Generates a neuron
    static generate(index, size, shaper, opts) {
        // Number of synapses are random based on average
        let synapses = new Array(Random.integer(1, opts.connectionsPerNeuron * 2 - 1))
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

module.exports = NeuralNetwork;
