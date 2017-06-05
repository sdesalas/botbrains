const assert = require('assert-fuzzy');
const EventEmitter = require('events');
const NeuralNetwork = require('../').NeuralNetwork;
const Neuron = NeuralNetwork.Neuron;

describe('NeuralNetwork', () => {

    let network;

    beforeEach(() => {
        network = new NeuralNetwork(100);
    });

    it('is defined', () => {
        assert.equal(typeof network, 'object');
        assert.equal(typeof network.clone, 'function');
        assert.equal(typeof network.export, 'function');
        assert.equal(typeof network.output, 'function');
        assert.equal(typeof network.learn, 'function');
        assert.equal(typeof network.size, 'number');
        assert.equal(typeof network.strength, 'number');
    });

    it('.size', () => {
        assert.equal(network.size, 100);
    });

    it('.strength', () => {
        assert.around(network.strength, 0.24);
    });

    it('.export()', () => {
        assert.equal(network.export() !== undefined, true);
        assert.equal(network.export().nodes instanceof Array, true);
        assert.equal(network.export().nodes.length, 100);
    });

    it('.clone()', () => {
        assert.equal(network.clone() !== undefined, true);
        assert.equal(network.clone() instanceof NeuralNetwork, true);
        assert.equal(network.clone().nodes instanceof Array, true);
        assert.equal(network.clone().nodes.length, 100);
        assert.equal(network.clone().nodes !== network.nodes, true);
        assert.equal(network.clone().nodes[0] !== network.nodes[0], true);
        assert.equal(JSON.stringify(network.clone().export()), JSON.stringify(network.export()));
    });

    it('.output()', () => {
        assert.equal(network.output() instanceof EventEmitter, true);
    });

    describe('.learn()', () => {
        let node, synapse, startWeight;
        let round = (n) => Number(n).toFixed(2);

        beforeEach(() => {
            node = network.nodes[0];
            synapse = node.synapses[0];
            startWeight = synapse.w = 0.65;
            node.fire();
        });

        it('both .learn() and .unlearn() return a network', () => {
            let network2 = new NeuralNetwork(5);
            assert.equal(network2.learn(), network2);
            assert.equal(network2.unlearn(), network2);
        });

        it('reinforces learning', (done) => {
            setTimeout(() => {
                assert.equal(round(synapse.w), startWeight);
                network.learn();
                assert.equal(synapse.w > startWeight, true);
                network.unlearn();
                assert.equal(round(synapse.w), startWeight);
                network.unlearn();
                assert.equal(synapse.w < startWeight, true);
                done();
            }, network.opts.SIGNAL_FIRE_DELAY);
        });

        it('reinforces learning by the LEARNING_RATE', (done) => {
            setTimeout(() => {
                network.learn();
                assert.equal(round(synapse.w), round(startWeight + network.opts.LEARNING_RATE));
                network.unlearn();
                network.unlearn();
                assert.equal(round(synapse.w), round(startWeight - network.opts.LEARNING_RATE));
                done();
            }, network.opts.SIGNAL_FIRE_DELAY);
        });

        it('reinforces learning proportionally over the LEARNING_PERIOD', (done) => {
            setTimeout(() => {
                network.learn();
                assert.equal(round(synapse.w), round(startWeight + network.opts.LEARNING_RATE * 99/100));
                network.unlearn();
                network.unlearn();
                assert.equal(round(synapse.w), round(startWeight - network.opts.LEARNING_RATE * 99/100));
                done();
            }, network.opts.SIGNAL_FIRE_DELAY + network.opts.LEARNING_PERIOD / 100);
        });

    });

});


describe('Neuron', () => {

    var network, neuron;

    beforeEach(() => {
        network = new NeuralNetwork(100);
        neuron = new Neuron(0, [], network.opts);
    });

    it('is defined', () => {
        assert.equal(typeof Neuron, 'function');
        assert.equal(typeof neuron, 'object');
        assert.equal(typeof neuron.id, 'number');
        assert.equal(typeof neuron.potential, 'number');
        assert.equal(neuron.synapses instanceof Array, true);
    });

});
