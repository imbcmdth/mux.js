'use strict';

let combinators = require('./lib/combinators');
let dataTypes = require('./lib/data-types');

let start = combinators.start;
let data = combinators.data;
let list = combinators.list;
let verify = combinators.verify;

let u = dataTypes.u;

let audCodec = start('access_unit_delimiter',
  list([
    data('primary_pic_type', u(3)),
    verify('access_unit_delimiter')
  ]));

module.exports = audCodec;
