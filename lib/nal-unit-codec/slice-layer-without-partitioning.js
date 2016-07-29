'use strict';

let sliceHeader = require('./slice-header');
let combinators = require('./lib/combinators');

let start = combinators.start;
let list = combinators.list;

let sliceLayerWithoutPartitioningCodec = start('slice_layer_without_partitioning',
  list([
   sliceHeader
  // TODO: slice_data
  ]));

module.exports = sliceLayerWithoutPartitioningCodec;
