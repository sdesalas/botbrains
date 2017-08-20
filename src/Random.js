'use strict';

class Random {

  // Inclusive random integers
  static integer(from, to) {
    if (!from && !to) return 0;
    if (!to) { to = from; from = 0; }
    var diff = to + 1 - from;
    return Math.floor(Math.random() * diff) + from;
  }

  static alpha(length) {
    var output = '';
    do {
      output += Math.random().toString('16').substr(2);
      if (output.length > length) {
        output = output.substr(0,length);
      }
    } while (length > 0 && output.length < length);
    return output;
  }
}

module.exports = Random;
