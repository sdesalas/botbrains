'use strict';

const Random = require('./Random');

class NetworkShaper {

  // Random ball shape
  // (neurons linked at random)
  static ball (size, neuron) {
    var target = Random.integer(0, size - 1);
    if (target !== neuron) {
      return target;
    }
    return undefined;
  }

  // Tube shape
  static tube (size, neuron) {
    const width = size / 4;
    const forwardBias = Math.ceil(width * Math.random());
    const target = neuron + forwardBias;
    if (target < size) {
      return target; 
    }
    return undefined;
  }

  // Classic layered shape (depends on connections per neuron)
  static classic (size, neuron, synapse, connectionsPerNeuron) {
    const layers = Math.ceil(size / connectionsPerNeuron);
    const offset = Math.floor(size / layers);
    const layer = Math.floor((neuron / size) * layers) + 1;
    const target = offset * layer + synapse;
    if (target < size) {
      return target;
    }
    return undefined;
  }

  // Snake shape
  static snake (size, neuron) {
    const width = size / 10;
    const forwardBias = Math.ceil(width * Math.random());
    const target = neuron + forwardBias;
    if (target < size) {
      return target;
    }
    return undefined;
  }

  // Forward-biased sausage shape
  static sausage (size, neuron) {
    const width = size / 4;
    const forwardBias = Math.ceil(width * Math.random());
    let target = neuron + forwardBias;
    if (target < size) {
      return target;
    }
    target = Random.integer(0, size - 1);
    if (target !== neuron) {
      return target;
    }
    return undefined;
  }

  // Ring shape
  static ring (size, neuron) {
    const width = size / 12;
    const forwardBias = Math.ceil(width * Math.random());
    const target = neuron + forwardBias;
    if (target < size) {
      return target;
    }
    return target - size; // link to beginning
  }
}


module.exports = NetworkShaper;
