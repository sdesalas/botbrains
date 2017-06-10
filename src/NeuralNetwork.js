"use strict";

const EventEmitter = require('events');
const NetworkShaper = require('./NetworkShaper');
const Random = require('./Random');
const Utils = require('./Utils');

const DEFAULTS = {

    SHAPE: 'tube',
    SYNAPSE_AVG: 4,

    SIGNAL_FIRE_DELAY: 100,
    SIGNAL_RECOVERY_DELAY: 1000,
    SIGNAL_FIRE_THRESHOLD: 0.3,

    LEARNING_RATE: 0.15,
    LEARNING_PERIOD: 60 * 1000,

    MESSAGE_SIZE: 10 // 10 bit messages (int -> 0-1024)
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
                .map((n, i) => Neuron.random(i, size, this.shaper, this.opts));
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
            // new NeuralNetwork(100, { LEARNING_RATE: 0.5, SHAPE: 'sausage' });
            case 'object':
                this.shaper = NetworkShaper[opts.SHAPE || DEFAULTS.SHAPE];
                this.opts = Object.assign({}, DEFAULTS, opts);
                break;
            // new NeuralNetwork(100);
            // new NeuralNetwork(100, 'sausage');
            case 'undefined':
            case 'string':
                this.shaper = NetworkShaper[opts || DEFAULTS.SHAPE];
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

    get learningPeriod() {
        const now = new Date().getTime();
        let lp = now - this.lastTrained;
        if (!lp || lp > this.opts.LEARNING_PERIOD) {
            lp = this.opts.LEARNING_PERIOD;
        }
        return lp;
    }

    // Reinforces synapses that fired recently
    // network.learn()
    learn(rate) {
        const opts = this.opts;
        const now = new Date().getTime();
        const learningPeriod = this.learningPeriod;
        const cutoff = now - learningPeriod;
        this.synapses.forEach(s => {
            // Strengthen / weaken synapses that fired recently
            // in proportion to how recently they fired
            let recency = s.l - cutoff;
            // If synapse hasnt fired then use inverse.
            if (recency > 0) {
                s.w += (recency / learningPeriod) * (rate || opts.LEARNING_RATE);
                // Make sure weight is always between 0 and 1
                s.w = Utils.constrain(s.w, 0, 1);
            }
        });
        this.lastTrained = new Date().getTime();
        return this;
    }

    // Weakens synapses that fired recently
    // and recycles old/unused synapses for re-use
    // network.unlearn()
    unlearn(rate) {
        const opts = this.opts;
        const now = new Date().getTime();
        const cutoff = now - this.learningPeriod * 2;
        // When something bad has happened, the lack of synapses
        // firing is also part of the problem, so we can
        // reactivate old/unused synapses for re-use.
        this.synapses
            .filter(s => !s.l || s.l < cutoff) // not used or less than the cutoff
            .filter(s => Math.random() > 0.10) // random 10% only
            .forEach(s => {
                // Strengthen by 10% of learning rate
                s.w += (rate || opts.LEARNING_RATE) * 0.1;
                s.w = Utils.constrain(s.w, 0, 1);
            });
        // Also apply normal unlearning in recent past
        return this.learn(-1 * (rate || opts.LEARNING_RATE));
    }

    // Creates channel, defaulted to MESSAGE_SIZE neurons (bits)
    // network.channel() -> inward, next available
    // network.channel(2) -> inward at slot 2 (ie, 3rd slot -> 0-indexed)
    // network.channel(2, 16) -> inward, slot 2 at set size
    // network.channel(2, 16, true) -> outward, slot 2 at set size
    // network.channel(2, [2,3,4,5,6,7]) -> inward slot 2 with array of predefined nodes
    channel(index, bits, outward) {
        let channels = outward ? this.drains : this.channels;
        index = index || channels.length;
        bits = typeof bits === 'number' ? bits : this.opts.MESSAGE_SIZE;
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
        const max = Math.pow(2, this.opts.MESSAGE_SIZE) - 1;
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
                    let n = Neuron.random(i, size, () => Random.integer(size, size * (1+surfaceArea)), clone.opts);
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

    get strength() {
        let synapses = this.synapses;
        return synapses.map(s => s.w).reduce((a,b) => a+b, 0) / synapses.length;
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

    // Generates a random neuron
    static random(index, size, shaper, opts) {
        // Number of synapses are random based on average
        let synapses = new Array(Random.integer(1, opts.SYNAPSE_AVG * 2 - 1))
            .fill()
            .map(() => {
                let i = shaper(index, size),
                    w = Math.pow(Math.random(), 3);

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
        // Action potential is accumulated so that
        // certain patterns can trigger even weak synapses.
        potential = isNaN(potential) ? 1 : potential;
        this.potential += potential;
        // But duration is very short
        setTimeout(() => this.potential -= potential, opts.SIGNAL_FIRE_DELAY);
        // Should we fire onward connections?
        if (this.potential > opts.SIGNAL_FIRE_THRESHOLD) {
            this.isfiring = true;
            this.timeout = setTimeout(() => {
                this.emit('fire', this.id, potential);
                // Attempt firing onward connections
                this.synapses.forEach(s => {
                    if (s.t && s.t.fire(s.w).isfiring) {
                        // Time synapse last fired is important
                        // to learn from recent past
                        s.l = new Date().getTime();
                    }
                });
            }, opts.SIGNAL_FIRE_DELAY);
            // Post-fire recovery
            // Ideally should bear in mind refractory periods
            // http://www.physiologyweb.com/lecture_notes/neuronal_action_potential/neuronal_action_potential_refractory_periods.html
            setTimeout(() => {
                this.potential = 0;
                this.isfiring = false;
                this.emit('ready', this.id);
            }, opts.SIGNAL_RECOVERY_DELAY);
        }
        return this;
    }

}

// Nested class
NeuralNetwork.Neuron = Neuron;

module.exports = NeuralNetwork;
