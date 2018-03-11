'use strict';

const Random = require('./Random');

class NetworkShaper {

  // Random ball shape
  // (neurons linked at random)
  static ball (size, index) {
    var target = Random.integer(0, size - 1);
    if (target !== index) {
      return target;
    }
    return undefined;
  }

  // Tube shape
  static tube (size, index) {
    const width = size / 4;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < size) {
      return target; 
    }
    return undefined;
  }

  // Classic layered shape (depends on connections per neuron)
  static classic (size, index, synapseIndex, connectionsPerNeuron) {
    const layers = Math.ceil(size / connectionsPerNeuron);
    const offset = Math.floor(size / layers);
    const layer = Math.floor((index / size) * layers) + 1;
    const target = offset * layer + synapseIndex;
    if (target < size) {
      return target;
    }
    return undefined;
  }

  // Snake shape
  static snake (size, index) {
    const width = size / 10;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < size) {
      return target;
    }
    return undefined;
  }

  // Forward-biased sausage shape
  static sausage (size, index) {
    const width = size / 4;
    const forwardBias = Math.ceil(width * Math.random());
    let target = index + forwardBias;
    if (target < size) {
      return target;
    }
    target = Random.integer(0, size - 1);
    if (target !== index) {
      return target;
    }
    return undefined;
  }

  // Ring shape
  static ring (size, index) {
    const width = size / 12;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < size) {
      return target;
    }
    return target - size; // link to beginning
  }
}


module.exports = NetworkShaper;
