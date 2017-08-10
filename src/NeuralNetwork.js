"use strict";

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
    learningRate: 0.1,          // max increase/decrease to connection strength when learning
    messageSize: 10             // default input/output bits (10 bits = 0-1023)
}

class NeuralNetwork extends EventEmitter {

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
        this.channels = []; // input sites
        this.drains = []; // output sites
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
            this.channels = network.channels.slice();
            this.drains = network.drains.slice();
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
            channels: this.channels.map(i => i.slice()),
            drains: this.drains.map(i => i.slice())
        }
    }

    // Reinforces/weakens synapses that fired recently
    // network.learn()
    learn(rate) {
        const opts = this.opts;
        const now = new Date().getTime();
        const learningPeriod = this.opts.learningPeriod;
        const cutoff = now - learningPeriod;
        // Start by decaying synapses to allow new learning
        this.decay(rate);
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

    // Negative reinforcement (to avoid recent neural pathways)
    // network.unlearn()
    unlearn(rate) {
        return this.learn(-1 * (rate || 1))
    }

    // Forgetting is as important as remembering, otherwise we overload the network.
    // This algorithm is adaptive, in other words, connections
    // will decay significantly faster if there are too many of them.
    decay(rate) {
        const strength = Math.pow(this.strength, 3);
        const synapses = this.synapses;
        const stableLevel = this.opts.signalFireThreshold / 2;
        // Use fast recursion (instead of Array.prototype.forEach)
        let i = synapses.length;
        while(i--) {
            let s = synapses[i], decay = (s.w - stableLevel) * strength * rate;
            s.w -= decay;
        }
        return this;
    }

    // Creates channel, defaulted to `messageSize` neurons (bits)
    // network.channel() -> inward, next available
    // network.channel(2) -> inward at slot 2 (ie, 3rd slot -> 0-indexed)
    // network.channel(2, 16) -> inward, slot 2 at set size
    // network.channel(2, 16, true) -> outward, slot 2 at set size
    // network.channel(2, [2,3,4,5,6,7]) -> inward slot 2 with array of predefined nodes
    channel(index, bits, outward) {
        let channels = outward ? this.drains : this.channels;
        index = index || channels.length;
        bits = typeof bits === 'number' ? bits : this.opts.messageSize;
        let nodes = bits instanceof Array ? bits : undefined;
        if (!nodes) {
            // Find starting/ending point and add nodes to channel
            let startPos = channels.reduce((a, c) => a + c.length, 0);
            let endPos = this.size - 1 - startPos;
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
        const max = Math.pow(2, this.opts.messageSize) - 1;
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
    // let output = network.output(4); -> 4 bit listener
    // output.on('data', data => console.log(data)); -> fires when there is data
    // output.on('change', data => consoe.log(data)); -> fires when there is a change
    output(bits) {
        let observable = new EventEmitter();
        let index = this.drains.length,
            outputNodes = this.channel(index, bits, true);
        this.on('fire', id => {
            if (outputNodes.indexOf(id)) {
                let last = observable.lastValue;
                let data = parseInt(outputNodes.map(i => this.nodes[i] && this.nodes[i].isfiring ? 1 : 0).join(''), 2);
                observable.emit('data', data);
                if (last !== data) observable.emit('change', data, last, (last - data) || undefined);
                observable.lastValue = data;
            }
        });
        return observable;
    }

    // Fire a neuron, used for testing and visualization
    // network.fire(24);
    fire(id) {
        if (id && this.nodes[id]) {
            return this.nodes[id].fire();
        }
    }

    // Stops the network firing, used for testing and visualization
    // network.stop();
    stop() {
        this.nodes.forEach(n => clearTimeout(n.timeout));
    }

    // Allows 2 networks to be chained together creating a third network.
    // let network3 = network1.concat(network2)
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
            clone.channels.push(...network.channels.map(c => c.map(n => n + size)));
            clone.drains.push(...network.drains.map(d => d.map(n => n + size)));
            nodes.forEach(n => n.on('fire', (i, p) => clone.emit('fire', i, p)));
        }
        return clone;
    }

    get size() {
        return this.nodes.length;
    }

    // Percentage of active synapses
    get strength() {
        let synapses = this.synapses;
        return synapses.filter(s => s.w > this.opts.signalFireThreshold).length / synapses.length;
    }

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
                    if (s && s.t && s.t.fire(s.w).isfiring) {
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
