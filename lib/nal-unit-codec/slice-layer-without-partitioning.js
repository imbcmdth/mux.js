'use strict';

let parser = require('./parse-exp-golomb');
let sliceHeader = require('./slice-header');

let start = parser.start;
let list = parser.list;

let sliceLayerWithoutPartitioningCodec = start('slice_layer_without_partitioning',
  list([
   sliceHeader
  // TODO: slice_data
  ]));

module.exports = sliceLayerWithoutPartitioningCodec;
