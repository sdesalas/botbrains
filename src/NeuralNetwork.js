"use strict";

const EventEmitter = require('events');
const NetworkShaper = require('./NetworkShaper');
const Random = require('./Random');
const Utils = require('./Utils');

const NETWORK_DEFAULT_SIZE = 256;
const NETWORK_DEFAULT_SHAPE = 'sausage';
const SYNAPSE_AVG_PER_NEURON = 4;
const SIGNAL_MAX_FIRE_DELAY = 200;
const SIGNAL_RECOVERY_DELAY = 1250;
const SIGNAL_FIRE_THRESHOLD = 0.3;
const LEARNING_RATE = 0.3;
const LEARNING_PERIOD = 60 * 1000;

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
    constructor(size, shape) {
        super();
        this.shape = shape || NETWORK_DEFAULT_SHAPE;
        this.nodes = [];
        this.channels = [];
        if (typeof size === 'number') {
            // Initialize with size
            this.nodes = new Array(size)
                .fill()
                .map((n, i) => Neuron.random(i, size, this.shape));
        }
        else if (size && size.nodes && size.nodes instanceof Array) {
            // Initialize with exported network
            this.nodes = size.nodes.map((n, i) => {
                var neuron = new Neuron(n.s, n.id);
                neuron.synapses.forEach(s => s.i = s.t);
                return neuron;
            });
        }
        // Extra initialization per neuron
        this.nodes.forEach(neuron => {
            neuron.on('fire', id => this.emit('fire', id));
            // Add synapse ref pointers to corresponding target neurons
            neuron.synapses.forEach(synapse => {
                synapse.t = this.nodes[synapse.i];
            })
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
            channels: this.channels.map(channel => channel.slice())
        }
    }

    // Reinforces synapses that fire recently
    // network.learn()
    learn(rate) {
        var start = new Date().getTime() - LEARNING_PERIOD;
        this.synapses
            .forEach(s => {
                var recency = s.l - start;
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

    // Each channel defaults to 32 bits (neurons) to process
    // network.channel() -> next available at 32 bits
    // network.channel(16) -> next available at 16 bits
    // network.channel(16, 2) -> slot 2 at 16 bits
    // network.channel([2,3,4,5,6,7], 2) -> slot 2 with array of predefined nodes
    channel(bits, index) {
        var index = index || this.channels.length,
            bits = typeof bits === 'number' ? bits : 32,
            nodes = bits instanceof Array ? bits : undefined;
        if (!nodes) {
            // Find starting point and add nodes to channel
            var start = this.channels.reduce((a, c) => a + c.length, 0);
            nodes = new Array(bits).fill().map((n, i) => start + i);
        }
        this.channels[index] = nodes;
        return nodes;
    }

    // Input some data into the neural network
    // network.input('hello')
    input(data, channelIndex) {
        var bytes,
            nodes = this.channels[channelIndex || 0] || this.channel();
        if (nodes && nodes.length) {
            if (typeof data === 'number' && data.toString(2).length <= 32) {
                bytes = data.toString(2).split('');
            }
            else {
                if (typeof data !== 'string') {
                    data = String(data);
                }
                bytes = Utils.hash(data).toString(2).split('');
            }
            while (bytes.length < 32) {
                bytes.unshift('0');
            }
            // Apply bits in data to each neuron listed under inputs
            // 1 = fire neuron, 0 = skip
            bytes.forEach((byte, i) => {
                var node = this.nodes[nodes[i]];
                if (byte === '1' && node) {
                    node.fire();
                }
            });
            return bytes.join('');
        }
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
        var synapses = this.synapses;
        return synapses.map(s => s.w).reduce((a,b) => a+b, 0) / synapses.length;
    }

    get synapses() {
        return this.nodes.reduce((acc, node) => acc.concat(node.synapses), []);
    }
}

class Neuron extends EventEmitter {

    constructor(synapses, index) {
        super();
        this.synapses = synapses || [];
        this.id = index > -1 ? index : Random.alpha(6);
        this.potential = 0;
    }

    // Generates a random neuron
    static random(position, networkSize, shape) {
        // Number of synapses are random based on average
        var synapses = new Array(Random.integer(1, SYNAPSE_AVG_PER_NEURON * 2 - 1))
            .fill()
            .map(() => {
                var shaper = NetworkShaper[shape],
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


module.exports = NeuralNetwork;
