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
    assert.between(network.strength, 0, 0.5);
  });

  it('.export()', () => {
    assert.equal(network.export() !== undefined, true);
    assert.equal(network.export().nodes, 100);
    assert.equal(network.export().synapses instanceof Array, true);
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
    let signalFireDelay;

    beforeEach(() => {
      node = network.nodes[0];
      synapse = node.synapses[0];
      startWeight = synapse.weight = synapse.ltw = network.opts.signalFireThreshold;
      signalFireDelay = 1000 / network.opts.signalSpeed;
      node.fire();
    });

    it('both .learn() and .unlearn() return a network', () => {
      let network2 = new NeuralNetwork(5);
      assert.equal(network2.learn(), network2);
      assert.equal(network2.unlearn(), network2);
    });

    it('reinforces learning', (done) => {
      setTimeout(() => {
        assert.equal(synapse.weight, startWeight);
        network.learn();
        assert.equal(synapse.weight > startWeight, true);
        network.unlearn();
        network.unlearn();
        assert.equal(synapse.weight < startWeight, true);
        done();
      }, signalFireDelay * 1.5);
    });

  });

});


describe('Neuron', () => {

  var network, neuron;

  beforeEach(() => {
    network = new NeuralNetwork(100);
    neuron = new Neuron(0, network.opts);
  });

  it('is defined', () => {
    assert.equal(typeof Neuron, 'function');
    assert.equal(typeof neuron, 'object');
    assert.equal(typeof neuron.id, 'number');
    assert.equal(typeof neuron.potential, 'number');
    assert.equal(neuron.synapses instanceof Array, true);
  });

});
