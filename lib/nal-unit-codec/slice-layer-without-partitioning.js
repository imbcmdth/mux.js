'use strict';

let parser = require('./parse-exp-golomb');
let sliceHeader = require('./slice-header');

let start = parser.start;

let sliceLayerWithoutPartitioningCodec = start(sliceHeader);

module.exports = sliceLayerWithoutPartitioningCodec;
