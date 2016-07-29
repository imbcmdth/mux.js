'use strict';

let parser = require('./parse-exp-golomb');

let start = parser.start;
let data = parser.data;
let u = parser.dataTypes.u;

let audCodec = start('access_unit_delimiter',
    data('primary_pic_type', u(3)));

module.exports = audCodec;
