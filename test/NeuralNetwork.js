const assert = require('assert-fuzzy');
const NeuralNetwork = require('../').NeuralNetwork;

describe('NeuralNetwork', function() {

    var network;

    beforeEach(function() {
        network = new NeuralNetwork(100);
    });

    it('is defined', function() {
        assert.equal(typeof network, 'object');
        assert.equal(typeof network.clone, 'function');
        assert.equal(typeof network.export, 'function');
        assert.equal(typeof network.size, 'number');
        assert.equal(typeof network.strength, 'number');
    });

    it('#size', function() {
        assert.equal(network.size, 100);
    });

    it('#strength', function() {
        assert.around(network.strength, 0.24);
    });

    it('#export()', function() {
        assert.equal(network.export() !== undefined, true);
        assert.equal(network.export().nodes instanceof Array, true);
        assert.equal(network.export().nodes.length, 100);
    });

    it('#clone()', function() {
        assert.equal(network.clone() !== undefined, true);
        assert.equal(network.clone() instanceof NeuralNetwork, true);
        assert.equal(network.clone().nodes instanceof Array, true);
        assert.equal(network.clone().nodes.length, 100);
        assert.equal(network.clone().nodes !== network.nodes, true);
        assert.equal(network.clone().nodes[0] !== network.nodes[0], true);
        assert.equal(JSON.stringify(network.clone().export()), JSON.stringify(network.export()));
    });
});
