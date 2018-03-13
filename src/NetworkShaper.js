'use strict';

const Random = require('./Random');

class NetworkShaper {

  // Random ball shape
  // (neurons linked at random)
  static ball (count, index) {
    var target = Random.integer(0, count - 1);
    if (target !== index) {
      return target;
    }
    return undefined;
  }

  // Drum shape
  static drum (count, index) {
    const width = count / 3;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < count) {
      return target; 
    }
    return undefined;
  }

  // Tube shape
  static tube (count, index) {
    const width = count / 5;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < count) {
      return target; 
    }
    return undefined;
  }

  // Classic shape (number of layers depends on connections per neuron)
  static classic (count, index, connectionCount, connectionIndex) {
    const layers = Math.ceil(count / connectionCount);
    const offset = Math.floor(count / layers);
    const layer = Math.floor((index / count) * layers) + 1;
    const target = offset * layer + connectionIndex;
    if (target < count) {
      return target;
    }
    return undefined;
  }

  // Snake shape
  static snake (count, index) {
    const width = count / 10;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < count) {
      return target;
    }
    return undefined;
  }

  // Forward-biased sausage shape
  static sausage (count, index) {
    const width = count / 4;
    const forwardBias = Math.ceil(width * Math.random());
    let target = index + forwardBias;
    if (target < count) {
      return target;
    }
    target = Random.integer(0, count - 1);
    if (target !== index) {
      return target;
    }
    return undefined;
  }

  // Ring shape
  static ring (count, index) {
    const width = count / 12;
    const forwardBias = Math.ceil(width * Math.random());
    const target = index + forwardBias;
    if (target < count) {
      return target;
    }
    return target - count; // link to beginning
  }
}


module.exports = NetworkShaper;
