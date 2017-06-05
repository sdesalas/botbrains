"use strict";

class Utils {

    // Fast string hashing algorithm
    // Converts string to int predictably
    static hash(str){
        var char, hash = 0;
        if (!str) return hash;
        for (var i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    // Constrains a number between two others
    static constrain(n, from, to) {
        if (!isNaN(n)) {
            n = n < from ? from : n;
            n = n > to ? to : n;
        }
        return n;
    }

}

module.exports = Utils;
