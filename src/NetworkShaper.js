'use strict';

const Random = require('./Random');

class NetworkShaper {

  // Random ball shape
  // (neurons linked at random)
  static ball (neuron, size) {
    var target = Random.integer(0, size - 1);
    if (target !== neuron) {
      return target;
    }
    return undefined;
  }

  // Tube shape
  static tube (neuron, size) {
    var target, range = Math.ceil(size / 4);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + neuron;
      var to = range + neuron;
      target = Random.integer(from, to);
      if (target >= 0 && target < size && target !== neuron) {
        return target;
      }
    }
    return undefined;
  }

  // Snake shape
  static snake (neuron, size) {
    var target, range = Math.ceil(size / 20);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + neuron;
      var to = range + neuron;
      target = Random.integer(from, to);
      if (target > 0 && target < size && target !== neuron) {
        return target;
      }
    }
    return undefined;
  }

  // Forward-biased sausage shape
  // (neurons linked to neurons with similar id, slightly ahead of each other)
  static sausage (neuron, size) {
    var target, range = Math.ceil(size / 10);
    var offset = neuron + Math.floor(range / 2);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + offset;
      var to = range + offset;
      target = Random.integer(from, to);
      if (target > 0 && target < size && target !== neuron) {
        return target;
      }
    }
    target = Random.integer(0, size);
    if (target !== neuron) {
      return target;
    }
    return undefined;
  }

  // Ring shape
  static ring (neuron, size) {
    var target, range = Math.ceil(size / 20);
    var offset = neuron + Math.floor(range / 2);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + offset;
      var to = range + offset;
      target = Random.integer(from, to);
      if (target >= size) {
        return target - size; // Link to beginning
      }
      if (target < 0) {
        return size + target; // Link to end
      }
      if (target !== neuron) {
        return target;
      }
    }
    return undefined;
  }
}


module.exports = NetworkShaper;
