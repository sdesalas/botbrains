'use strict';

const Random = require('./Random');

class NetworkShaper {

  // Random ball shape
  // (neurons linked at random)
  static ball (index, size) {
    var i = Random.integer(0, size);
    if (i !== index) {
      return i;
    }
    return null;
  }

  // Tube shape
  static tube (index, size) {
    var i, range = Math.ceil(size / 5);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + index;
      var to = range + index;
      i = Random.integer(from, to);
      if (i > 0 && i < size && i !== index) {
        return i;
      }
    }
    return null;
  }

  // Snake shape
  static snake (index, size) {
    var i, range = Math.ceil(size / 20);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + index;
      var to = range + index;
      i = Random.integer(from, to);
      if (i > 0 && i < size && i !== index) {
        return i;
      }
    }
    return null;
  }

  // Forward-biased sausage shape
  // (neurons linked to neurons with similar id, slightly ahead of each other)
  static sausage (index, size) {
    var i, range = Math.ceil(size / 10);
    var offset = index + Math.floor(range / 2);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + offset;
      var to = range + offset;
      i = Random.integer(from, to);
      if (i > 0 && i < size && i !== index) {
        return i;
      }
    }
    i = Random.integer(0, size);
    if (i !== index) {
      return i;
    }
    return null;
  }

  // Doughnut shape
  static ring (index, size) {
    var i, range = Math.ceil(size / 20);
    var offset = index + Math.floor(range / 2);
    for (var tries = 0; tries < 3; tries++) {
      var from = -1 * range + offset;
      var to = range + offset;
      i = Random.integer(from, to);
      if (i >= size) {
        return i - size; // Link to beginning
      }
      if (i < 0) {
        return size + i; // Link to end
      }
      if (i !== index) {
        return i;
      }
    }
    return null;
  }
}


module.exports = NetworkShaper;
